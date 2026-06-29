from django.core.management.base import BaseCommand
import os
from django.conf import settings


class Command(BaseCommand):
    help = 'Ensures all application-level directories exist'

    def handle(self, *args, **options):
        protected_storage_path = os.path.join(settings.BASE_DIR, 'protected_storage')
        
        try:
            os.makedirs(protected_storage_path, exist_ok=True)
            if not os.access(protected_storage_path, os.W_OK):
                self.stdout.write(self.style.WARNING(f'Directory {protected_storage_path} exists but is not writeable!'))
            else:
                self.stdout.write(self.style.SUCCESS('Protected storage directory verified.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to create directory: {e}'))