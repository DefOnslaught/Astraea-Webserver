from django.db import models

from configuration.models import NotificationService

class PendingNotification(models.Model):

    msg = models.TextField()
    # Used to determine if the patching was  successful, partial, failed, or outdated
    status = models.CharField(max_length=10)
    notifications_sent = models.BooleanField(default=False, db_index=True)
    # Track which services have already received this specific notification
    # to avoid double-posting during retries.
    successful_services = models.ManyToManyField(NotificationService, blank=True, related_name="received_notifications")
    extra_data = models.JSONField(default=dict, blank=True) 
    last_attempt = models.DateTimeField(null=True, blank=True)
    retry_count = models.PositiveIntegerField(default=0, db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, help_text="For delayed notifications")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Pending Notifications"
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.status} ({self.created_at})"