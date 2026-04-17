import logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.conf import settings

from .models import Verification
from .utils import updateCacheVerificationStatus, removeCacheVerificationStatus

logger = logging.getLogger('django')
User = get_user_model()


@receiver(post_save, sender=Verification)
def cache_verification(sender, instance, **kwargs):
    """
    Caches the new verification value
    """
    updateCacheVerificationStatus(user_id=instance.user.id, status=instance.is_verified)


@receiver(post_delete, sender=Verification)
def delete_cache_on_delete(sender, instance, **kwargs):
    """
    Deletes the cache when a user or verification record is deleted
    """
    removeCacheVerificationStatus(instance.user.id)


@receiver(pre_save, sender=User)
def capture_old_superuser_status(sender, instance, **kwargs):
    """
    Snapshots the superuser status before saving. 
    We do this regardless of sys_config to ensure cache integrity.
    """
    if instance.pk:
        old_status = User.objects.filter(pk=instance.pk).values_list('is_superuser', flat=True).first()
        instance._old_is_superuser = old_status
    else:
        instance._old_is_superuser = None


@receiver(post_save, sender=User)
def clear_cache_on_superuser_change(sender, instance, created, **kwargs):
    """
    If is_superuser changed, we MUST wipe the cache so isUserVerified 
    re-calculates the status correctly.
    """
    if not created:
        old_status = getattr(instance, '_old_is_superuser', None)
        if old_status is not None and old_status != instance.is_superuser:
            removeCacheVerificationStatus(instance.id)
            if settings.DEBUG:
                logger.info(f"Superuser status changed for {instance.username}. Cache cleared.")