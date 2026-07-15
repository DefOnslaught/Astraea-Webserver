import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

from servers.utils import format_duration

logger = logging.getLogger('django')

def send_notification_email(notification, recipient_list, report_details=None):
    if not settings.ENABLE_EMAIL:
        return False

    if report_details is None:
        report_details = {}

    status_clean = (notification.status or '').strip().lower()
    category = report_details.get('category', 'patching')
    
    context = {
        'msg': notification.msg,
        'status': status_clean,
        'created_at': notification.created_at,
        'server_name': report_details.get('server_name', 'System Cluster'),
        'status_color': '#3498db'
    }

    if category == 'update_check':
        template_name = 'email_update_template.html' 
        subject = "Astraea Alert: Maintenance / Updates Required"
        context['status_color'] = '#f39c12'
        context.update({
            'current_version': report_details.get('current_version', 'Unknown'),
            'target_version': report_details.get('target_version', 'Unknown'),
            'download_url': report_details.get('download_url', ''),
            'PATCH_THRESHOLD_DAYS': report_details.get('PATCH_THRESHOLD_DAYS', getattr(settings, 'PATCH_THRESHOLD_DAYS', 30))
        })
        
    elif category == 'server_lifecycle':
        template_name = 'email_server_lifecycle_template.html'
        subject = f"Astraea Alert: Server {status_clean.replace('_', ' ').title()}"
        
        if 'add' in status_clean:
            context['status_color'] = '#2ecc71'
        elif 'delete' in status_clean:
            context['status_color'] = '#e74c3c'
            
        context.update({
            'action': status_clean,
            'modified_by': report_details.get('modified_by', 'System Automatic Process'),
            'change_log': report_details.get('change_log', {})
        })
        
    else:
        template_name = 'email_patching_template.html'
        subject = f"Astraea Alert: Patching {status_clean.upper()}"
        
        if status_clean == 'success':
            context['status_color'] = '#2ecc71'
        elif status_clean in ['failed', 'error', 'partial']:
            context['status_color'] = '#e74c3c'
            
        context.update({
            'updates_count': report_details.get('updates_count', 0),
            'was_rebooted': report_details.get('was_rebooted', False),
            'duration': report_details.get('duration', 'N/A')
        })

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