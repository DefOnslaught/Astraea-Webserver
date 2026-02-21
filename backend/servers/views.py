import logging
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from django.db import transaction

from .models import Server, Package, APIKey
from .utils import warm_cache_in_background
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
        return Response(stats)


class QuickVMSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # request.GET pulls from the URL params (e.g., ?q=searchterm)
        search_query = request.GET.get('q', '').lower()

        if not search_query:
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Try Redis first
        keys = cache.keys("server_data:*")
        vm_dict = cache.get_many(keys)
        all_vms = [v for v in vm_dict.values() if v is not None]
        
        # 2. Fallback to DB if Redis is empty
        is_partial = False
        if not all_vms:

            warm_cache_in_background()

            # Send 50 results while the cache is loading
            vms_qs = Server.objects.all()[:50]
            serializer = ServerSearchSerializer(vms_qs, many=True)
            all_vms = serializer.data
            is_partial = True

        if search_query:
            results = [
                vm for vm in all_vms 
                if any(search_query in str(val).lower() for val in vm.values())
            ]
        else:
            results = all_vms

        return Response({
            "results": results,
            "is_partial": is_partial
        })


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
        
        return Response(results)


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