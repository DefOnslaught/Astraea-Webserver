import os
from datetime import timedelta
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.core.cache import cache

from .models import Server, APIKey, PatchSession, PackageUpdate
from .utils import cache_individual_vms, update_dashboard_counts, remove_vm_from_index, refresh_package_search_index

@receiver(pre_save, sender=Server)
def capture_old_state(sender, instance, **kwargs):
    """Store the old 'outdated' status on the instance before it's saved."""
    if instance.pk:
        try:
            old_obj = Server.objects.only('last_patch_date', 'enable_patching').get(pk=instance.pk)
            
            days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
            threshold = timezone.now() - timedelta(days=days)
            instance._was_outdated = (old_obj.last_patch_date is None or old_obj.last_patch_date < threshold)
            
            instance._was_enabled = old_obj.enable_patching
        except Server.DoesNotExist:
            instance._was_outdated = False
            instance._was_enabled = True
    else:
        instance._was_outdated = False
        instance._was_enabled = True

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
        was_enabled=getattr(instance, '_was_enabled', True),
        is_new=created
    )

@receiver(post_save, sender=PatchSession)
def update_cache_on_patch(sender, instance, created, **kwargs):
    """When a patch session is recorded, update the server's cached status."""
    if created:
        cache_individual_vms([instance.server])

@receiver(post_save, sender=PackageUpdate)
def update_package_index_on_new_pkg(sender, instance, created, **kwargs):
    """
    Ensure the global package search index updates when new packages are logged,
    but with a debounce to prevent database thrashing.
    """
    if created:
        lock_key = "package_index_refresh_lock"
        # Try to set a lock for 60 seconds. 
        # .add() only returns True if the key didn't exist.
        if cache.add(lock_key, "locked", timeout=60):
            # Only the first package in a batch triggers the refresh
            refresh_package_search_index()

@receiver(post_delete, sender=Server)
def sync_cache_on_delete(sender, instance, **kwargs):
    cache.delete(f"server_data:{instance.server_id}")
    remove_vm_from_index(instance.server_id)
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    is_outdated = (instance.last_patch_date is None or 
                   instance.last_patch_date < (timezone.now() - timedelta(days=days)))
    
    update_dashboard_counts(
        instance=instance, 
        was_outdated=is_outdated, 
        is_outdated=False, 
        is_deleted=True
    )

    refresh_package_search_index()


@receiver([post_save, post_delete], sender=APIKey)
def clear_key_cache(sender, **kwargs):
    cache.delete('valid_api_key_hashes')