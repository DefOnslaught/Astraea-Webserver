import logging
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from users.serializers import RegisterSerializer, TokenOPSerializer
from users.models import Verification
from users.utils import isUserVerified, set_auth_cookies, return_login_response
from users.tasks import send_verification_email
from configuration.utils import get_sys_config

logger = logging.getLogger('django')
User = get_user_model()

@method_decorator(sensitive_post_parameters('password'), name='dispatch')
class TokenOPView(TokenObtainPairView):
    serializer_class = TokenOPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError, Exception) as e:
            logger.error(f"Login failed for {request.data.get('email')}: {str(e)}")
            return Response({"message": "Invalid email or password"}, status=status.HTTP_406_NOT_ACCEPTABLE)

        user = serializer.user
        sys_config = get_sys_config()
        
        if not sys_config.get('skip_email_validation'):
            if not isUserVerified(user):
                return Response({"message": "Account is not verified. Please check your email."}, status=status.HTTP_406_NOT_ACCEPTABLE)

        logger.info(f"User '{user.email}' logged in successfully")
        response = return_login_response(user, "Login Success")

        return set_auth_cookies(
            response, 
            serializer.validated_data['access'], 
            serializer.validated_data['refresh']
        )


class RegisterView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer
    
    def post(self, request, *args, **kwargs):
        sys_config = get_sys_config()
        skip_email = sys_config.get('skip_email_validation')
        if sys_config.get('disable_registration'):
            return Response({"message": "Registration is disabled."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

        serializer = self.get_serializer(data=request.data)  

        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            if not skip_email:
                email = request.data.get('email')
                user = User.objects.filter(email=email).first()
                if user:
                    # Check cache or DB for verification status
                    if not isUserVerified(user):
                        return Response({
                            "requires_verification": True,
                            "message": "This account is awaiting verification. Please check your inbox or request a new link."
                        }, status=status.HTTP_200_OK)

            return Response({"message": "An account with this email/username already exists or the data is invalid."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                user = serializer.save()
                verification = Verification.objects.create(user=user, is_verified=skip_email)

            if not skip_email:
                email = user.email
                send_verification_email.delay(email=email, username=user.username, token=verification.token, expiry=settings.VERIFY_LINK_EXPIRY_MINUTES)
                logger.info(f"User '{email}' created; verification required.")
                return Response({
                    "requires_verification": True,
                    "email": email,
                    "expiry": settings.VERIFY_LINK_EXPIRY_MINUTES,
                    "message": "Verification email sent."
                }, status=status.HTTP_201_CREATED)

            refresh = RefreshToken.for_user(user)
            logger.info(f"User '{user.email}' created and auto-logged in.")
            
            response = Response({
                "requires_verification": False,
                "message": "User created successfully",
                "user": { "username": user.username, "email": user.email }
            }, status=status.HTTP_201_CREATED)
            
            return set_auth_cookies(response, str(refresh.access_token), str(refresh))

        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response({"message": "Error creating account."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        response = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
        
        try:
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except (TokenError, Exception) as e:
            # If the token is invalid/expired, we don't care, we still want to clear cookies
            logger.info(f"Logout cleanup for {request.user}: {str(e)}")
        
        # Always clear cookies regardless of blacklist success
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
        logger.info(f"Successfully logged out '{request.user}' ")
        return response


class LogoutAllDevicesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tokens = OutstandingToken.objects.filter(user=request.user)

        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)
        
        # Use 200 OK so the frontend definitely sees the success message
        response = Response({"message": "Successfully logged out of all devices"}, status=status.HTTP_200_OK)
        
        # MUST clear cookies so the current device is kicked immediately
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
        return response