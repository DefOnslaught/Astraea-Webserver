from rest_framework import permissions
from django.core.cache import cache

from configuration.utils import cache_active_api_keys

class HasInternalAPIKey(permissions.BasePermission):
    def has_permission(self, request, view):
        provided_key = request.headers.get('X-Api-Key')
        if not provided_key:
            return False

        # 1. Get from cache
        valid_keys = cache.get('active_api_keys')

        # 2. Cache Miss: Warm it up
        if valid_keys is None:
            valid_keys = cache_active_api_keys()

        # 3. Check membership (O(1) since it's a set)
        # Note: If is_active was set to False, the signal already 
        # removed it from this set.
        return provided_key in valid_keys