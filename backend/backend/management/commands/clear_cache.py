from django.core.management.base import BaseCommand
from django.core.cache import cache

class Command(BaseCommand):
    help = 'Clears all cache'

    def handle(self, *args, **options):
        try:
            cache.clear()
            self.stdout.write(self.style.SUCCESS('Cache has been cleared'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to clear cache: {str(e)}'))