import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.conf import settings

from configuration.models import NotificationSettings, NotificationService
from configuration.serializers import NotificationServiceSerializer, NotificationSettingsSerializer
from configuration.utils import get_notification_config, get_notification_services

logger = logging.getLogger('django')


class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = get_notification_config()
        serializer = NotificationSettingsSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        payload = request.data.get('data', request.data)
        if not payload:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        notify_settings = NotificationSettings.objects.first()
        if not notify_settings:
            notify_settings = NotificationSettings()

        serializer = NotificationSettingsSerializer(notify_settings, data=payload, partial=True)

        if serializer.is_valid():
            serializer.save()
            if settings.DEBUG:
                logger.info(f"Successfully updated Notification Settings")
            return Response({'message': 'Successfully updated Notification Settings'}, status=status.HTTP_200_OK)

        logger.error(f'Unable to update Notification Settings: {serializer.errors}') 
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationServicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        services = get_notification_services()
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
            'email_all_users': data.get('email_all_users', True),
            'main_email_recipients': data.get('main_email_recipients') if data.get('type') == 'smtp' else None,
            'active': data.get('active', True)
        }

        serializer = NotificationServiceSerializer(data=processed_data)
        if serializer.is_valid():
            serializer.save()
            if settings.DEBUG:
                logger.info(f"Successfully created Notification Service: {data.get('name')}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        if settings.DEBUG:
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

        if 'email_all_users' in data: 
            update_fields['email_all_users'] = data['email_all_users']
        
        is_smtp = data.get('type') == 'smtp' or (not data.get('type') and service.type == 'smtp')
        
        if is_smtp:
            if 'recipients' in data:
                update_fields['recipients'] = data['recipients']
            if 'main_email_recipients' in data:
                update_fields['main_email_recipients'] = data['main_email_recipients']

        serializer = NotificationServiceSerializer(service, data=update_fields, partial=True)

        if serializer.is_valid():
            serializer.save()
            if settings.DEBUG:
                logger.info(f"Successfully updated Notification Service: {service.name}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        if settings.DEBUG:
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
        if settings.DEBUG:
                logger.info(f"Successfully deleted Notification Service {service_name}")
        return Response({'message': f'Successfully deleted Notification Service {service_name}'}, status=status.HTTP_200_OK)