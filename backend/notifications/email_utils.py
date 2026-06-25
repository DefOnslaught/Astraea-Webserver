import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

from servers.utils import format_duration

logger = logging.getLogger('django')

def send_notification_email(notification, recipient_list):
    if not settings.ENABLE_EMAIL:
        return False

    if notification.status == 'outdated':
        template_name = 'email_outdated_template.html'
        subject = "Astraea Alert: Servers Require Attention"
    else:
        template_name = 'email_patching_template.html'
        subject = f"Astraea Alert: Patching {notification.status.upper()}"

    duration_seconds = notification.extra_data.get('duration', 0)
    readable_duration = format_duration(duration_seconds)
    
    context = {
        'msg': notification.msg,
        'status': notification.status,
        'created_at': notification.created_at,
        'updates_count': notification.extra_data.get('updates_count', 0),
        'server_name': notification.extra_data.get('server_name', 'System Cluster'),
        'was_rebooted': notification.extra_data.get('was_rebooted', False),
        'duration': readable_duration,
        'status_color': '#2ecc71' if notification.status == 'success' else '#e74c3c' if notification.status == 'failed' else '#3498db',
        'PATCH_THRESHOLD_DAYS': settings.PATCH_THRESHOLD_DAYS
    }

    try:
        html_content = render_to_string(template_name, context)
        text_content = strip_tags(html_content)

        msg = EmailMultiAlternatives(
            subject,
            text_content,
            settings.EMAIL_HOST_USER,
            recipient_list
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        return True
    except Exception as e:
        logger.error(f"[Email Utils] SMTP Error: {str(e)}")
        return False


def send_test_email(name, recipient_list):
    """
    Sends test email for 'NotificationService' modal
    """
    if not settings.ENABLE_EMAIL:
        return False
    
    try:
        subject = f"Astraea Test"
        msg = f"Successfully sent test email for {name}"
        email = EmailMultiAlternatives(subject, msg, settings.EMAIL_HOST_USER, recipient_list)
        email.send()
        if settings.DEBUG:
            logger.info(f"Successfully sent test email for Notification Service {name}")
        return True
    except Exception as e:
        logger.error(f"[Email Utils] SMTP Error: {str(e)}")
        return False