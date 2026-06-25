import logging, os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.conf import settings
from django.db import transaction

from servers.models import Server
from servers.utils import cache_individual_vms
from servers.serializers import ServerPatchSerializer, ServerInfoSerializer
from servers.permissions import HasInternalAPIKey
from configuration.utils import get_sys_config, get_zabbix_config
from configuration.zabbix_utils import complete_maintenance_window
from configuration.models import ZabbixMaintenance, AstraeaAgentInfo
from configuration.tasks import schedule_zabbix_maintenance_task

logger = logging.getLogger('django')


class RegisterServer(APIView):
    permission_classes = [HasInternalAPIKey]
    authentication_classes = []

    def post(self, request):
        data = request.data
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR')
        hostname = data.get('hostname')
        env_value = data.get('env')
        disable_autoremove = data.get('disable_autoremove')
        enable_apt_release_info_change = data.get('enable_apt_release_info_change')
        reboot_on_success = data.get('reboot_on_success')
        reboot_after_updates = data.get('reboot_after_updates')
        max_allowed_uptime = data.get('max_allowed_uptime')
        if not data or not hostname or not env_value:
            logger.info(f"Invalid registration received from IP: {ip_address}")
            return Response({'message': "Invalid request, missing data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            server, created = Server.objects.get_or_create(
                hostname=hostname,
                env=env_value,
                disable_autoremove=disable_autoremove,
                enable_apt_release_info_change=enable_apt_release_info_change,
                reboot_on_success=reboot_on_success,
                reboot_after_updates=reboot_after_updates,
                max_allowed_uptime=max_allowed_uptime
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

        if is_enabled:
            zabbix_config = get_zabbix_config()
            if zabbix_config.get('enable') and cached_data.get('enable_zabbix'):
                if zabbix_config.get('api_token'):
                    hostname = cached_data.get('hostname')
                    schedule_zabbix_maintenance_task.delay(hostname, server_id, zabbix_config)
                else:
                    logger.warning(f"Zabbix enabled but API Token is missing for server {server_id}")

        return Response({'can_patch': is_enabled}, status=status.HTTP_200_OK)


class SaveServerInfo(APIView):
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
                serializer = ServerInfoSerializer(data=request.data)
                
                if not serializer.is_valid():
                    logger.error(f"Validation Error for {hostname} ({server_uuid}): {serializer.errors}")
                    return Response({
                        'message': 'Validation failed', 
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                serializer.save()
                
                logger.info(f"Server data synced for: {hostname} | ID: {server_uuid} | Source: {ip_address}")
                return Response({'message': 'Successfully processed server telemetry'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Transaction failed for {hostname} ({server_uuid}): {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
                
                instance = serializer.save()
                
                zabbix_config = get_zabbix_config()
                if zabbix_config.get('enable') and instance.enable_zabbix:
                    zabbix_maintenance = ZabbixMaintenance.objects.filter(
                        server_id=server_uuid
                    ).order_by('-created_at').first()

                    if zabbix_maintenance:
                        complete_maintenance_window(zabbix_maintenance.id)
                        if settings.DEBUG:
                            logger.info(f"Scheduled Zabbix maintenance removal for {hostname}")
                    else:
                        logger.warning(f"No active Zabbix maintenance record found for server {server_uuid}")
                
                if settings.DEBUG:
                    logger.info(f"Patch data synced for: {hostname} | ID: {server_uuid} | Source: {ip_address}")
                return Response({'message': 'Successfully processed patch telemetry'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Transaction failed for {hostname} ({server_uuid}): {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class AgentCheckUpdateView(APIView):
    permission_classes = [HasInternalAPIKey]
    authentication_classes = []

    def get(self, request):
        file_path = os.path.join(settings.BASE_DIR, 'protected_storage', 'astraea_agent.tar.gz')
        
        get_version = request.query_params.get('version')
        if get_version:
            info, created = AstraeaAgentInfo.objects.get_or_create(id=1)
            return Response({'version': info.version}, status=status.HTTP_200_OK)

        if not os.path.exists(file_path):
            if settings.DEBUG:
                logger.error(f'Agent package not found on server')
            return Response({'message': 'Agent package not found on server'}, status=status.HTTP_404_NOT_FOUND)

        if settings.DEBUG:
            logger.info(f"Successfully serving 'astraea_agent.tar.gz' to download")

        return FileResponse(
            open(file_path, 'rb'), 
            as_attachment=True, 
            filename='astraea_agent.tar.gz'
        )