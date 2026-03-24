from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import APIKey
from .utils import cache_active_api_keys

@receiver([post_save, post_delete], sender=APIKey)
def update_api_key_cache(sender, instance, **kwargs):
    """
    Whenever a key is created, updated (e.g. deactivated), or deleted, 
    we refresh the entire active set.
    """
    cache_active_api_keys()