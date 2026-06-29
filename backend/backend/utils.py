from django.core.cache import cache

from servers.models import Server
from servers.utils import refresh_dashboard_stats, cache_individual_vms, refresh_package_search_index
from configuration.utils import cache_active_api_keys, get_sys_config, get_zabbix_config, get_notification_config, get_notification_services, get_agent_version
from users.utils import cacheVerificationStatus

def cache_functions(clear_cache=False):

    if clear_cache:
        cache.clear()

    # Evaluate the queryset into a list immediately to hit DB once
    vms = Server.objects.prefetch_related('interfaces').all()
        
    # 1. Cache individual VM details
    cache_individual_vms(vms)
        
    # 2. Cache Dashboard stats using the same list
    refresh_dashboard_stats(vms=vms)

    # 3. Cache all packages that are latest success session for easy searching
    refresh_package_search_index()

    # 4. Cache all active API keys so patching script auth goes quickly
    cache_active_api_keys()

    # 5. Cache the System Configuration (i.e, Global Patching Enable )
    sys_config = get_sys_config()
        
    # 6. Cache all users verification status if 'skip_email_validation' is true
    if not sys_config.get('skip_email_validation'):
        cacheVerificationStatus()
        
    # 7. Cache the Notification configuration
    get_notification_config()

    # 8. Cache Notification Services
    get_notification_services()

    # 8. Cache the Zabbix configuration
    get_zabbix_config()

    # 9. Cache the Astraea Agent Version
    get_agent_version()