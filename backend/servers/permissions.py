import secrets
from rest_framework import permissions
from django.core.cache import cache

from configuration.utils import cache_active_api_keys

class HasInternalAPIKey(permissions.BasePermission):
    def has_permission(self, request, view):
        provided_key = request.headers.get('X-API-Key')
        if not provided_key:
            return False

        valid_keys = cache.get('active_api_keys')

        if valid_keys is None:
            valid_keys = cache_active_api_keys()

        is_valid = False
        for valid_key in valid_keys:
            if secrets.compare_digest(str(valid_key), str(provided_key)):
                is_valid = True

        return is_valid