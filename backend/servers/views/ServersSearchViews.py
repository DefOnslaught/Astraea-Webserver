import logging, re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from django.db.models import Q

from servers.models import Server
from servers.utils import warm_cache_in_background, evaluate_comparison, parse_relative_date
from servers.serializers import ServerSearchSerializer

logger = logging.getLogger('django')


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