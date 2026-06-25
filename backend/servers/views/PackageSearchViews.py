import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from django.db.models import Max
from django.db.models.functions import Length
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from servers.models import PatchSession, PackageUpdate
from servers.utils import refresh_package_search_index

logger = logging.getLogger('django')


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
        ).order_by(
            Length('session__server__hostname').asc(),
            'session__server__hostname'
        )

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