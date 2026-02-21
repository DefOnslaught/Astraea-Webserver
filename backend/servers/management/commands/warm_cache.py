from django.core.management.base import BaseCommand
from servers.models import Server
from servers.utils import refresh_dashboard_stats, cache_individual_vms

class Command(BaseCommand):
    help = 'Warms the Redis cache for servers and dashboard'

    def handle(self, *args, **kwargs):
        self.stdout.write("Fetching servers from database...")

        # MUST include every field used in cache_individual_vms and refresh_dashboard_stats
        fields = [
            'id', 
            'hostname',
            'ip_address',
            'last_patch_date',
            'os_version',
            'rebooted',
        ]

        # Evaluate the queryset into a list immediately to hit DB once
        vms = list(Server.objects.only(*fields))
        
        # 1. Cache individual VM details
        cache_individual_vms(vms)
        
        # 2. Cache Dashboard stats using the same list
        refresh_dashboard_stats(vms=vms)
        
        self.stdout.write(self.style.SUCCESS(f"Successfully warmed cache for {len(vms)} servers."))