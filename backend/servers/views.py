import logging, re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q, Max
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from backend.settings import DEBUG
from .models import Server, Package, PatchSession, PackageUpdate
from .utils import warm_cache_in_background, evaluate_comparison, parse_relative_date, cache_individual_vms, refresh_package_search_index
from .serializers import ServerSearchSerializer, ServerPatchSerializer, ServerUpdateSerializer
from .permissions import HasInternalAPIKey
from configuration.utils import get_sys_config

logger = logging.getLogger('django')


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = cache.get("dashboard_stats")

        if stats is None:
            warm_cache_in_background()

            return Response({
                "status": "warming",
                "progress": "Cache is populating..."
            }, status=status.HTTP_202_ACCEPTED)
        return Response(stats, status=status.HTTP_200_OK)


class ServerSearchPagination(PageNumberPagination):
    page_size = 20  # Default results per page
    page_size_query_param = 'page_size'  # Allow client to override, e.g., ?page_size=50
    max_page_size = 100

class QuickVMSearchView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = ServerSearchPagination

    def get(self, request):
        raw_query = request.GET.get('q', '').strip()
        all_vms = cache.get("server_search_index")

        if not raw_query:
            if all_vms is None:
                warm_cache_in_background()
                # Return everything from DB if cache is empty
                queryset = Server.objects.all().order_by('hostname')
                return self._paginate_and_serialize(queryset, request, is_partial=True)
            else:
                return self._paginate_list(all_vms, request, is_partial=False)

        # Regex captures (key):(operator)(value) or (key):(quoted value) or (term)
        tokens = re.findall(r'(?:(\w+):)?(?:"([^"]+)"|([^\s]*))', raw_query.lower())
        
        filters = []
        general_terms = []
        for key, val_quoted, val_unquoted in tokens:
            value = val_quoted or val_unquoted
            if key:
                filters.append((key, value))
            else:
                general_terms.append(value)
        
        if all_vms is None:
            warm_cache_in_background() # Warm the cache while we are doing a Database lookup for the search results
            return self._db_fallback(request, filters, general_terms)


        filter_map = {
            'id': lambda vm, v: v in vm['server_id'].lower(),
            'os': lambda vm, v: v in vm['os_version'].lower(),
            'host': lambda vm, v: v in vm['hostname'].lower(),
            'ip': lambda vm, v: any(v in i['ip'].lower() for i in vm.get('interfaces', [])),
            'mac': lambda vm, v: any(v in i['mac'].lower() for i in vm.get('interfaces', [])),
            'schedule': lambda vm, v: v in vm['patch_schedule'].lower(),
            'enabled': lambda vm, v: str(vm['enable_patching']).lower() == v.lower(),
            'env': lambda vm, v: self._apply_string_filter(vm.get('env'), v),
            'reboot': lambda vm, v: evaluate_comparison(vm['last_reboot'], v),
            'patched': lambda vm, v: evaluate_comparison(vm['last_patch'], v),
            'uptime': lambda vm, v: evaluate_comparison(vm['uptime'], v),
            'status': lambda vm, v: v.lower() in (vm.get('last_patch_status') or 'unknown').lower()
        }

        results = []
        for vm in all_vms:
            is_match = True
            for key, val in filters:
                condition = filter_map.get(key)
                if condition and not condition(vm, val):
                    is_match = False
                    break
            
            if is_match and general_terms:
                # Combine hostname, os, and all IPs/MACs into one string for general search
                ifaces = vm.get('interfaces', [])
                ips = " ".join([i['ip'] for i in ifaces])
                macs = " ".join([i['mac'] for i in ifaces])
                
                searchable_string = f"{vm['hostname']} {ips} {vm['os_version']} {macs} {vm['patch_schedule']} {vm['env']} {vm.get('last_patch_status', 'unknown')}".lower()
                
                if not all(term in searchable_string for term in general_terms):
                    is_match = False
            
            if is_match:
                results.append(vm)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(results, request, view=self)
        
        if page is not None:
            response = paginator.get_paginated_response(page)
            response.data['is_partial'] = False
            return response

        return Response({"results": results, "is_partial": False}, status=status.HTTP_200_OK)

    def _apply_string_filter(self, actual_val, search_val):
        """Helper to handle null/none/empty logic in Python filtering."""
        actual_val = (actual_val or '').lower().strip()
        search_val = (search_val or '').lower().strip()
        
        # Handle keywords for empty/null searches
        if search_val in ['none', 'null', 'empty', 'unknown', '']:
            return actual_val == ''
            
        return search_val in actual_val

    def _db_fallback(self, request, filters, general_terms):
        """Enhanced DB fallback to handle basic comparison operators."""
        query = Q()
        for key, val in filters:
            if key == 'enabled':
                # Convert string "true"/"false" from search into actual Python Boolean
                bool_val = val.lower() == 'true'
                query &= Q(enable_patching=bool_val)
                continue

            # Map search keys to Django ORM lookups
            lookup_map = {
                'os': 'os_version', 
                'host': 'hostname', 
                'ip': 'interfaces__ip_address',
                'mac': 'interfaces__mac_address',
                'id': 'server_id',
                'patched': 'last_patch_date',
                'enabled': 'enable_patching',
                'reboot': 'last_reboot',
                'schedule': 'patch_schedule',
                'env': 'env',
                'status': 'patch_sessions__status'
            }
            field = lookup_map.get(key)
            if not field: continue

            # Handle 'env:none', 'env:null', or 'env:'
            if val.lower() in ['none', 'null', 'empty', 'unknown', '']:
                query &= (Q(**{f"{field}__isnull": True}) | Q(**{f"{field}": ""}))
                continue

            # Detect operators for ORM
            if val.startswith('>'):
                date_target = parse_relative_date(val[1:])
                if date_target: query &= Q(**{f"{field}__lt": date_target})
            elif val.startswith('<'):
                date_target = parse_relative_date(val[1:])
                if date_target: query &= Q(**{f"{field}__gt": date_target})
            else:
                query &= Q(**{f"{field}__icontains": val})

        for term in general_terms:
            query &= (
                Q(hostname__icontains=term) | 
                Q(interfaces__ip_address__icontains=term) |
                Q(os_version__icontains=term) |
                Q(interfaces__mac_address__icontains=term) |
                Q(env__icontains=term) |
                Q(patch_sessions__status__icontains=term) |
                Q(enabled__icontains=term)
            )

        queryset = Server.objects.filter(query).prefetch_related('interfaces', 'patch_sessions').distinct().order_by('hostname')
        
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        
        if page is not None:
            serializer = ServerSearchSerializer(page, many=True)
            response = paginator.get_paginated_response(serializer.data)
            response.data['is_partial'] = True
            return response

        serializer = ServerSearchSerializer(queryset, many=True)
        return Response({"results": serializer.data, "is_partial": True}, status=status.HTTP_200_OK)
    
    def _paginate_list(self, data_list, request, is_partial=False):
        """Helper to paginate a standard Python list (from Cache)."""
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(data_list, request, view=self)
        if page is not None:
            response = paginator.get_paginated_response(page)
            response.data['is_partial'] = is_partial
            return response
        return Response({"results": data_list, "is_partial": is_partial})

    def _paginate_and_serialize(self, queryset, request, is_partial=True):
        """Helper to paginate a Django QuerySet (from Database)."""
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = ServerSearchSerializer(page, many=True)
            response = paginator.get_paginated_response(serializer.data)
            response.data['is_partial'] = is_partial
            return response
        
        serializer = ServerSearchSerializer(queryset, many=True)
        return Response({"results": serializer.data, "is_partial": is_partial})


class PackageSearchPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100

class PackageSearchView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = PackageSearchPagination

    def get(self, request):
        query = request.GET.get('q', '').strip().lower()
        all_packages = cache.get("package_search_index")

        # Fallback if cache is cold
        if all_packages is None:
            all_packages = refresh_package_search_index()

        if not query:
            return self._paginate_list(all_packages, request)

        # Simple but effective filtering on the cached list
        search_terms = query.split()
        results = [
            pkg for pkg in all_packages 
            if all(term in pkg['search_stack'] for term in search_terms)
        ]

        return self._paginate_list(results, request)

    def _paginate_list(self, data_list, request):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(data_list, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(page)
        return Response({"results": data_list})

class PackageServerListView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = PackageSearchPagination

    # Cache this view for 5 minutes based on the URL parameters (name, version, page)
    @method_decorator(cache_page(60 * 5))
    def get(self, request):
        package_name = request.GET.get('name')
        version = request.GET.get('version')
        
        if not package_name or not version:
            return Response({"error": "Missing parameters"}, status=400)

        # 1. Identify the latest session IDs for every server
        latest_session_ids = PatchSession.objects.filter(status='success') \
            .values('server') \
            .annotate(latest_id=Max('id')) \
            .values_list('latest_id', flat=True)

        # 2. Optimized Query: We use select_related to join Server and 
        # get the status directly from the session object instead of a Subquery
        active_instances = PackageUpdate.objects.filter(
            session_id__in=latest_session_ids,
            package__name=package_name,
            new_version=version
        ).select_related('session__server').only(
            'session__server__hostname', 
            'session__server__server_id', 
            'session__server__os_version',
            'session__status'
        ).order_by('session__server__hostname')

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(active_instances, request)
        
        data = [
            {
                "hostname": update.session.server.hostname,
                "server_id": update.session.server.server_id,
                "os_version": update.session.server.os_version,
                "last_patch_status": update.session.status, 
            }
            for update in page
        ]
        
        return paginator.get_paginated_response(data)


class RegisterServer(APIView):
    permission_classes = [HasInternalAPIKey]
    authentication_classes = []

    def post(self, request):
        data = request.data
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR')
        hostname = data.get('hostname')
        env_value = data.get('env')
        if not data or not hostname or not env_value:
            logger.info(f"Invalid registration received from IP: {ip_address}")
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            server, created = Server.objects.get_or_create(
                hostname=hostname,
                env=env_value
            )
            logger.info(f"Successfully registered server {hostname}")
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response({'uuid': str(server.server_id)}, status=status_code)
        except Exception as e:
            logger.error(f"Failed to register {hostname}: {str(e)}")
            return Response({'message': f'Internal server error registering server {hostname}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)         


class ServerPatchingEnableCheck(APIView):
    permission_classes = [HasInternalAPIKey]
    authentication_classes = []

    def post(self, request):
        server_id = request.data.get('server_id')
        if not server_id:
            return Response({'error': "Missing server_id"}, status=status.HTTP_400_BAD_REQUEST)

        sys_config = get_sys_config()
        if not sys_config.get('patching_enabled'):
            return Response({'can_patch': False, 'reason': 'global'}, status=status.HTTP_200_OK)
        
        cache_key = f"server_data:{server_id}"
        cached_data = cache.get(cache_key)
        if cached_data is None:
            server = get_object_or_404(Server, server_id=server_id)
            cache_individual_vms([server])
            cached_data = cache.get(cache_key)
        
        is_enabled = cached_data.get('enable_patching')
        return Response({'can_patch': is_enabled}, status=status.HTTP_200_OK)


class SavePatchingData(APIView):
    permission_classes = [HasInternalAPIKey]
    authentication_classes = []

    def post(self, request):
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR')
        server_uuid = request.data.get('server_id', 'Unknown UUID')
        hostname = request.data.get('hostname', 'Unknown Host')

        if not request.data:
            logger.info(f"Empty payload received from IP: {ip_address}")
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                serializer = ServerPatchSerializer(data=request.data)
                
                if not serializer.is_valid():
                    logger.error(f"Validation Error for {hostname} ({server_uuid}): {serializer.errors}")
                    return Response({
                        'message': 'Validation failed', 
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Triggers the refined create() logic
                serializer.save()
                
                logger.info(f"Patch data synced for: {hostname} | ID: {server_uuid} | Source: {ip_address}")
                return Response({'message': 'Successfully processed patch telemetry'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Transaction failed for {hostname} ({server_uuid}): {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InspectServerInfo(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.data.get('server_id') or request.query_params.get('server_id')

        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"server_data:{server_id}"
        data = cache.get(cache_key)

        if data is None:
            server = get_object_or_404(Server.objects.prefetch_related('interfaces'), server_id=server_id)
            cache_individual_vms([server])
            data = cache.get(cache_key)

        # Add recent history summary
        recent_sessions = PatchSession.objects.filter(server__server_id=server_id)
        data['recent_history'] = [{
            'id': s.id,
            'timestamp': s.timestamp,
            'status': s.status,
            'total': s.total_updated,
            'error_log': s.error_log
        } for s in recent_sessions]

        # Add Packages in the inventory
        latest_session = PatchSession.objects.filter(
            server__server_id=server_id,
            status='success'
        ).first()

        if latest_session:
            updates = latest_session.package_details.select_related('package').all()
            data['recent_packages'] = [{
                'name': u.package.name,
                'version': u.new_version,
                'last_seen': latest_session.timestamp
            } for u in updates]
        else:
            data['recent_packages'] = []

        return Response(data, status=status.HTTP_200_OK)


class ServerPatchHistory(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.query_params.get('server_id')
        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch all sessions for this server
        sessions = PatchSession.objects.filter(
            server__server_id=server_id
        ).order_by('-timestamp')

        # Map to the format the Frontend HistoryTable expects
        data = [{
            'id': s.id,
            'timestamp': s.timestamp,
            'status': s.status,
            'total': s.total_updated,
            'error_log': s.error_log
        } for s in sessions]

        return Response(data, status=status.HTTP_200_OK)


class ServerPackageInventory(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.query_params.get('server_id')
        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Find the absolute latest successful session for this server
        latest_session = PatchSession.objects.filter(
            server__server_id=server_id,
            status='success'
        ).first() # ordering is -timestamp by default in your model

        if not latest_session:
            return Response([])

        # 2. Get only the packages from THAT specific snapshot
        updates = latest_session.package_details.select_related('package').all()

        data = [{
            'name': u.package.name,
            'version': u.new_version,
            'last_seen': latest_session.timestamp
        } for u in updates]

        return Response(sorted(data, key=lambda x: x['name']), status=status.HTTP_200_OK)


class PatchSessionDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'message': "Missing Session ID"}, status=status.HTTP_400_BAD_REQUEST)

        session = get_object_or_404(PatchSession, id=session_id)
        
        # Fetch individual package updates for this session
        updates = session.package_details.select_related('package').all()

        data = {
            'id': session.id,
            'timestamp': session.timestamp,
            'status': session.status,
            'error_log': session.error_log,
            'updates': [{
                'name': u.package.name,
                'old_version': u.old_version,
                'new_version': u.new_version
            } for u in updates]
        }

        return Response(data, status=status.HTTP_200_OK)


class PurgeDatabaseOldPackagesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # 1. Identify packages not present in any PackageUpdate record
            # 'usage_history' is the related_name from your PackageUpdate model
            orphaned_packages = Package.objects.filter(usage_history__isnull=True)
            
            count = orphaned_packages.count()
            
            # 2. Perform the deletion
            orphaned_packages.delete()
            if DEBUG:
                logger.info(f"Database Purge: Removed {count} orphaned packages.")
            
            return Response({
                'message': f'Successfully purged {count} orphaned packages.',
                'purged_count': count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f'Database purge failed: {str(e)}')
            return Response({
                'message': f'Internal server error during purge: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateServerInfo(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.data.get('server_id') or request.query_params.get('server_id')

        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"server_data:{server_id}"
        cached_data = cache.get(cache_key)

        if cached_data is None:
            server = get_object_or_404(Server, server_id=server_id)
            cache_individual_vms([server])
            cached_data = cache.get(cache_key)
        
        # Only send the needed data to reduce amount sent
        fields = ['server_id', 'patch_schedule', 'enable_patching', 'env', 'hostname']
        needed_results = {k: cached_data.get(k) for k in fields if k in cached_data}
        
        return Response(needed_results, status=status.HTTP_200_OK)


    def post(self, request):
        server_id = request.data.get('server_id') or request.query_params.get('server_id')

        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            server_instance = Server.objects.get(server_id=server_id)
        except Server.DoesNotExist:
            return Response({'message': "Server not found"}, status=status.HTTP_404_NOT_FOUND)

        try: 
            with transaction.atomic():
                serializer = ServerUpdateSerializer(server_instance, data=request.data, partial=True)
                if not serializer.is_valid():
                    logger.info(f"Invalid update data, error: {serializer.errors}")
                    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
                serializer.save()
                logger.info(f"Successfully updated host: {server_instance.hostname}")
                return Response({'message': 'Successfully updated host'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to update server {server_instance.hostname}: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteServer(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        server_id = request.data.get('server_id') or request.query_params.get('server_id')
        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            server_to_delete = get_object_or_404(Server, server_id=server_id)
            hostname = server_to_delete.hostname
            server_to_delete.delete()
            logger.info(f"Successfully deleted server with the hostname: {hostname}")
            return Response({'message': f'Server {hostname} deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to delete server `{server_id}`: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)