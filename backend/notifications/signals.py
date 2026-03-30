from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PendingNotification
from .tasks import process_notification

@receiver(post_save, sender=PendingNotification)
def process_notifications_on_save(sender, instance, created, **kwargs):
    if created:
        process_notification.delay(instance.id)