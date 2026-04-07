import logging
from django.core.cache import cache

from .models import APIKey, SysConfig
from backend.settings import DEBUG

logger = logging.getLogger('django')

def cache_active_api_keys():
    """
    Standardizes on the 'active_api_keys' cache key.
    Uses a set for O(1) lookup performance.
    """

    active_keys = set(APIKey.objects.filter(is_active=True).values_list('key', flat=True))
    
    cache.set("active_api_keys", active_keys, timeout=None)
    
    if DEBUG:
        logger.info(f"Cache warmed: {len(active_keys)} active API keys stored.")
    return active_keys

SYS_CONFIG_CACHE_KEY = "sys_config"

def set_sys_config_cache(config_instance):
    """
    Active Write: Maps the model instance to a dict and pushes to cache.
    """
    data = {
        "patching_enabled": config_instance.patching_enabled,
        "skip_email_validation": config_instance.skip_email_validation,
        "disable_registration": config_instance.disable_registration,
    }
    cache.set(SYS_CONFIG_CACHE_KEY, data, timeout=None)
    if DEBUG:
        logger.info(f"Cache has been successfully set for 'set_sys_config_cache'")
    return data


def get_sys_config():
    """
    Fetches config from cache. If not found, populates from DB.
    """
    data = cache.get(SYS_CONFIG_CACHE_KEY)

    if data is None:
        config = SysConfig.objects.first() # There's only a single row in the DB

        if not config:
            config, created = SysConfig.objects.get_or_create()
            if created and DEBUG:
                logger.info("Initialized SysConfig singleton in database.")

        data = set_sys_config_cache(config)

    return data