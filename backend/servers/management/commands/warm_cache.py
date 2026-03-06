from django.core.management.base import BaseCommand
from django.core.cache import cache

from servers.models import Server
from servers.utils import refresh_dashboard_stats, cache_individual_vms
from servers.constants import SERVER_CACHE_FIELDS

# Main use is to be ran before Django boots up, that way everything is in cache for the first user

class Command(BaseCommand):
    help = 'Warms the Redis cache for servers and dashboard'

    def handle(self, *args, **kwargs):
        # Removes old data that may be in cache from before starting django
        cache.clear()
        
        self.stdout.write("Fetching servers from database...")

        # Evaluate the queryset into a list immediately to hit DB once
        vms = list(Server.objects.values(*SERVER_CACHE_FIELDS))
        
        # 1. Cache individual VM details
        cache_individual_vms(vms)
        
        # 2. Cache Dashboard stats using the same list
        refresh_dashboard_stats(vms=vms)
        
        self.stdout.write(self.style.SUCCESS(f"Successfully warmed cache for {len(vms)} servers."))