import logging, re
from django.core.cache import cache
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from .models import ReportFilter

logger = logging.getLogger('django')


PUBLIC_GLOBAL_FILTERS_CACHE_KEY = "public_global_filters"

def set_public_global_filters():
    """
    Fetches public and global filters from FB and refreshes cache
    """

    filters = ReportFilter.objects.filter(Q(is_public=True) | Q(is_global=True)).values(
        'id', 'name', 'description', 'is_public', 'is_global', 'criteria', 'selected_fields', 'user__username'
    )
    
    data = list(filters)
    
    cache.set(PUBLIC_GLOBAL_FILTERS_CACHE_KEY, data, timeout=None)
    
    if settings.DEBUG:
        logger.info(f"Cache refreshed for {len(data)} public/global ReportFilters.")
    return data


def get_public_global_filters():
    """
    Retrieves the public public and global filters from cache, or falls back to the database.
    """

    data = cache.get(PUBLIC_GLOBAL_FILTERS_CACHE_KEY)

    if data is None:
        data = set_public_global_filters()
    return data

def invalidate_public_global_filters():
    cache.delete(PUBLIC_GLOBAL_FILTERS_CACHE_KEY)

def get_user_filters(user):
    """
    Retrieves user-specific filters from cache, or falls back to database.
    """
    cache_key = f"user_filters_{user.id}"
    data = cache.get(cache_key)
    
    if data is None:
        filters = ReportFilter.objects.filter(user=user).values(
            'id', 'name', 'description', 'is_public', 'is_global', 'criteria', 'selected_fields', 'user__username'
        )
        data = list(filters)
        cache.set(cache_key, data, timeout=3600)
    if settings.DEBUG:
        logger.info(f"Cache refreshed for `get_user_filters`.")
    return data

def invalidate_user_filters(user):
    cache.delete(f"user_filters_{user.id}")


def parse_relative_date(date_str):
    """Converts strings like '30d', '7d', '2w', '1y' into a datetime object."""
    match = re.match(r'(\d+)([dwmy])', date_str.lower())
    if not match:
        return None
    
    amount, unit = int(match.group(1)), match.group(2)
    now = timezone.now()
    
    if unit == 'd': return now - timedelta(days=amount)
    if unit == 'w': return now - timedelta(weeks=amount)
    if unit == 'm': return now - timedelta(days=amount * 30)
    if unit == 'y': return now - timedelta(days=amount * 365)
    return None

def process_dynamic_criteria(criteria_dict):
    """
    Scans the criteria dictionary for relative operators (>, <, >=, <=).
    If a relative date is found, it updates the dictionary key with the 
    appropriate Django lookup (__gt, __lt) and swaps the string for a datetime object.
    """
    processed_criteria = {}
    
    lookup_map = {
        '>': '__gt',
        '<': '__lt',
        '>=': '__gte',
        '<=': '__lte'
    }

    for key, val in criteria_dict.items():
        if isinstance(val, str):
            op_match = re.match(r'^([><]=?)(.+)$', val.strip())
            if op_match:
                op, date_str = op_match.groups()
                parsed_date = parse_relative_date(date_str.strip())
                if parsed_date:
                    new_key = f"{key}{lookup_map[op]}"
                    processed_criteria[new_key] = parsed_date
                    continue
        
        processed_criteria[key] = val
        
    return processed_criteria