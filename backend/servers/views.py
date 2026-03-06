import logging, re
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q

from .models import Server, Package, APIKey
from .utils import warm_cache_in_background, evaluate_comparison, parse_relative_date
from .serializers import ServerSearchSerializer, ServerPatchSerializer
from .permissions import HasInternalAPIKey

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
            'ip': lambda vm, v: v in vm['ip_address'].lower(),
            'host': lambda vm, v: v in vm['hostname'].lower(),
            'mac': lambda vm, v: v in vm['mac_address'].lower(),
            'schedule': lambda vm, v: v in vm['patch_schedule'].lower(),
            'env': lambda vm, v: self._apply_string_filter(vm.get('env'), v),
            'reboot': lambda vm, v: evaluate_comparison(vm['last_reboot'], v),
            'patched': lambda vm, v: evaluate_comparison(vm['last_patch'], v),
            'uptime': lambda vm, v: evaluate_comparison(vm['uptime'], v),
        }

        results = []
        for vm in all_vms:
            is_match = True
            for key, val in filters:
                condition = filter_map.get(key)
                if condition:
                    if not condition(vm, val):
                        is_match = False
                        break
                else:
                    is_match = False
                    break
            
            if is_match and general_terms:
                searchable_string = f"{vm['hostname']} {vm['ip_address']} {vm['os_version']} {vm['mac_address']} {vm['patch_schedule']} {vm['env']}".lower()
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
            # Map search keys to Django ORM lookups
            lookup_map = {
                'os': 'os_version', 
                'host': 'hostname', 
                'ip': 'ip_address', 
                'id': 'server_id', 
                'mac': 'mac_address',
                'patched': 'last_patch_date',
                'reboot': 'last_reboot',
                'schedule': 'patch_schedule',
                'env': 'env'
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
                Q(ip_address__icontains=term) |
                Q(os_version__icontains=term) |
                Q(mac_address__icontains=term)
            )

        queryset = Server.objects.filter(query).order_by('hostname')
        
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


class PackageSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.GET.get('q', '').strip().lower()
        if not query:
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"software_search:{query}"
        results = cache.get(cache_key)

        if results is None:

            all_matches = Package.objects.filter(name__icontains=query).prefetch_related('installed_on__server')

            grouped_data = {}
            for pkg in all_matches:
                if pkg.name not in grouped_data:
                    grouped_data[pkg.name] = {
                        "name": pkg.name,
                        "versions": []
                    }
                
                updates = pkg.installed_on.all()
                server_count = updates.count()

                grouped_data[pkg.name]["versions"].append({
                    "package_id": pkg.id,
                    "version": pkg.version,
                    "server_count": server_count,
                    "preview_servers": [
                        u.server.hostname for u in updates[:3]
                    ],
                    "has_more": server_count > 3
                })
        
            results = list(grouped_data.values())
            cache.set(cache_key, results, timeout=900)
        
        return Response(results, status=status.HTTP_200_OK)


class SavePatchingData(APIView):
    permission_classes = [HasInternalAPIKey]

    def post(self, request):
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR')
        if request.data is None:
            logger.info(f"'{ip_address}' tried to upload empty JSON data.")
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                serializer = ServerPatchSerializer(data=request.data)
                if not serializer.is_valid():
                    logger.info(f"Invalid patching data, error: {serializer.errors}")
                    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
                serializer.save()
                hostname = serializer.validated_data.get('hostname')
                logger.info(f"Successfully saved patching data for host: {hostname}")
                return Response({'message': 'Successfully saved patching data'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to process patching data upload request: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteServer(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        hostname = request.data.get('hostname')
        if not hostname:
            return Response({'message': "Invalid request, missing hostname"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            server_to_delete = get_object_or_404(Server, hostname=request.data.get('hostname'))
            server_to_delete.delete()
            logger.info(f"Successfully deleted server with the hostname: {request.data.get('hostname')}")
            return Response({'message': f'Server {hostname} deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to delete server {request.data.get('hostname')}: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateAPIKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = request.data.get('name', 'Unnamed Key')
        
        plain_key, hashed_key = APIKey.generate_key()
        
        APIKey.objects.create(
            name=name,
            key_hash=hashed_key
        )
        
        # Return the PLAIN KEY to the user so they can save it in their script
        return Response({
            "message": "API Key created. Copy this now; you won't see it again!",
            "plain_key": plain_key,
            "name": name
        }, status=status.HTTP_201_CREATED)