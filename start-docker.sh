#!/bin/bash
cd "$(dirname "$0")"

if [ ! -f "backend/.env" ]; then
    echo "Error: backend/.env not found!"
    echo "Please copy backend/.env_example to backend/.env and configure your settings."
    exit 1
fi

echo "Starting Astraea Docker stack..."
docker compose --env-file backend/.env build
docker compose --env-file backend/.env up -d