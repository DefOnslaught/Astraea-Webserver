import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from django.db import transaction

from .serializers import UserSerializer
from users.serializers import RegisterSerializer

logger = logging.getLogger('django')
User = get_user_model()

class FetchUsers(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            users = User.objects.all().order_by('-date_joined')
            serializer = UserSerializer(users, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to fetch users. {str(e)}")
            return Response({'message': 'Internal server error fetching user list.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InspectUser(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            user = get_object_or_404(User, username=username)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to load user data. {str(e)}")
            return Response({'message': 'Internal server error loading user data.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

    def patch(self, request, username):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, username=username)
        new_password = request.data.get('password')
        
        if new_password:
            try:
                password_validation.validate_password(new_password, user=user)
            except ValidationError as e:
                return Response({'message': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UserSerializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    if new_password:
                        user.set_password(new_password)
                        user.save()
                    
                    serializer.save()
                    logger.info(f"Successfully updated user `{username}`")
                    return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error updating user: {str(e)}")
                return Response({'message': 'Internal server error processing update'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.error(f"Error updating user: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CreateNewUser(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
                return Response({
                    'message': f'Account for {user.username} created successfully.',
                    'id': user.id
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Unable create new user. {str(e)}")
                return Response({'message': 'Internal server error during user creation.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)