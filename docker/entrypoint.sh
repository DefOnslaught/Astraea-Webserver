#!/bin/bash
set -e

# Wait for DB (using your existing wait_for_db command)
python backend/manage.py wait_for_db

echo "Applying migrations..."
python backend/manage.py migrate --noinput

echo "Setting up admin user..."
# This creates the superuser without interaction if it doesn't exist
python backend/manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin@astraea.local', 'admin', 'AstraeaAdmin123!')
    print('Superuser created: admin / AstraeaAdmin123!')
else:
    print('Superuser already exists.')
EOF

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 --chdir backend backend.wsgi:application