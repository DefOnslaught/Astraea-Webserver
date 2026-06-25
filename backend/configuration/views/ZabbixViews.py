import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from configuration.models import ZabbixConfiguration
from configuration.serializers import ZabbixConfigSerializer
from configuration.utils import get_zabbix_config
from configuration.zabbix_utils import test_zabbix_connection

logger = logging.getLogger('django')


class ZabbixConfig(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config_data = get_zabbix_config()
        serializer = ZabbixConfigSerializer(config_data)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        payload = request.data.get('data', request.data)
        if not payload:
            return Response({'message': 'Missing required data'}, status=status.HTTP_400_BAD_REQUEST)
        
        config = ZabbixConfiguration.objects.first()
        if not config:
            config = ZabbixConfiguration()
        
        serializer = ZabbixConfigSerializer(config, data=payload, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            if settings.DEBUG:
                logger.info(f"Successfully updated Zabbix Settings")
            return Response({'message': 'Successfully updated Zabbix Settings'}, status=status.HTTP_200_OK)
        
        logger.error(f'Unable to update Zabbix Settings: {serializer.errors}') 
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TestZabbixConnection(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        settings_data = request.data.get('data') 
        
        if not settings_data:
            return Response({'message': "Configuration data is required to test the connection."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            test_zabbix_connection(settings_data)
            if settings.DEBUG:
                logger.info(f"Zabbix test connection successful!") 
            return Response({'message': "Connection successful!"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed Zabbix Connection Test: {str(e)}")
            return Response({'message': f"Connection failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)