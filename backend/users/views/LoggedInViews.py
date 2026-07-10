import logging
from datetime import timezone as timezone_default
from datetime import datetime
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from users.utils import set_auth_cookies
from users.serializers import UserSerializer

logger = logging.getLogger('django')
User = get_user_model()


class BasicUserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionExtendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token_str = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])

        if not refresh_token_str:
            logger.error(f"Invalid Refresh Token for user '{request.user.email}' - attempted to renew session")
            return Response({"message": "No refresh token provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            old_token = RefreshToken(refresh_token_str)

            new_token = RefreshToken.for_user(request.user)

            old_token.blacklist()

            response = Response({"message": "Session extended"}, status=status.HTTP_200_OK)
            logger.info(f"Successfully extended the Refresh Token for user '{request.user.email}'")
            return set_auth_cookies(
                response, 
                str(new_token.access_token), 
                str(new_token)
            )
        except Exception as e:
            logger.error(f"Unable to extended the Refresh Token for user '{request.user.email}'")
            return Response({"message": "Invalid session"}, status=status.HTTP_400_BAD_REQUEST)


class SessionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        access_token = request.auth
        
        refresh_token_str = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])

        if not refresh_token_str:
            return Response({"message": "Refresh token missing"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh_token = RefreshToken(refresh_token_str)
            refresh_exp = refresh_token.payload['exp']
        except TokenError:
            return Response({"message": "Session expired or invalid"}, status=status.HTTP_401_UNAUTHORIZED)
        
        now = datetime.now(timezone_default.utc).timestamp()

        return Response({
            "remaining_seconds": max(0, int(access_token.payload['exp'] - now)),
            "refresh_remaining": max(0, int(refresh_exp - now)),
            "username": request.user.username,
            "email": request.user.email,
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
        })