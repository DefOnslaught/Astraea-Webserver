import logging, uuid
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from users.models import ResetPassword
from users.validators import ComplexityValidator
from users.tasks import send_reset_password_email, send_password_changed_email

logger = logging.getLogger('django')
User = get_user_model()


class ResetPasswordView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'message': "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.filter(email=email).first()
        
        # Security: Always return 200 for missing/inactive users
        if not user or not user.is_active:
            return Response({
                    'message': "Successfully processed request.", 
                    "expires": settings.RESET_LINK_EXPIRY_MINUTES
            }, status=status.HTTP_200_OK)
        
        try:
            with transaction.atomic():
                reset, created = ResetPassword.objects.get_or_create(user=user)
                
                if not created and reset.last_sent_at:
                    if timezone.now() - reset.last_sent_at < timedelta(minutes=5):
                        return Response(
                            {'message': "Please wait 5 minutes before requesting another link."}, 
                            status=status.HTTP_429_TOO_MANY_REQUESTS
                        )

                if not created and reset.resend_request >= 3:
                    return Response(
                        {'message': "Too many reset attempts. Please contact the system administrator."}, 
                        status=status.HTTP_429_TOO_MANY_REQUESTS
                    )

                reset.token = uuid.uuid4() 
                reset.last_sent_at = timezone.now()
                reset.resend_request = 1 if created else reset.resend_request + 1
                reset.is_reset = False
                reset.save()

            send_reset_password_email.delay(
                email=email, 
                username=user.username, 
                token=str(reset.token), 
                expiry=settings.RESET_LINK_EXPIRY_MINUTES
            )

            return Response({
                "message": "Successfully processed request.",
                "expires": settings.RESET_LINK_EXPIRY_MINUTES
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Internal error during reset password: {str(e)}")
            return Response({"message": "Server error during reset password."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProcessPasswordResetView(APIView):
    permission_classes = []

    def post(self, request):
        token_str = request.data.get("token")
        password = request.data.get("password")
        
        if not token_str or not password:
            return Response({"message": "Missing required data."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            reset = ResetPassword.objects.get(token=token_str)
        except ResetPassword.DoesNotExist:
            return Response({'message': "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        
        expiry_limit = timedelta(minutes=settings.RESET_LINK_EXPIRY_MINUTES)
        if timezone.now() - reset.last_sent_at > expiry_limit:
            reset.delete()
            return Response({'message': "Link has expired."}, status=status.HTTP_400_BAD_REQUEST)

        user = reset.user
        if not user or not user.is_active:
            return Response({'message': "Unable to process request."}, status=status.HTTP_404_NOT_FOUND)
        
        validator = ComplexityValidator(min_length=8)
        try:
            validator.validate(password)
        except ValidationError as e:
            return Response({'message': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            user.password = make_password(password)
            user.save()
            reset.delete()

        send_password_changed_email.delay(user.email, user.username)

        return Response({"message": "Password successfully updated. You can now log in."}, status=status.HTTP_200_OK)