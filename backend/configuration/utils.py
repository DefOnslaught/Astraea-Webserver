import logging
from django.core.cache import cache

from .models import APIKey
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