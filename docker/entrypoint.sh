#!/bin/bash
set -e

DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-3306}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

wait_for_port() {
    local host=$1
    local port=$2
    echo "Waiting for TCP connection on $host:$port..."
    while ! nc -z $host $port; do
      sleep 0.5
    done
    echo "Connection established to $host:$port."
}

wait_for_port $DB_HOST $DB_PORT
wait_for_port $REDIS_HOST $REDIS_PORT

if [ "$1" = "web" ]; then
    echo "Synchronizing static assets..."
    python backend/manage.py collectstatic --noinput --clear
    chmod -R +rX /app/backend/staticfiles

    echo "Executing Database Schema Migrations..."
    python backend/manage.py migrate --noinput

    echo "Setting up required folders..."
    python backend/manage.py make_required_folders

    echo "Setting up periodic tasks..."
    python backend/manage.py setup_periodic_tasks

    echo "Fetching the latest Astraea Agent..."
    PROTECTED_PATH="/app/protected_storage"
    AGENT_REPO="DefOnslaught/Astraea-Agent"
    DOWNLOAD_URL=$(curl -s https://api.github.com/repos/$AGENT_REPO/releases/latest | grep "browser_download_url" | grep "\.tar\.gz" | cut -d '"' -f 4)
    if [ -n "$DOWNLOAD_URL" ]; then
        curl -L -o "$PROTECTED_PATH/astraea_agent.tar.gz" "$DOWNLOAD_URL"
        echo "Downloaded latest agent to $PROTECTED_PATH"
    else
        echo "Could not automatically fetch the latest agent."
    fi

    echo "Validating Administrative Access..."
    python backend/manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='admin@astraea.local').exists():
    User.objects.create_superuser(
        username='admin',
        email='admin@astraea.local',
        password='AstraeaAdmin123!'
    )
    print("Initial bootstrap superuser created successfully.")
EOF

    echo "Executing predictive cache warming..."
    python backend/manage.py warm_cache || echo "Non-fatal: Cache warming deferred."

    echo "Initializing Gunicorn WSGI Server..."
    exec gunicorn backend.wsgi:application \
        --bind 0.0.0.0:8000 \
        --worker-class gevent \
        --workers 4 \
        --worker-connections 2000 \
        --timeout 30 \
        --preload \
        --max-requests 0 \
        --access-logfile - \
        --error-logfile -
fi

if [ "$1" = "worker" ]; then
    echo "Initializing Celery Distributed Task Worker..."
    exec celery -A backend worker --loglevel=INFO --concurrency=4
fi

if [ "$1" = "beat" ]; then
    echo "Initializing Celery Periodic Task Scheduler..."
    rm -f /tmp/celerybeat.pid
    exec celery -A backend beat --loglevel=INFO --pidfile=/tmp/celerybeat.pid
fi

exec "$@"