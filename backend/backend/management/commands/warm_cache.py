from django.core.management.base import BaseCommand

from backend.utils import cache_functions

# Main use is to be ran before Django boots up, that way everything is in cache for the first user

class Command(BaseCommand):
    help = 'Warms the Redis cache for servers and dashboard'

    def handle(self, *args, **kwargs):
        
        self.stdout.write("Fetching servers from database...")

        cache_functions()
        
        self.stdout.write(self.style.SUCCESS(f"Successfully warmed cache."))