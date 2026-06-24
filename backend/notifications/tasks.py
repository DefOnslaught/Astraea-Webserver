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

    n_settings = NotificationSettings.objects.first()
    if not n_settings:
        n_settings, _ = NotificationSettings.objects.get_or_create()
    

    check_field = 'out_of_date' if notification.status == 'outdated' else notification.status
    is_enabled = getattr(n_settings, check_field, True)

    if not is_enabled:
        if settings.DEBUG:
            logger.info(f"Notification {notification_id} suppressed by global settings.")
        # Mark as sent so it doesn't keep showing up in 'unresolved' lists
        notification.notifications_sent = True
        notification.save()
        return

    notification.last_attempt = timezone.now()
    notification.save()

    active_services = NotificationService.objects.filter(active=True)
    if not active_services.exists():
        return

    sent_service_ids = notification.successful_services.values_list('id', flat=True)
    
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

    # 4. Dispatch Loop
    for service in active_services:
        if service.id in sent_service_ids:
            continue

        s_type = service.type.lower()
        try:
            success = False
            
            # Webhook Delivery Channel
            if 'discord' in s_type:
                success = send_msg(
                    message=notification.msg, 
                    url=service.url, 
                    patch_status=notification.status,
                    report_details=report_details
                )
                
            # SMTP Delivery Channel
            elif 'email' in s_type or 'smtp' in s_type:
                recipient_list = list(User.objects.filter(is_active=True).values_list('email', flat=True))
                additional_recipients = service.recipients
                if additional_recipients:
                    extra_list = [r.strip() for r in additional_recipients.split(',') if r.strip()]
                    recipient_list.extend(extra_list)
                success = send_notification_email(notification, recipient_list)

            if success:
                notification.successful_services.add(service)
                
        except Exception as e:
            notification.retry_count += 1
            logger.error(f"Error sending to {service.name}: {str(e)}")

    notification.notifications_sent = True
    notification.save()
    if settings.DEBUG:
        logger.info(f"Successfully processed notification ID {notification_id}")


@shared_task
def reconcile_notifications():
    """Checks for notifications that are stuck or failed."""
    
    unresolved = PendingNotification.objects.filter(notifications_sent=False, retry_count__lt=5).order_by('-created_at')
    for note in unresolved:
        process_notification.delay(notification_id=note.id)


@shared_task
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


@shared_task
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