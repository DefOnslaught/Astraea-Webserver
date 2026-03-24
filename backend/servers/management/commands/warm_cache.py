from django.core.management.base import BaseCommand

from servers.models import Server
from servers.utils import refresh_dashboard_stats, cache_individual_vms, refresh_package_search_index

# Main use is to be ran before Django boots up, that way everything is in cache for the first user

class Command(BaseCommand):
    help = 'Warms the Redis cache for servers and dashboard'

    def handle(self, *args, **kwargs):
        
        self.stdout.write("Fetching servers from database...")

        # Evaluate the queryset into a list immediately to hit DB once
        vms = Server.objects.prefetch_related('interfaces').all()
        
        # 1. Cache individual VM details
        cache_individual_vms(vms)
        
        # 2. Cache Dashboard stats using the same list
        refresh_dashboard_stats(vms=vms)

        # 3. Cache all packages that are latest success session for easy searching
        refresh_package_search_index()
        
        self.stdout.write(self.style.SUCCESS(f"Successfully warmed cache for {len(vms)} servers."))