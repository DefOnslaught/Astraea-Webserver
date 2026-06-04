import logging, os, tarfile, io, shutil, zipfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, FileResponse
from django.template import Context, Template
from django.db import transaction

from backend.settings import DEBUG, BASE_DIR
from servers.permissions import HasInternalAPIKey
from .models import APIKey, SysConfig, NotificationSettings, NotificationService, AgentInstallConfig, AstraeaAgentInfo
from .serializers import ApiKeyUpdateSerializer, APIKeySerializer, NotificationServiceSerializer, AgentInstallConfigSerializer
from .utils import get_sys_config

logger = logging.getLogger('django')

class CreateAPIKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = request.data.get('name', 'Unnamed Key')
        
        try:
            key_val = APIKey.generate_key()
            new_key = APIKey.objects.create(name=name, key=key_val)            
            serializer = APIKeySerializer(new_key)
            
            if DEBUG:
                logger.info(f"Successfully created API key with name: {name}")

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.critical(f"Failed creating an API Key: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetAPIKeys(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        keys = APIKey.objects.all().order_by('-created_at')

        data = [{
            'id': key.id,
            'key': key.key,
            'name': key.name,
            'created_at': key.created_at,
            'last_used': key.last_used,
            'is_active': key.is_active
        } for key in keys]

        return Response(data, status=status.HTTP_200_OK)


class UpdateAPIKey(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        key_id = request.data.get('id')
        if not key_id:
            return Response({'message': "Missing Key ID"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            api_key = APIKey.objects.get(id=key_id)
        except APIKey.DoesNotExist:
            return Response({"error": "Key not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ApiKeyUpdateSerializer(api_key, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            if DEBUG:
                logger.info(f"Successfully updated API key: {api_key.name}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeleteAPIKey(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        key_id = request.data.get('id')
        if not key_id:
            return Response({'message': "Missing Key ID"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            key = get_object_or_404(APIKey, id=key_id)
            key_name = key.name
            key.delete()
            if DEBUG:
                logger.info(f"Successfully deleted API Key `{key_name}`")
            return Response({'message': f'API Key {key_name} deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed deleting API Key: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SystemConfig(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = get_sys_config()

        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request):
        data = request.data.get('data')

        if data is None:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            config = SysConfig.objects.first()
            if not config:
                config = SysConfig()
            config.patching_enabled = data['patching_enabled']
            config.skip_email_validation = data['skip_email_validation']
            config.disable_registration = data['disable_registration']
            config.save()
            if DEBUG:
                logger.info(f"Successfully updated System Settings")
            return Response({'message': 'Successfully updated System Settings'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'Unable to update System Settings: {str(e)}')
            return Response({'message': f'Unable to update System Settings: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = NotificationSettings.objects.first()

        if not settings:
            settings, created = NotificationSettings.objects.get_or_create()

        data = {
            'failed': settings.failed,
            'success': settings.success,
            'partial': settings.partial,
            'out_of_date': settings.out_of_date 
        }

        return Response(data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        data = request.data.get('data')

        if data is None:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            settings = NotificationSettings.objects.first()
            if not settings:
                settings = NotificationSettings()
            settings.failed = data['failed']
            settings.success = data['success']
            settings.partial = data['partial']
            settings.out_of_date = data['out_of_date']
            settings.save()
            if DEBUG:
                logger.info(f"Successfully updated Notification Settings")
            return Response({'message': 'Successfully updated Notification Settings'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'Unable to update Notification Settings: {str(e)}')
            return Response({'message': f'Unable to update Notification Settings: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NotificationServicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        services = NotificationService.objects.all().order_by('-created_at')
        serializer = NotificationServiceSerializer(services, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def post(self, request):
        data = request.data.get('data')

        if data is None:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        processed_data = {
            'name': data.get('name'),
            'type': data.get('type'),
            'url': data.get('discordWebhook') if data.get('type') == 'discord' else None,
            'recipients': data.get('recipients') if data.get('type') == 'smtp' else None,
            'active': data.get('active', True)
        }

        serializer = NotificationServiceSerializer(data=processed_data)
        if serializer.is_valid():
            serializer.save()
            if DEBUG:
                logger.info(f"Successfully created Notification Service: {data.get('name')}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        if DEBUG:
                logger.info(f"Unable to create Notification Service: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request):
        data = request.data.get('data')
        if not data:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        service_id = data.get('id')
        service = get_object_or_404(NotificationService, id=service_id)

        update_fields = {}
        if 'name' in data: update_fields['name'] = data['name']
        if 'type' in data: update_fields['type'] = data['type']
        if 'active' in data: update_fields['active'] = data['active']
        
        if data.get('type') == 'discord' and 'discordWebhook' in data:
            update_fields['url'] = data['discordWebhook']
        if data.get('type') == 'smtp' and 'recipients' in data:
            update_fields['recipients'] = data['recipients']

        serializer = NotificationServiceSerializer(service, data=update_fields, partial=True)

        if serializer.is_valid():
            serializer.save()
            if DEBUG:
                logger.info(f"Successfully updated Notification Service: {service.name}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        if DEBUG:
                logger.info(f"Unable to update Notification Service: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request):
        data = request.data.get('data')
        if not data:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        service_id = data.get('id')
        service = get_object_or_404(NotificationService, id=service_id)
        service_name = service.name
        service.delete()
        if DEBUG:
                logger.info(f"Successfully deleted Notification Service {service_name}")
        return Response({'message': f'Successfully deleted Notification Service {service_name}'}, status=status.HTTP_200_OK)


class AgentCreateConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        data = request.data
        if data is None:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = AgentInstallConfigSerializer(data=data)
        
        if serializer.is_valid():
            config = serializer.save()
            
            if DEBUG:
                logger.info(f"Successfully created Agent Install UUID `{config.uid}`")

            return Response({
                'uuid': config.uid,
                'message': "Deployment configuration stored successfully."
            }, status=status.HTTP_201_CREATED)
        
        if DEBUG:
            logger.error(f"Serializer errors: {serializer.errors}")

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AgentInstallScriptView(APIView):

    def get(self, request, uid):
        config = get_object_or_404(AgentInstallConfig, uid=uid)

        requested_file = request.GET.get('file')
        
        # Logic Mapping: Standardize filenames for the response
        if requested_file == 'logic_script':
            if config.exe_logic == 'week1and3':
                filename = 'patching-week1and3.sh'
            elif config.exe_logic == 'week2and4':
                filename = 'patching-week2and4.sh'
            elif config.exe_logic == 'week1':
                filename = 'patching-week1.sh'
            elif config.exe_logic == 'week2':
                filename = 'patching-week2.sh'
            elif config.exe_logic == 'week3':
                filename = 'patching-week3.sh'
            elif config.exe_logic == 'week4':
                filename = 'patching-week4.sh'
            else:
                return Response({'message': 'No logic script required for standard execution'}, status=status.HTTP_404_NOT_FOUND)
        else:
            filename = 'install_agent.sh'

        script_path = os.path.join(BASE_DIR, 'configuration', 'scripts', filename)
        
        if not os.path.exists(script_path):
            if DEBUG:
                logger.info(f'Script {filename} not found on server')
            return Response({'message': f'Script {filename} not found on server'}, status=status.HTTP_404_NOT_FOUND)

        with open(script_path, 'r') as f:
            script_content = f.read()
        
        # Render with context (API_KEY, BASE_URL, etc.)
        template = Template(script_content)
        context = Context({
            'API_KEY': config.api_key.key,
            'ENVIRONMENT': config.environment,
            'CRON': config.cron,
            'PATCHING_SCHEDULE': config.patching_schedule,
            'EXE_LOGIC': config.exe_logic,
            'BASE_URL': f"{request.scheme}://{request.get_host()}",
            'UID': uid,
            'DISABLE_AUTOREMOVE': config.disable_autoremove,
            'ENABLE_APT_ALLOW_RELEASE_INFO_CHANGE': config.enable_apt_release_info_change,
            'REBOOT_ON_SUCCESS': config.reboot_on_success,
            'REBOOT_AFTER_UPDATES': config.reboot_after_updates,
            'MAX_ALLOWED_UPTIME_DAYS': config.max_allowed_uptime
        })
        
        rendered_script = template.render(context)
        
        response = HttpResponse(rendered_script, content_type='text/x-sh')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        if DEBUG:
            logger.info(f'Successfully sending Agent Install Script')
        return response


class AgentFileHandlerView(APIView):
    permission_classes = [HasInternalAPIKey]

    def get(self, request):
        file_path = os.path.join(BASE_DIR, 'protected_storage', 'astraea_agent.tar.gz')
        
        if not os.path.exists(file_path):
            if DEBUG:
                logger.error(f'Agent package not found on server')
            return Response({'message': 'Agent package not found on server'}, status=status.HTTP_404_NOT_FOUND)

        if DEBUG:
            logger.info(f"Successfully serving 'astraea_agent.tar.gz' to download")

        return FileResponse(
            open(file_path, 'rb'), 
            as_attachment=True, 
            filename='astraea_agent.tar.gz'
        )
    

class AgentUploadHandlerView(APIView):
    permission_classes = [IsAuthenticated]

    # Constants for failsafes
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB limit
    ALLOWED_EXTENSIONS = ('.zip', '.tar', '.tar.gz')
    STORAGE_DIR = os.path.join(BASE_DIR, 'protected_storage')
    AGENT_FILE = 'astraea_agent.tar.gz'
    AGENT_PATH = os.path.join(STORAGE_DIR, AGENT_FILE)

    def get(self, request):
        get_version = request.query_params.get('version')
        if get_version:
            info, created = AstraeaAgentInfo.objects.get_or_create(id=1)
            return Response({'version': info.version}, status=status.HTTP_200_OK)
        
        if not os.path.exists(self.AGENT_PATH):
            if DEBUG:
                logger.error(f'Agent package not found on server')
            return Response({'message': 'Agent package not found on server'}, status=status.HTTP_404_NOT_FOUND)
        
        if DEBUG:
            logger.info(f"Successfully serving 'astraea_agent.tar.gz' to download")

        return FileResponse(
            open(self.AGENT_PATH, 'rb'), 
            as_attachment=True, 
            filename='astraea_agent.tar.gz'
        )

    def post(self, request):
        version = request.data.get('version')
        uploaded_file = request.FILES.get('script')

        # Validation
        if not version or not uploaded_file:
            return Response({'message': "Version and file are required."}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response({'message': "File too large (Max 10MB)."}, status=status.HTTP_400_BAD_REQUEST)
        
        filename = uploaded_file.name.lower()
        if not filename.endswith(self.ALLOWED_EXTENSIONS):
            return Response({'message': "Invalid file type. Please upload .zip or .tar."}, status=status.HTTP_400_BAD_REQUEST)

        
        # Ensure Directory Exists
        os.makedirs(self.STORAGE_DIR, exist_ok=True)

        final_path = self.AGENT_PATH
        temp_path = final_path + ".tmp"

        try:
            # Conversion logic, ensure output is always .tar.gz
            with tarfile.open(temp_path, "w:gz") as tar_out:
                if filename.endswith('.zip'):
                    with zipfile.ZipFile(uploaded_file) as zip_in:
                        for member in zip_in.infolist():
                            # extract data and add to tar
                            data = zip_in.read(member.filename)
                            tarinfo = tarfile.TarInfo(name=member.filename)
                            tarinfo.size = len(data)
                            tar_out.addfile(tarinfo, io.BytesIO(data))
            
                elif filename.endswith(('.tar', '.tar.gz')):
                    mode = "r:gz" if filename.endswith('.gz') else "r:"
                    with tarfile.open(fileobj=uploaded_file, mode=mode) as tar_in:
                        for member in tar_in.getmembers():
                            tar_out.addfile(member, tar_in.extractfile(member))
            
            # Update Database
            with transaction.atomic():
                # We use update_or_create to ensure we don't duplicate info records
                info, created = AstraeaAgentInfo.objects.get_or_create(id=1) 
                info.version = version
                info.save()

                # 5. Move temp file to final location after DB success
                shutil.move(temp_path, final_path)
            
            return Response({
                'message': f"Astraea Agent updated to {version}"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            # Cleanup temp file if something explodes
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return Response({'message': f"Internal error during processing: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetAgentInstallConfigs(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        configs = AgentInstallConfig.objects.all()

        data = [{
            'label': config.label,
            'key': str(config.api_key),
            'uid': config.uid,
            'exe_logic': config.exe_logic,
            'environment': config.environment,
            'disable_autoremove': config.disable_autoremove,
            'enable_apt_release_info_change': config.enable_apt_release_info_change,
            'reboot_on_success': config.reboot_on_success,
            'reboot_after_updates': config.reboot_after_updates,
            'max_allowed_uptime': config.max_allowed_uptime,
            'cron': config.cron,
            'patching_schedule': config.patching_schedule,
            'created_at': config.created_at
        } for config in configs]

        return Response(data, status=status.HTTP_200_OK)

class DeleteAgentInstallConfig(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        uid = request.data.get('uid')
        if not uid:
            return Response({'message': "Missing UID"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            config = get_object_or_404(AgentInstallConfig, uid=uid)
            created_at = config.created_at
            config.delete()
            if DEBUG:
                logger.info(f"Successfully deleted Agent Install Config made at {created_at}")
            return Response({'message': f'Successfully deleted Agent Install Config made at {created_at}"'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed deleting Agent Install Config: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)