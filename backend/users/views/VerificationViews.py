import logging, uuid
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import Verification
from users.utils import updateCacheVerificationStatus, return_login_response, set_auth_cookies
from users.tasks import send_verification_email

logger = logging.getLogger('django')
User = get_user_model()

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