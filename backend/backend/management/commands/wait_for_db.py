import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

class Command(BaseCommand):
    help = 'Wait for the database to be available with exponential backoff'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Waiting for the database...'))
        
        # Poll settings
        wait_time = 2  # Start with 2 seconds
        max_retries = 10
        db_conn = connections['default']

        for i in range(max_retries):
            try:
                # IMPORTANT: This line actually attempts to talk to the DB
                db_conn.ensure_connection()
                
                self.stdout.write(self.style.SUCCESS('Database is available!'))
                return  # Exit the command successfully
            
            except OperationalError:
                if i < max_retries - 1:
                    self.stdout.write(
                        self.style.WARNING(f'Database unavailable (Attempt {i+1}/{max_retries}). Retrying in {wait_time}s...')
                    )
                    time.sleep(wait_time)
                    # Exponential backoff: 2s, 4s, 8s, etc. (capped at 15s)
                    wait_time = min(wait_time * 2, 15)
                else:
                    self.stdout.write(self.style.ERROR('\nError: Database timeout. Check MariaDB logs.'))
                    raise SystemExit(1)