from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import APIKey, SysConfig
from .utils import cache_active_api_keys, set_sys_config_cache

@receiver([post_save, post_delete], sender=APIKey)
def update_api_key_cache(sender, instance, **kwargs):
    """
    Whenever a key is created, updated (e.g. deactivated), or deleted, 
    we refresh the entire active set.
    """
    cache_active_api_keys()


@receiver(post_save, sender=SysConfig)
def update_sys_config_cache(sender, instance, **kwargs):
    """Updates the cache whenever settings are updated"""
    set_sys_config_cache(instance)