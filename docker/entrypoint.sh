#!/bin/bash
set -e

# Function to wait for services
wait_for_port() {
    local host=$1
    local port=$2
    echo "Waiting for $host:$port..."
    while ! nc -z $host $port; do
      sleep 0.1
    done
    echo "$host:$port is ready!"
}

# Wait for essential services
wait_for_port db 3306
wait_for_port redis 6379

# Only run migrations and admin setup if we are starting the 'web' container
if [ "$1" = "web" ]; then
    echo "Refreshing static files..."
    python backend/manage.py collectstatic --noinput --clear

    echo "Running Database Migrations..."
    python backend/manage.py migrate --noinput

    echo "Ensuring Superuser exists..."
    python backend/manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@astraea.local', 'AstraeaAdmin123!')
EOF

    echo "Warming cache..."
    python backend/manage.py warm_cache || true 

    echo "Starting Gunicorn (Web Server)..."
    exec gunicorn backend.wsgi:application \
        --bind 0.0.0.0:8000 \
        --worker-class gevent \
        --workers 4 \
        --preload \
        --max-requests 5000 \
        --max-requests-jitter 100
fi

if [ "$1" = "worker" ]; then
    echo "Starting Celery Worker..."
    # Note: Using 'multi' in Docker is usually discouraged. 
    # Just run the worker process in the foreground so Docker can monitor it.
    exec celery -A backend worker --loglevel=INFO
fi

if [ "$1" = "beat" ]; then
    echo "Starting Celery Beat..."
    rm -f /tmp/celerybeat.pid
    exec celery -A backend beat --loglevel=INFO --pidfile=/tmp/celerybeat.pid
fi

# Fallback to whatever was passed (like /bin/bash)
exec "$@"