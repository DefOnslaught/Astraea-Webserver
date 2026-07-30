#!/bin/bash

if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install git to use this update script."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install docker to use this update script."
    exit 1
fi

cd "$(dirname "$0")"

echo "Starting Astraea Docker Update Process..."

SETTINGS_FILE="backend/backend/settings.py"
SETTINGS_CHANGED=false

if [ -f "$SETTINGS_FILE" ]; then
    PRE_HASH=$(md5sum "$SETTINGS_FILE" | awk '{print $1}')
fi

if [ ! -d ".git" ]; then
    echo "No Git repository detected."
    read -p "Would you like to initialize Git and link to the official repository? (y/N) " INIT_GIT
    
    if [[ "$INIT_GIT" =~ ^[Yy]$ ]]; then
        echo "Initializing repository..."
        git init
        git remote add origin https://github.com/DefOnslaught/Astraea-Webserver.git
        
        if ! git fetch origin; then
            echo "Error: Could not connect to the remote repository. Check your internet or permissions."
            exit 1
        fi
        
        git reset --hard origin/main
        echo "Repository initialized and synchronized."
    else
        echo "Update aborted. Git initialization required for automatic updates."
        exit 1
    fi
else
    echo "Checking for local changes..."
    
    if [ -n "$(git status --porcelain)" ]; then
        echo "WARNING: You have uncommitted local changes."
        read -p "Your local changes might cause conflicts. Stash them? (y/N) " DO_STASH
        
        if [[ "$DO_STASH" =~ ^[Yy]$ ]]; then
            git stash
            echo "Local changes stashed."
        else
            echo "Update aborted. Please commit, stash, or discard your changes manually."
            exit 1
        fi
    fi

    echo "Pulling latest changes..."
    git pull || { echo "'git pull' failed. Please resolve conflicts manually."; exit 1; }
fi

if [ -f "$SETTINGS_FILE" ]; then
    POST_HASH=$(md5sum "$SETTINGS_FILE" | awk '{print $1}')
    
    if [ "$PRE_HASH" != "$POST_HASH" ]; then
        SETTINGS_CHANGED=true
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak_$TIMESTAMP"
        echo "Change detected in settings.py! Created backup: $SETTINGS_FILE.bak_$TIMESTAMP"
    else
        echo "settings.py remains unchanged."
    fi
fi

if [ "$SETTINGS_CHANGED" = true ]; then
    echo "-------------------------------------------------------"
    echo "   REMINDER: settings.py was updated by the repo!"
    echo "   Please compare your backup with the new version."
    echo "   Do not rebuild containers until validating your environment."
    echo "-------------------------------------------------------"
fi

echo "-------------------------------------------------------"
read -p "Update complete. Would you like to rebuild and restart the Docker stack now? (y/N) " RUN_DEPLOY
RUN_DEPLOY=${RUN_DEPLOY:-N}

if [[ "$RUN_DEPLOY" =~ ^[Yy]$ ]]; then
    
    read -p "Have you backed up your database before updating? (y/N) " DB_BACKED_UP
    if [[ ! "$DB_BACKED_UP" =~ ^[Yy]$ ]]; then
        echo "ABORTED: Please back up your database (e.g., via mysqldump or container volume snapshot) before running migrations."
        exit 1
    fi
    
    if [ -f "./start-docker.sh" ]; then
        chmod +x ./start-docker.sh
    else
        echo "Error: start-docker.sh script not found!"
        exit 1
    fi

    echo "Executing start-docker.sh..."
    if ! ./start-docker.sh; then
        echo "Docker build and deployment failed!"
        read -p "Would you like to rollback the code changes to the previous commit? (y/N) " DO_ROLLBACK
        
        if [[ "$DO_ROLLBACK" =~ ^[Yy]$ ]]; then
            echo "Rolling back Git repository..."
            git reset --hard HEAD@{1}
            echo "Code rolled back. Restarting containers with previous code via start-docker.sh..."
            ./start-docker.sh
            echo "Rollback complete."
        else
            echo "Update aborted in a potentially broken state. Please fix the container or configuration manually."
        fi
        exit 1
    fi
    
    echo "Docker update and deployment successful!"

    echo "-------------------------------------------------------"
    read -p "Would you like to clean up old, dangling Docker images and build caches to free up disk space? (y/N) " CLEAN_DOCKER
    CLEAN_DOCKER=${CLEAN_DOCKER:-N}

    if [[ "$CLEAN_DOCKER" =~ ^[Yy]$ ]]; then
        echo "Pruning dangling images..."
        docker image prune -f
        echo "Pruning unused build cache..."
        docker builder prune -f
        echo "Docker cleanup completed successfully!"
    else
        echo "Skipping Docker cleanup."
    fi
else
    echo "Skipping container restart. Run './start-docker.sh' manually when ready."
fi