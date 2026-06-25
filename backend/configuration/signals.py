import logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.conf import settings
from .models import APIKey, SysConfig, ZabbixConfiguration, ZabbixMaintenance
from .utils import cache_active_api_keys, set_sys_config_cache, set_zabbix_config_cache

from users.utils import removeAllCacheVerificationStatus
from users.tasks import create_bulk_verify_existing_users

logger = logging.getLogger('django')

@receiver([post_save, post_delete], sender=APIKey)
def update_api_key_cache(sender, instance, **kwargs):
    """
    Whenever a key is created, updated (e.g. deactivated), or deleted, 
    we refresh the entire active set.
    """
    cache_active_api_keys()


@receiver(pre_save, sender=SysConfig)
def capture_old_config(sender, instance, **kwargs):
    if instance.pk:
        old_val = SysConfig.objects.filter(pk=instance.pk).values_list('skip_email_validation', flat=True).first()
        instance._old_skip_email_validation = old_val
    else:
        instance._old_skip_email_validation = None


@receiver(post_save, sender=SysConfig)
def update_sys_config_cache(sender, instance, **kwargs):
    """Updates the cache whenever settings are updated"""
    set_sys_config_cache(instance)

    old_skip = getattr(instance, '_old_skip_email_validation', None)
    new_skip = instance.skip_email_validation

    # If it was True and is now False
    if old_skip is True and new_skip is False:
        create_bulk_verify_existing_users.delay()
        if settings.DEBUG:
            logger.info("Skip Email Validation disabled. Queued bulk verification task.")
    
    # Remove all cached results since we no longer need to check cache
    # Prevents stale data/leaks
    elif old_skip is False and new_skip is True:
        removeAllCacheVerificationStatus()


@receiver(post_save, sender=ZabbixConfiguration)
def update_zabbix_cache_on_save(sender, instance, **kwargs):
    set_zabbix_config_cache(instance)


@receiver(post_delete, sender=ZabbixConfiguration)
def clear_zabbix_cache_on_delete(sender, instance, **kwargs):
    set_zabbix_config_cache(None)
