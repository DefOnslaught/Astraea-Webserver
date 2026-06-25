import logging
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from users.serializers import UserSerializer, ChangePasswordSerializer

logger = logging.getLogger('django')
User = get_user_model()


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        # 'partial=True' allows updating just the username without sending the whole object
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"User '{request.user.email}' successfully updated profile.")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"Failed to update profile for '{request.user}': {str(serializer.errors)}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})

        if not serializer.is_valid():
            logger.error(f"User '{request.user.email}' failed to provide proper data to change their password. {str(serializer.errors)}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()  
        logger.info(f"User '{request.user.email}' successfully changed password.")
        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)