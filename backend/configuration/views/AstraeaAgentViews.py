import logging, os, tarfile, io, zipfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, FileResponse
from django.template import Context, Template
from django.db import transaction
from django.conf import settings

from configuration.models import AgentInstallConfig, AstraeaAgentInfo
from configuration.serializers import AgentInstallConfigSerializer
from servers.permissions import HasInternalAPIKey

logger = logging.getLogger('django')


class AgentCreateConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        data = request.data
        if data is None:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = AgentInstallConfigSerializer(data=data)
        
        if serializer.is_valid():
            config = serializer.save()
            
            if settings.DEBUG:
                logger.info(f"Successfully created Agent Install UUID `{config.uid}`")

            return Response({
                'uuid': config.uid,
                'message': "Deployment configuration stored successfully."
            }, status=status.HTTP_201_CREATED)
        
        if settings.DEBUG:
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

        script_path = os.path.join(settings.BASE_DIR, 'configuration', 'scripts', filename)
        
        if not os.path.exists(script_path):
            if settings.DEBUG:
                logger.info(f'Script {filename} not found on server')
            return Response({'message': f'Script {filename} not found on server'}, status=status.HTTP_404_NOT_FOUND)

        with open(script_path, 'r') as f:
            script_content = f.read()
        
        template = Template(script_content)
        context = Context({
            'API_KEY': config.api_key.key,
            'ENVIRONMENT': config.environment,
            'CRON': config.cron,
            'PATCHING_SCHEDULE': config.patching_schedule,
            'EXE_LOGIC': config.exe_logic,
            'BASE_URL': config.base_url or f"{request.scheme}://{request.get_host()}",
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

        if settings.DEBUG:
            logger.info(f'Successfully sending Agent Install Script')
        return response


class AgentFileHandlerView(APIView):
    permission_classes = [HasInternalAPIKey]

    def get(self, request):
        file_path = os.path.join(settings.BASE_DIR, 'protected_storage', 'astraea_agent.tar.gz')
        
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


class AgentUploadHandlerView(APIView):
    permission_classes = [IsAuthenticated]

    MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB limit
    ALLOWED_EXTENSIONS = ('.zip', '.tar', '.tar.gz')
    STORAGE_DIR = os.path.join(settings.BASE_DIR, 'protected_storage')
    AGENT_FILE = 'astraea_agent.tar.gz'
    AGENT_PATH = os.path.join(STORAGE_DIR, AGENT_FILE)

    def get(self, request):
        get_version = request.query_params.get('version')
        if get_version:
            info, created = AstraeaAgentInfo.objects.get_or_create(id=1)
            return Response({'version': info.version}, status=status.HTTP_200_OK)
        
        if not os.path.exists(self.AGENT_PATH):
            if settings.DEBUG:
                logger.error(f'Agent package not found on server')
            return Response({'message': 'Agent package not found on server'}, status=status.HTTP_404_NOT_FOUND)
        
        if settings.DEBUG:
            logger.info(f"Successfully serving 'astraea_agent.tar.gz' to download")

        return FileResponse(
            open(self.AGENT_PATH, 'rb'), 
            as_attachment=True, 
            filename='astraea_agent.tar.gz'
        )

    def post(self, request):
        version = request.data.get('version')
        uploaded_file = request.FILES.get('script')

        if not version or not uploaded_file:
            return Response({'message': "Version and file are required."}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response({'message': "File too large (Max 2MB)."}, status=status.HTTP_400_BAD_REQUEST)
        
        filename = uploaded_file.name.lower()
        if not filename.endswith(self.ALLOWED_EXTENSIONS):
            return Response({'message': "Invalid file type. Please upload .zip or .tar."}, status=status.HTTP_400_BAD_REQUEST)
        

        extracted_version = _extract_version_from_archive(uploaded_file, filename)
        
        if not extracted_version:
            return Response({'message': "Uploaded file does not contain a valid version.txt"}, status=400)

        if extracted_version != version:
            return Response({
                'message': f"Version mismatch! Form says {version}, but archive says {extracted_version}."
            }, status=400)

        
        os.makedirs(self.STORAGE_DIR, exist_ok=True)

        final_path = self.AGENT_PATH
        temp_path = final_path + ".tmp"

        def _is_forbidden_file(filename):
            parts = os.path.normpath(filename).split(os.sep)
            
            if '.git' in parts:
                return True
            
            forbidden_files = {'.env', '.DS_Store', '.gitignore'}
            if os.path.basename(filename) in forbidden_files:
                return True
                
            return False
        
        def _is_safe_path(basedir, path):
            target = os.path.join(basedir, path)
            return os.path.abspath(target).startswith(os.path.abspath(basedir))
        
        def _get_normalized_name(name):
            if name in ['Astraea Agent/', 'Astraea_Agent/', 'Astraea-Agent/']:
                return None
            
            for prefix in ['Astraea Agent/', 'Astraea_Agent/']:
                if name.startswith(prefix):
                    return name.replace(prefix, 'Astraea-Agent/', 1)
            return name

        uploaded_file.seek(0)
        try:
            with tarfile.open(temp_path, "w:gz") as tar_out:
                if filename.endswith('.zip'):
                    with zipfile.ZipFile(uploaded_file) as zip_in:
                        for member in zip_in.infolist():
                            if _is_forbidden_file(member.filename): continue
                            
                            new_name = _get_normalized_name(member.filename)
                            if not new_name: continue 
                            if not _is_safe_path(self.STORAGE_DIR, new_name): continue

                            if not member.is_dir():
                                data = zip_in.read(member.filename)
                                tarinfo = tarfile.TarInfo(name=new_name)
                                tarinfo.size = len(data)
                                tar_out.addfile(tarinfo, io.BytesIO(data))
                
                else: # Tar/Tar.gz
                    with tarfile.open(fileobj=uploaded_file, mode="r:*") as tar_in:
                        for member in tar_in.getmembers():
                            if _is_forbidden_file(member.name): continue
                            
                            new_name = _get_normalized_name(member.name)
                            if not new_name: continue
                            
                            member.name = new_name
                            if not _is_safe_path(self.STORAGE_DIR, member.name): continue
                            
                            if member.isfile() or member.islnk() or member.issym():
                                f = tar_in.extractfile(member)
                                if f: tar_out.addfile(member, f)
            
            os.replace(temp_path, final_path)
            
            with transaction.atomic():
                info, created = AstraeaAgentInfo.objects.get_or_create(id=1) 
                info.version = version
                info.save()
            
            return Response({
                'message': f"Astraea Agent updated to {version}"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            logger.error(f"Error saving agent upload: {str(e)}")
            return Response({'message': f"Internal error during processing: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _extract_version_from_archive(uploaded_file, filename):
    """Peek inside the tar/zip to find the version.txt file."""
    uploaded_file.seek(0)
    prefixes = ['', 'Astraea Agent/', 'Astraea_Agent/', 'Astraea-Agent/']
    if filename.endswith('.zip'):
        with zipfile.ZipFile(uploaded_file) as z:
            namelist = z.namelist()
            for prefix in prefixes:
                path = f"{prefix}version.txt"
                if path in namelist:
                    with z.open(path) as f:
                        return f.read().decode().strip().split('=')[-1].strip("'\"")
    else:
        with tarfile.open(fileobj=uploaded_file, mode="r:*") as t:
            for prefix in prefixes:
                path = f"{prefix}version.txt"
                try:
                    f = t.extractfile(path)
                    if f:
                        return f.read().decode().strip().split('=')[-1].strip("'\"")
                except (KeyError, tarfile.ReadError):
                    continue
    return None


class GetAgentInstallConfigs(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        configs = AgentInstallConfig.objects.all()

        data = [{
            'label': config.label,
            'key': str(config.api_key),
            'base_url': config.base_url,
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
            if settings.DEBUG:
                logger.info(f"Successfully deleted Agent Install Config made at {created_at}")
            return Response({'message': f'Successfully deleted Agent Install Config made at {created_at}"'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed deleting Agent Install Config: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)