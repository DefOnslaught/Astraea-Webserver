import hashlib
from django.core.cache import cache
from rest_framework import permissions

from .models import APIKey

class HasInternalAPIKey(permissions.BasePermission):
    def has_permission(self, request, view):
        provided_key = request.headers.get('X-Api-Key')
        if not provided_key:
            return False

        # 1. Hash the provided key to compare with the DB
        provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()

        # 2. Try to find the hash in the cache
        # We store a set of valid hashes in Redis for O(1) lookups
        valid_hashes = cache.get('valid_api_key_hashes')

        if valid_hashes is None:
            # 3. Cache Miss: Pull active keys from DB and populate cache
            valid_hashes = list(APIKey.objects.filter(is_active=True).values_list('key_hash', flat=True))
            cache.set('valid_api_key_hashes', valid_hashes, timeout=3600)

        return provided_hash in valid_hashes