import os
from datetime import timedelta
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.core.cache import cache

from .models import Server, APIKey
from .utils import cache_individual_vms, update_dashboard_counts, remove_vm_from_index

@receiver(pre_save, sender=Server)
def capture_old_state(sender, instance, **kwargs):
    """Store the old 'outdated' status on the instance before it's saved."""
    if instance.pk:
        try:
            old_date = Server.objects.only('last_patch_date').get(pk=instance.pk).last_patch_date
            days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
            threshold = timezone.now() - timedelta(days=days)
            instance._was_outdated = (old_date is None or old_date < threshold)
        except Server.DoesNotExist:
            instance._was_outdated = False
    else:
        instance._was_outdated = False

@receiver(post_save, sender=Server)
def sync_cache_on_save(sender, instance, created, **kwargs):
    cache_individual_vms([instance])
    
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    threshold = timezone.now() - timedelta(days=days)
    is_outdated = (instance.last_patch_date is None or instance.last_patch_date < threshold)

    # Pass the instance here!
    update_dashboard_counts(
        instance=instance, 
        was_outdated=getattr(instance, '_was_outdated', False),
        is_outdated=is_outdated,
        is_new=created
    )

@receiver(post_delete, sender=Server)
def sync_cache_on_delete(sender, instance, **kwargs):
    cache.delete(f"server_data:{instance.id}")
    remove_vm_from_index(instance.id)
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    is_outdated = (instance.last_patch_date is None or 
                   instance.last_patch_date < (timezone.now() - timedelta(days=days)))
    
    update_dashboard_counts(
        instance=instance, 
        was_outdated=is_outdated, 
        is_outdated=False, 
        is_deleted=True
    )


@receiver([post_save, post_delete], sender=APIKey)
def clear_key_cache(sender, **kwargs):
    cache.delete('valid_api_key_hashes')