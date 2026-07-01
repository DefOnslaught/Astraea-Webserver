import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.db.models import Q
from django.db import transaction
from django.contrib.auth import get_user_model

from servers.models import Server
from configuration.models import NotificationService, NotificationSettings
from configuration.utils import get_notification_config, get_notification_services
from .models import PendingNotification
from .discord_utils import send_msg
from .email_utils import send_notification_email
from servers.utils import format_duration

logger = logging.getLogger('django')
User = get_user_model()

@shared_task(bind=True, max_retries=3)
def process_notification(self, notification_id):
    try:
        with transaction.atomic():
            notification = PendingNotification.objects.select_for_update().select_related('server').get(id=notification_id)
            
            if notification.notifications_sent:
                return

            notification.last_attempt = timezone.now()
            notification.save()

    except PendingNotification.DoesNotExist:
        return
    

    if notification.server and not getattr(notification.server, 'enable_notifications', True):
        if settings.DEBUG:
            logger.info(f"Notification {notification_id} suppressed: Notifications disabled for server {notification.server.hostname}.")
        # Mark as sent
        notification.notifications_sent = True
        notification.save()
        return

    n_settings = get_notification_config()

    check_field = 'out_of_date' if notification.status == 'outdated' else notification.status
    is_enabled = n_settings.get(check_field, True)

    if not is_enabled:
        if settings.DEBUG:
            logger.info(f"Notification {notification_id} suppressed by global settings.")
        # Mark as sent so it doesn't keep showing up in 'unresolved' lists
        notification.notifications_sent = True
        notification.save()
        return

    notification.last_attempt = timezone.now()
    notification.save()
    
    duration_seconds = notification.extra_data.get('duration', 0)
    readable_duration = format_duration(duration_seconds)
    
    report_details = {
        'msg': notification.msg,
        'status': notification.status,
        'created_at': notification.created_at,
        'updates_count': notification.extra_data.get('updates_count', 0),
        'server_name': notification.extra_data.get('server_name', 'System Cluster'),
        'duration': readable_duration,
        'PATCH_THRESHOLD_DAYS': getattr(settings, 'PATCH_THRESHOLD_DAYS', 30)
    }

    all_services = get_notification_services()
    if not all_services:
        return

    sent_service_ids = notification.successful_services.values_list('id', flat=True)
    sent_service_ids_str = {str(sid) for sid in sent_service_ids}

    for service in all_services:

        if not service.get('active', False):
            continue

        if str(service['id']) in sent_service_ids_str:
            continue

        s_type = service.get('type', '').lower() 
        try:
            success = False
            if 'discord' in s_type:
                success = send_msg(
                    message=notification.msg, 
                    url=service.get('url'),
                    patch_status=notification.status,
                    report_details=report_details
                )
                
            elif 'email' in s_type or 'smtp' in s_type:
                if not service.get('email_all_users', True):
                    recipient_list = service.get('main_email_recipients', '')
                    recipient_list = [r.strip() for r in recipient_list.split(',') if r.strip()] if recipient_list else []
                else:
                    recipient_list = list(User.objects.filter(is_active=True).values_list('email', flat=True))
                
                additional_recipients = service.get('recipients')
                if additional_recipients:
                    extra_list = [r.strip() for r in additional_recipients.split(',') if r.strip()]
                    recipient_list.extend(extra_list)
                    
                recipient_list = list(set(recipient_list))
                
                if recipient_list:
                    success = send_notification_email(notification, recipient_list)
                else:
                    success = False

            if success:
                notification.successful_services.add(service['id'])
                
        except Exception as e:
            notification.retry_count += 1
            service_name = service.get('name', 'Unknown Service')
            logger.error(f"Error sending to {service_name}: {str(e)}")

    notification.notifications_sent = True
    notification.save()
    if settings.DEBUG:
        logger.info(f"Successfully processed notification ID {notification_id}")


@shared_task(name="notifications.tasks.reconcile_notifications")
def reconcile_notifications():
    """Checks for notifications that are stuck or failed."""
    
    unresolved = PendingNotification.objects.filter(notifications_sent=False, retry_count__lt=5).order_by('-created_at')
    for note in unresolved:
        process_notification.delay(notification_id=note.id)


@shared_task(name="notifications.tasks.delete_sent_notifications")
def delete_sent_notifications():
    """Deletes notifications that have been sent, or max retries."""

    all_expired = PendingNotification.objects.filter(
        Q(notifications_sent=True) | Q(retry_count__gte=5)
    )

    count = all_expired.count()
    if count == 0:
        if settings.DEBUG:
            logger.info("No expired notifications found to delete.")
        return

    deleted_count, _ = all_expired.delete()
    
    if settings.DEBUG:
        logger.info(f"Cleanup complete. Removed {deleted_count} notifications.")


@shared_task(name="notifications.tasks.notify_out_of_date")
def notify_out_of_date():
    """Consolidates outdated servers into a single notification."""
    days = int(settings.PATCH_THRESHOLD_DAYS)
    time_threshold = timezone.now() - timedelta(days=days)

    # servers that haven't been patched in 'X' days OR have never been patched (null)
    outdated_servers = Server.objects.filter(
        Q(last_patch_date__lt=time_threshold) | Q(last_patch_date__isnull=True)
    )

    if outdated_servers.exists():
        count = outdated_servers.count()
        server_list = ", ".join([s.hostname for s in outdated_servers[:5]])
        msg = f"Alert: {count} servers are outdated. Highlights: {server_list}"
        if count > 5:
            msg += " ..."
         
        PendingNotification.objects.create(msg=msg, status="outdated")