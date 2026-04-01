#!/bin/bash
# Astraea Agent Auto-Installer
set -e

# 1. Variables injected by Django Template
API_KEY="{{ API_KEY }}"
BASE_URL="{{ BASE_URL }}"
UID="{{ UID }}"
EXE_LOGIC="{{ EXE_LOGIC }}"
ENVIRONMENT="{{ ENVIRONMENT }}"
CRON_SCHEDULE="{{ CRON }}"

INSTALL_DIR="/opt/Astraea-Agent"

echo "--- Fetching Astraea Agent Package ---"
mkdir -p $INSTALL_DIR
# Use internal API key to download the core tarball
curl -sSL -H "X-Api-Key: $API_KEY" -o astraea_agent.tar.gz "$BASE_URL/api/config/agent_file/"
tar -xzf astraea_agent.tar.gz -C $INSTALL_DIR
cd $INSTALL_DIR

# 2. FAILSAFE: Download Logic-Specific Script
# If the logic isn't standard, we download the patching-week script from the server
if [ "$EXE_LOGIC" != "standard" ]; then
    echo "--- Downloading Logic Script: $EXE_LOGIC ---"
    # We call back to the view asking for the 'logic_script'
    curl -sSL -o "patching-$EXE_LOGIC.sh" \
         "$BASE_URL/api/config/install_script/$UID/?file=logic_script"
    chmod +x "patching-$EXE_LOGIC.sh"
fi

# 3. Configures '.env'
if [ -f ".env_example" ]; then
    if [ ! -f ".env" ]; then
        cp ".env_example" "backend/.env"
        echo ".env"
    else
        echo ".env already exists, skipping copy."
    fi
else
    echo "Warning: env_example not found."
fi

# 4. Edit .env
sed -i "s|^API_KEY=.*|API_KEY=$API_KEY|" .env
sed -i "s|^ENV=.*|ENV=$ENVIRONMENT|" .env
sed -i "s|^BASE_URL=.*|BASE_URL=$BASE_URL|" .env

echo "--- Configuration Applied ---"

# 5. Determine Execution Path
if [ "$EXE_LOGIC" == "week1and3" ]; then
    EXEC_CMD="/bin/bash $INSTALL_DIR/patching-week1and3.sh"
elif [ "$EXE_LOGIC" == "week2and4" ]; then
    EXEC_CMD="/bin/bash $INSTALL_DIR/patching-week2and4.sh"
else
    EXEC_CMD="/usr/bin/python3 $INSTALL_DIR/core/initialize.py"
fi

# 6. Cron Setup
(crontab -l 2>/dev/null | grep -v "$INSTALL_DIR"; echo "$CRON_SCHEDULE cd $INSTALL_DIR && $EXEC_CMD >> /var/log/astraea-patch-cron.log 2>&1") | crontab -

echo "--- Installation Complete: Logic [$EXE_LOGIC] applied ---"