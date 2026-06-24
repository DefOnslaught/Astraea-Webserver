import logging
from celery import shared_task
from django.db import transaction
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

from .utils import cacheVerificationStatus
from .models import Verification

logger = logging.getLogger('django')
User = get_user_model()

@shared_task
def create_bulk_verify_existing_users():
    users_without_v = User.objects.filter(verification__isnull=True, is_active=True)
    
    new_records = [
        Verification(user=user, is_verified=True) 
        for user in users_without_v
    ]
    
    if new_records:
        with transaction.atomic():
            Verification.objects.bulk_create(new_records, ignore_conflicts=True)

        cacheVerificationStatus()

    return f"Bulk verified {len(new_records)} users."


@shared_task(bind=True)
def send_verification_email(self, email, username, token, expiry):
    """Sends an email to the specified user with the verification token"""

    expiry = int(expiry)
    if expiry >= 60:
        hours = expiry // 60
        minutes = expiry % 60
        time_str = f"{hours} hour{'s' if hours > 1 else ''}"
        if minutes > 0:
            time_str += f" and {minutes} minute{'s' if minutes > 1 else ''}"
    else:
        time_str = f"{expiry} minute{'s' if expiry != 1 else ''}"

    verify_url = f"{settings.BASE_URL}/verify/{token}/"
    template_name = "verification_email_template.html"
    subject = "Astraea - Verify Your Account"
    context = {
        'username': username,
        'verify_url': verify_url,
        'expiry_display': time_str    
    }

    try:
        html_content = render_to_string(template_name, context)
        text_content = strip_tags(html_content)
        
        msg = EmailMultiAlternatives(
            subject,
            text_content,
            settings.EMAIL_HOST_USER,
            [email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        if settings.DEBUG:
            logger.info(f"Successfully sent verification email to `{email}`")
    except Exception as e:
        logger.error(f"[Email Verification] SMTP Error: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)
    

@shared_task(bind=True)
def send_reset_password_email(self, email, username, token, expiry):
    """Sends an email to the specified user with the reset password token"""

    expiry = int(expiry)
    if expiry >= 60:
        hours = expiry // 60
        minutes = expiry % 60
        time_str = f"{hours} hour{'s' if hours > 1 else ''}"
        if minutes > 0:
            time_str += f" and {minutes} minute{'s' if minutes > 1 else ''}"
    else:
        time_str = f"{expiry} minute{'s' if expiry != 1 else ''}"
    
    reset_url = f"{settings.BASE_URL}/forgot-password/{token}/"
    template_name = "reset_password_email_template.html"
    subject = "Astraea - Reset Your Password"
    context = {
        'username': username,
        'reset_url': reset_url,
        'expiry_display': time_str    
    }

    try:
        html_context = render_to_string(template_name, context)
        text_context = strip_tags(html_context)

        msg = EmailMultiAlternatives(
            subject,
            text_context,
            settings.EMAIL_HOST_USER,
            [email]    
        )
        msg.attach_alternative(html_context, "text/html")
        msg.send()

        if settings.DEBUG:
            logger.info(f"Successfully sent password reset email to `{email}`")
    except Exception as e:
        logger.error(f"[Email Reset Password] SMTP Error: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)
    

@shared_task(bind=True)
def send_password_changed_email(self, email, username):
    """Sends an email to the specified user notifying them of the password change"""

    template_name = "password_reset_notify_email_template.html"
    subject = "Astraea - Password Been Reset"
    context = {
        'username': username,
    }

    try:
        html_context = render_to_string(template_name, context)
        text_context = strip_tags(html_context)

        msg = EmailMultiAlternatives(
            subject,
            text_context,
            settings.EMAIL_HOST_USER,
            [email]    
        )
        msg.attach_alternative(html_context, "text/html")
        msg.send()

        if settings.DEBUG:
            logger.info(f"Successfully sent password reset email to `{email}`")
    except Exception as e:
        logger.error(f"[Email Password Reset Notify] SMTP Error: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)