import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.conf import settings

from configuration.models import APIKey
from configuration.serializers import ApiKeyUpdateSerializer, APIKeySerializer

logger = logging.getLogger('django')

class CreateAPIKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = request.data.get('name', 'Unnamed Key')
        
        try:
            key_val = APIKey.generate_key()
            new_key = APIKey.objects.create(name=name, key=key_val)            
            serializer = APIKeySerializer(new_key)
            
            if settings.DEBUG:
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
            if settings.DEBUG:
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
            if settings.DEBUG:
                logger.info(f"Successfully deleted API Key `{key_name}`")
            return Response({'message': f'API Key {key_name} deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed deleting API Key: {str(e)}")
            return Response({'message': 'Internal server error processing data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)