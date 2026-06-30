import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import ReportFilter, ReportRequest
from .utils import invalidate_public_global_filters, invalidate_user_filters

logger = logging.getLogger('django')

@receiver([post_save, post_delete], sender=ReportFilter)
def invalidate_report_filters_cache(sender, instance, **kwargs):
    invalidate_public_global_filters()
    
    if instance.user:
        invalidate_user_filters(instance.user)


@receiver(post_delete, sender=ReportRequest)
def delete_report_file_on_delete(sender, instance, **kwargs):
    if instance.file_path:
        try:
            instance.file_path.delete(save=False)
        except Exception as e:
            logger.error(f"Failed to delete file for report {instance.id}: {e}")