import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db import transaction

from servers.models import Server
from servers.utils import cache_individual_vms
from servers.serializers import ServerUpdateSerializer

logger = logging.getLogger('django')


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
        fields = ['server_id', 'patch_schedule', 'enable_patching', 'env', 'hostname', 'enable_notifications', 'enable_zabbix']
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