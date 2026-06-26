import logging
from celery import shared_task
from backend.utils import cache_functions
from django.core.cache import cache

logger = logging.getLogger('django')

@shared_task
def run_cache_refresh_task():
    try:
        cache_functions(clear_cache=True)
    except Exception as e:
        logger.error(f"Cache refresh failed: {e}")
        raise
    finally:
        cache.delete('is_refreshing_cache')