#!/bin/bash

if ! sudo -v &> /dev/null; then
    echo "❌ This script requires sudo privileges to set directory permissions."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git to use this update script."
    exit 1
fi

cd "$(dirname "$0")"

TARGET_USER=$(stat -c '%U' .)
TARGET_GROUP=$(stat -c '%G' .)

echo "🚀 Starting Astraea Update Process for user: $TARGET_USER"

SETTINGS_FILE="backend/backend/settings.py"
SETTINGS_CHANGED=false

if [ -f "$SETTINGS_FILE" ]; then
    PRE_HASH=$(md5sum "$SETTINGS_FILE" | awk '{print $1}')
fi

if [ ! -d ".git" ]; then
    echo "⚠️  No Git repository detected."
    read -p "Would you like to initialize Git and link to the official repository? (y/N) " INIT_GIT
    
    if [[ "$INIT_GIT" =~ ^[Yy]$ ]]; then
        echo "🔄 Initializing repository..."
        git init
        git remote add origin https://github.com/DefOnslaught/Astraea-Webserver.git
        
        if ! git fetch origin; then
            echo "❌ Error: Could not connect to the remote repository. Check your internet or permissions."
            exit 1
        fi
        
        git reset --hard origin/main
        echo "✅ Repository initialized and synchronized."
    else
        echo "❌ Update aborted. Git initialization required for automatic updates."
        exit 1
    fi
else
    echo "⬇️  Checking for local changes..."
    
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  WARNING: You have uncommitted local changes."
        read -p "Your local changes might cause conflicts. Stash them? (y/N) " DO_STASH
        
        if [[ "$DO_STASH" =~ ^[Yy]$ ]]; then
            git stash
            echo "✅ Local changes stashed."
        else
            echo "❌ Update aborted. Please commit, stash, or discard your changes manually."
            exit 1
        fi
    fi

    echo "⬇️  Pulling latest changes..."
    git pull || { echo "❌ 'git pull' failed. Please resolve conflicts manually."; exit 1; }
fi

if [ -f "$SETTINGS_FILE" ]; then
    POST_HASH=$(md5sum "$SETTINGS_FILE" | awk '{print $1}')
    
    if [ "$PRE_HASH" != "$POST_HASH" ]; then
        SETTINGS_CHANGED=true
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak_$TIMESTAMP"
        echo "💾 Change detected in settings.py! Created backup: $SETTINGS_FILE.bak_$TIMESTAMP"
    else
        echo "✅ settings.py remains unchanged."
    fi
fi

if [ "$SETTINGS_CHANGED" = true ]; then
        echo "-------------------------------------------------------"
        echo "⚠️  REMINDER: settings.py was updated by the repo!"
        echo "   Please compare your backup with the new version."
        echo "   Do not run 'make deploy' until validating."
        echo "-------------------------------------------------------"
    fi

echo "-------------------------------------------------------"
read -p "Update complete. Would you like to run 'make deploy' now? (y/N) " RUN_DEPLOY
RUN_DEPLOY=${RUN_DEPLOY:-N}

if [[ "$RUN_DEPLOY" =~ ^[Yy]$ ]]; then
    
    read -p "Have you backed up your database (e.g. mysqldump) before migrating? (y/N) " DB_BACKED_UP
    if [[ ! "$DB_BACKED_UP" =~ ^[Yy]$ ]]; then
        echo "❌ ABORTED: Please back up your database before running migrations."
        exit 1
    fi
    
    echo "⚙️  Running database migrations..."
    if ! make dbMigrations; then
        echo "❌ Migrations failed!"
        read -p "Would you like to rollback the code changes to the previous commit? (y/N) " DO_ROLLBACK
        
        if [[ "$DO_ROLLBACK" =~ ^[Yy]$ ]]; then
            echo "🔄 Rolling back Git repository..."
            git reset --hard HEAD@{1}
            echo "⚠️  Code rolled back. IMPORTANT: If migrations partially applied, you may need to manually rollback the database."
        else
            echo "ℹ️  Update aborted in a potentially broken state. Please fix the migration manually."
        fi
        exit 1
    fi
    
    echo "⚙️  Deploying application..."
    make deploy
    
    sudo chown -R "$TARGET_USER:$TARGET_GROUP" .
    sudo chmod -R 750 .
    
    echo "✅ Update and deployment successful!"
else
    echo "ℹ️  Skipping deployment. Run 'make deploy' manually when ready."
fi