import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

class Command(BaseCommand):
    help = 'Wait for the database to be available'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Waiting for the database...'))
        max_retries = 3
        retry_interval_1 = 15
        retry_interval_2 = 60

        for retry_attempt in range(1, max_retries):
            try:
                db_conn = connections['default']
                self.stdout.write(self.style.SUCCESS('Database is available!'))
                break
            except OperationalError:
                if retry_attempt < max_retries:
                    if retry_attempt == 1:
                        self.stdout.write(self.style.NOTICE(f'Database unavailable, waiting {retry_interval_1} seconds...'))
                        time.sleep(retry_interval_1)
                    else:
                        self.stdout.write(self.style.NOTICE(f'Database still unavailable, waiting {retry_interval_2} seconds...'))
                        time.sleep(retry_interval_2)
                else:
                    self.stdout.write(self.style.ERROR('Database is still unavailable after multiple attempts. Exiting.'))
                    raise SystemExit(1)