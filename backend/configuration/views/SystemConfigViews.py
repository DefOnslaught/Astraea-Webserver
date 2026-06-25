import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from configuration.models import SysConfig
from configuration.serializers import SysConfigSerializer
from configuration.utils import get_sys_config

logger = logging.getLogger('django')


class SystemConfig(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = get_sys_config()
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request):
        config = SysConfig.objects.first()
        if not config:
            config = SysConfig()

        payload = request.data.get('data', request.data)
        if not payload:
            return Response({'message': 'Missing required data'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SysConfigSerializer(config, data=payload, partial=True)

        if serializer.is_valid():
            serializer.save()
            if settings.DEBUG:
                logger.info(f"Successfully updated System Settings")
            return Response({'message': 'Successfully updated System Settings'}, status=status.HTTP_200_OK)

        logger.error(f'Unable to update System Settings: {serializer.errors}') 
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)