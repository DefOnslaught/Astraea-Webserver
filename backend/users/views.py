import logging
from datetime import datetime, timezone
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .serializers import RegisterSerializer, TokenOPSerializer, UserSerializer

logger = logging.getLogger('django')

def set_auth_cookies(response, access_token, refresh_token):
    """Helper to set tokens in HttpOnly cookies"""
    response.set_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        value=access_token,
        max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
        httponly=True,
        secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
        samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
    )
    response.set_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
        value=refresh_token,
        max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
        httponly=True,
        secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
        samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
    )
    return response

class RegisterView(generics.CreateAPIView):
    queryset = None
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        
        try:
            if serializer.is_valid(raise_exception=True):
                user = serializer.save()
                refresh = RefreshToken.for_user(user)
                
                logger.info(f"New user '{request.data.get('email')}' has been created successfully")
                response = Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
                return set_auth_cookies(response, str(refresh.access_token), str(refresh))
        
        except serializers.ValidationError:
            # This catches things like 'email already exists' or 'password too short'
            logger.error(f"Registration validation failed for {request.data.get('email')}: {serializer.errors}")
            return Response(
                {"message": "An account with this email/username already exists or the data is invalid."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected registration error: {str(e)}")
            return Response(
                {"message": "An unexpected error occurred. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(sensitive_post_parameters('password'), name='dispatch')
class TokenOPView(TokenObtainPairView):
    serializer_class = TokenOPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            logger.info(f"User '{request.data.get('email')}' has logged in successfully")
        except (InvalidToken, TokenError, Exception):
            return Response(
                {"message": "Invalid email or password"}, 
                status=status.HTTP_406_NOT_ACCEPTABLE
            )

        response = Response({"message": "Login Success"}, status=status.HTTP_200_OK)
        return set_auth_cookies(
            response, 
            serializer.validated_data['access'], 
            serializer.validated_data['refresh']
        )


class CSRFTokenView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"message": "CSRF cookie set"})


class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
        
        if refresh_token:
            # Put the cookie value into the request data so the parent class can find it
            request.data['refresh'] = refresh_token
            
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            access_token = response.data.get('access')
            # 2. FALLBACK: Use the new refresh token if provided (Rotation: True)
            # OR keep using the existing one (Rotation: False)
            refresh_token = response.data.get('refresh') or refresh_token
            
            set_auth_cookies(response, access_token, refresh_token)
            
            response.data = {"message": "Token refreshed"}
            
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            if not refresh_token:
                return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            response = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            return response
        except Exception as e:
            logger.error(f"Error logging user '{request.data.get('email')}' out, {str(e)}")
            response = Response({"message": "Logged out with errors"}, status=status.HTTP_204_NO_CONTENT)
            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            return response


class LogoutAllDevicesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tokens = OutstandingToken.objects.filter(user=request.user)

        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)
        
        logger.info(f"User '{request.user.email}' logged out of all devices successfully.")
        return Response({"message": "Successfully logged out of all devices"}, status=status.HTTP_205_RESET_CONTENT)


class BasicUserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        access_token = request.auth
        
        # Get the Refresh Token from cookies to check its expiry
        refresh_token_str = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
        refresh_token = RefreshToken(refresh_token_str)
        
        refresh_exp = refresh_token.payload['exp']
        now = datetime.now(timezone.utc).timestamp()

        return Response({
            "remaining_seconds": max(0, int(access_token.payload['exp'] - now)),
            "refresh_remaining": max(0, int(refresh_exp - now)),
            "username": request.user.username,
            "email": request.user.email,
        })


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get profile stuff
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Example for now
    def put(self, request):
        # 'partial=True' allows updating just the username without sending the whole object
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"User '{request.user.email}' successfully updated profile.")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"Failed to update profile for '{request.user}': {str(serializer.errors)}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)