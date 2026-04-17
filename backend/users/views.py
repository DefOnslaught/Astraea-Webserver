import logging, uuid
from datetime import timezone as timezone_default
from datetime import datetime, timedelta
from django.utils import timezone
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
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

from .serializers import RegisterSerializer, TokenOPSerializer, UserSerializer, ChangePasswordSerializer
from .models import Verification
from .utils import updateCacheVerificationStatus, isUserVerified
from .tasks import send_verification_email
from configuration.utils import get_sys_config

logger = logging.getLogger('django')
User = get_user_model()

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


def return_login_response(user, message):
    """Helper to return the needed values when logging in"""
    return Response({
        'message': message,
        "user": {
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser
        }
    }, status=status.HTTP_200_OK)


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


class VerificationVerifyView(APIView):
    permission_classes = []

    def post(self, request):
        token_str = request.data.get("token")
        if not token_str:
            return Response({"message": "Missing required token."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            verification = Verification.objects.select_related('user').get(token=token_str)
        except Verification.DoesNotExist:
            return Response({"message": "Invalid verification link"}, status=status.HTTP_404_NOT_FOUND)

        if verification.is_verified:
            return Response({"message": "Account already verified. Please log in."}, status=status.HTTP_406_NOT_ACCEPTABLE)
        
        is_expired = False
        if settings.VERIFY_LINK_EXPIRY_MINUTES > 0 and verification.last_sent_at:
            expiry_limit = timezone.now() - timedelta(minutes=settings.VERIFY_LINK_EXPIRY_MINUTES)
            if verification.last_sent_at < expiry_limit:
                is_expired = True

        if is_expired:
            return Response({"message": "Verification link has expired."}, status=status.HTTP_418_IM_A_TEAPOT)
        
        user = verification.user

        if not user.is_active:
            return Response({'message': "Account is disabled."}, status=status.HTTP_406_NOT_ACCEPTABLE)

        try:
            with transaction.atomic():
                verification.is_verified = True
                verification.token = uuid.uuid4() # Rotate it so it's one-time use
                verification.save()
                
                updateCacheVerificationStatus(user.id, True)

            refresh = RefreshToken.for_user(user)
            response = return_login_response(user, "Successfully verified")

            return set_auth_cookies(response, str(refresh.access_token), str(refresh))

        except Exception as e:
            logger.error(f"Internal error during verification save: {str(e)}")
            return Response({"message": "Server error during verification."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerificationResendView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'message': "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            verification = Verification.objects.select_related('user').get(user__email=email)
        except Verification.DoesNotExist:
            return Response({'message': "If an account exists, a new link has been sent."}, status=status.HTTP_200_OK)

        if verification.is_verified:
            return Response({'message': "Account is already verified."}, status=status.HTTP_406_NOT_ACCEPTABLE)

        if verification.resend_request >= 5:
            return Response({'message': "Too many attempts. Contact support."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if verification.last_sent_at and verification.last_sent_at > timezone.now() - timedelta(minutes=5):
            return Response({'message': "Please wait 5 minutes before requesting another link."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        try:
            with transaction.atomic():
                verification.token = uuid.uuid4() # New token for the new email
                verification.resend_request += 1
                verification.last_sent_at = timezone.now()
                verification.save()
            
            send_verification_email.delay(email=verification.user.email, username=verification.user.username, token=str(verification.token), expiry=settings.VERIFY_LINK_EXPIRY_MINUTES)
            
            return Response({'message': "A new verification link has been sent."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Resend error: {str(e)}")
            return Response({'message': "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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


class SessionExtendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(get, request):
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
            logger.error(f"Enable to extended the Refresh Token for user '{request.user.email}'")
            return Response({"message": "Invalid session"}, status=status.HTTP_400_BAD_REQUEST)


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


class BasicUserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


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