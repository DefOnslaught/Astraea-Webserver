from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache

class Command(BaseCommand):
    help = 'Clears all cache'

    def handle(self, *args, **options):
        try:
            cache.clear()
            self.stdout.write(self.style.SUCCESS('Cache has been cleared'))
        except Exception as e:
            raise CommandError(f'Failed to clear cache: {str(e)}')