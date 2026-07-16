import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

class Command(BaseCommand):
    help = 'Wait for the database to be available with exponential backoff'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Waiting for the database...'))
        
        wait_time = 2
        max_retries = 10
        db_conn = connections['default']

        db_settings = db_conn.settings_dict
        host = db_settings.get('HOST') or 'localhost (default)'
        port = db_settings.get('PORT') or 'default port'
        db_name = db_settings.get('NAME') or 'unknown'
        user = db_settings.get('USER') or 'unknown'

        for i in range(max_retries):
            try:
                db_conn.ensure_connection()
                
                self.stdout.write(self.style.SUCCESS('Database is available!'))
                return
            
            except OperationalError as e:
                clean_error = str(e).strip() 
                
                if i < max_retries - 1:
                    self.stdout.write(self.style.WARNING(f'[Attempt {i+1}/{max_retries}] Failed to connect to DB "{db_name}" at {host}:{port} as user "{user}".'))
                    self.stdout.write(self.style.NOTICE(f'Reason: {clean_error}'))
                    self.stdout.write(self.style.WARNING(f'Retrying in {wait_time}s...\n'))
                    
                    time.sleep(wait_time)
                    # Exponential backoff: 2s, 4s, 8s, etc. (capped at 15s)
                    wait_time = min(wait_time * 2, 15)
                else:
                    self.stdout.write(self.style.ERROR(
                        f'\nFATAL: Database timeout after {max_retries} attempts.\n'
                        f'Target: {host}:{port} | DB: {db_name} | User: {user}\n'
                        f'Final Error: {clean_error}'
                    ))
                    raise SystemExit(1)