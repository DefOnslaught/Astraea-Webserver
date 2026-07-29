# --- Stage 1: Build Frontend ---
FROM node:26-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

# 1. Accept the build arguments
ARG VITE_API_URL
ARG VITE_REFRESH_TOKEN_LIFETIME_WARNING
ARG VITE_PATCH_THRESHOLD_DAYS

# 2. Expose them as environment variables for Vite to consume during the build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REFRESH_TOKEN_LIFETIME_WARNING=$VITE_REFRESH_TOKEN_LIFETIME_WARNING
ENV VITE_PATCH_THRESHOLD_DAYS=$VITE_PATCH_THRESHOLD_DAYS

RUN npm run build

# --- Stage 2: Backend & Shared Environment ---
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    curl \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    netcat-openbsd \
    docker.io \
    procps \
    systemd \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and compiled frontend payload
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment optimization for Python inside containers
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend

# Collect static files for Django Admin and Rest Framework
RUN python backend/manage.py collectstatic --noinput

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]