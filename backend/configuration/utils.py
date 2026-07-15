import logging
from django.core.cache import cache

from django.conf import settings
from .models import APIKey, SysConfig, ZabbixConfiguration, NotificationSettings, NotificationService, AstraeaAgentInfo

logger = logging.getLogger('django')

def cache_active_api_keys():
    """
    Standardizes on the 'active_api_keys' cache key.
    Uses a set for O(1) lookup performance.
    """

    active_keys = set(APIKey.objects.filter(is_active=True).values_list('key', flat=True))
    
    cache.set("active_api_keys", active_keys, timeout=None)
    
    if settings.DEBUG:
        logger.info(f"Cache warmed: {len(active_keys)} active API keys stored.")
    return active_keys

SYS_CONFIG_CACHE_KEY = "sys_config"

def set_sys_config_cache(config_instance):
    """
    Active Write: Maps the model instance to a dict and pushes to cache.
    """
    if not config_instance:
        cache.set(SYS_CONFIG_CACHE_KEY, {}, timeout=None)
        return {}
    
    data = {
        "patching_enabled": config_instance.patching_enabled,
        "skip_email_validation": config_instance.skip_email_validation,
        "disable_registration": config_instance.disable_registration,
    }
    cache.set(SYS_CONFIG_CACHE_KEY, data, timeout=None)
    if settings.DEBUG:
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
            if created and settings.DEBUG:
                logger.info("Initialized SysConfig singleton in database.")

        data = set_sys_config_cache(config)

    return data

ZABBIX_CONFIG_CACHE_KEY = "zabbix_configuration_dict"

def set_zabbix_config_cache(config_instance):
    """
    Serializes and stores the config instance values into cache.
    """
    if not config_instance:
        cache.set(ZABBIX_CONFIG_CACHE_KEY, {}, timeout=None)
        return {}
        
    config_dict = {
        'id': config_instance.id,
        'enable': config_instance.enable,
        'api_url': config_instance.api_url,
        'api_token': config_instance.api_token
    }
    cache.set(ZABBIX_CONFIG_CACHE_KEY, config_dict, timeout=None)
    if settings.DEBUG:
        logger.info(f"Cache has been successfully set for 'set_zabbix_config_cache'")
    return config_dict


def get_zabbix_config():
    """
    Retrieves the Zabbix configuration from cache, or falls back to the database.
    """
    
    data = cache.get(ZABBIX_CONFIG_CACHE_KEY)

    if data is None:
        config_instance, created  = ZabbixConfiguration.objects.get_or_create()
        if created and settings.DEBUG:
            logger.info("Initialized ZabbixConfiguration singleton in database.")
        
        data = set_zabbix_config_cache(config_instance)

    return data


NOTIFICATION_CONFIG_CACHE_KEY = 'notification_configuration_dict'

def set_notification_config(config_instance):
    """
    Serializes and stores the config instance values into cache.
    """

    if not config_instance:
        cache.set(NOTIFICATION_CONFIG_CACHE_KEY, {}, timeout=None)
        return {}

    config_dict = {
        'id': config_instance.id,
        'failed': config_instance.failed,
        'success': config_instance.success,
        'partial': config_instance.partial,
        'out_of_date': config_instance.out_of_date,
        'on_server_add': config_instance.on_server_add,
        'on_server_modify': config_instance.on_server_modify,
        'on_server_delete': config_instance.on_server_delete,
        'site_outdated': config_instance.site_outdated
    }

    cache.set(NOTIFICATION_CONFIG_CACHE_KEY, config_dict, timeout=None)
    if settings.DEBUG:
        logger.info(f"Cache has been successfully set for 'set_notification_config'")
    return config_dict


def get_notification_config():
    """
    Retrieves the Notification configuration from cache, or falls back to the database.
    """

    data = cache.get(NOTIFICATION_CONFIG_CACHE_KEY)

    if data is None:
        config_instance, created = NotificationSettings.objects.get_or_create(id=1)
        if created and settings.DEBUG:
            logger.info("Initialized ZabbixConfiguration singleton in database.")
        
        data = set_notification_config(config_instance)

    return data


NOTIFICATION_SERVICES_CACHE_KEY = 'active_notification_services_list'

def set_notification_services():
    """
    Fetches all services from DB and refreshes the cache.
    """
    all_services = list(NotificationService.objects.all().values(
        'id', 'name', 'type', 'url', 'email_all_users', 
        'main_email_recipients', 'recipients', 'active'
    ))
    
    cache.set(NOTIFICATION_SERVICES_CACHE_KEY, all_services, timeout=None)
    
    if settings.DEBUG:
        logger.info(f"Cache refreshed for {len(all_services)} active NotificationServices.")
    return all_services


def get_notification_services():
    """
    Retrieves the list of active services from cache, or populates it.
    """
    data = cache.get(NOTIFICATION_SERVICES_CACHE_KEY)
    if data is None:
        data = set_notification_services()
    return data


AGENT_VERSION_CACHE_KEY = "agent_version"

def set_agent_version(instance=None):
    """
    Fetches agent version from DB and refreshes the cache.
    """

    if instance:
        version = instance.version
    else:
        info, created = AstraeaAgentInfo.objects.get_or_create(id=1)
        version = info.version

    cache.set(AGENT_VERSION_CACHE_KEY, version, timeout=None)

    if settings.DEBUG:
        logger.info(f"Cache refreshed for Astraea Agent Info.")
    return version

def get_agent_version():
    """
    Retrieves the version from cache, or populates it.
    """

    data = cache.get(AGENT_VERSION_CACHE_KEY)
    if data is None:
        data = set_agent_version()
    return data