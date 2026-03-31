#!/bin/bash

# 1. Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS. Please install dependencies manually."
    exit 1
fi

# 2. Get User Customization
echo "-------------------------------------------------------"
echo "Astraea Bare Metal Setup"
echo "-------------------------------------------------------"
# Default to current logged in user if they press enter
read -p "Enter the system username that will run Astraea [$(whoami)]: " TARGET_USER
TARGET_USER=${TARGET_USER:-$(whoami)}

echo "Using system user: $TARGET_USER"
echo "Detecting system: $OS..."

# 3. Install Dependencies
case $OS in
    ubuntu|debian|raspbian|kali)
        sudo apt update
        sudo apt install -y python3-dev python3-venv python3-pip \
        default-libmysqlclient-dev build-essential pkg-config \
        redis-server nodejs npm nginx git curl libssl-dev \
        libjpeg-dev zlib1g-dev libffi-dev
        ;;
    
    fedora|centos|rhel|almalinux|rocky)
        if [[ "$OS" != "fedora" ]]; then
            sudo dnf install -y epel-release
        fi
        sudo dnf groupinstall -y "Development Tools"
        sudo dnf install -y python3-devel python3-pip mariadb-devel \
        gcc gcc-c++ make pkgconf-pkg-config redis nodejs nginx git curl \
        openssl-devel libjpeg-turbo-devel zlib-devel libffi-devel redhat-rpm-config
        ;;

    arch)
        sudo pacman -Syu --noconfirm --needed base-devel python python-pip \
        mariadb-libs redis nodejs npm nginx git curl openssl \
        libjpeg-turbo zlib libffi pkgconf
        ;;

    *)
        echo "❌ Unsupported OS: $OS."
        exit 1
    ;;
esac

# 4. Start Base Services
sudo systemctl enable redis
sudo systemctl start redis

# 5. Automated Replacements (Replacing 'darren' with $TARGET_USER)
echo "🔧 Configuring service files and permissions for $TARGET_USER..."

# Replace username in Gunicorn service file
if [ -f "backend/1_Host_Required_Files/gunicorn.service" ]; then
    sed -i "s/darren/$TARGET_USER/g" backend/1_Host_Required_Files/gunicorn.service
    echo "✅ Updated gunicorn.service"
else
    echo "⚠️  Warning: gunicorn.service not found in expected path."
fi

# Replace username in Astraea Worker service file
if [ -f "backend/1_Host_Required_Files/astraea-worker.service" ]; then
    sed -i "s/darren/$TARGET_USER/g" backend/1_Host_Required_Files/astraea-worker.service
    echo "✅ Updated astraea-worker.service"
else
    echo "⚠️  Warning: astraea-worker.service not found in expected path."
fi

# Replace username in Astraea Beat service file
if [ -f "backend/1_Host_Required_Files/astraea-beat.service" ]; then
    sed -i "s/darren/$TARGET_USER/g" backend/1_Host_Required_Files/astraea-beat.service
    echo "✅ Updated astraea-beat.service"
else
    echo "⚠️  Warning: astraea-beat.service not found in expected path."
fi

# 6 Nginx Configuration & Proxy Setup
echo "🌐 Configuring Nginx..."

read -p "Enter the Domain or IP for this server (e.g. astraea.lan 192.168.1.50) [astraea.lan localhost]: " SRV_NAME
SRV_NAME=${SRV_NAME:-"astraea.lan localhost"}

read -p "Is this webserver behind a reverse proxy? (y/n) [n]: " IS_PROXY
IS_PROXY=${IS_PROXY:-n}

# Define paths
NGINX_CONF_SRC="backend/1_Host_Required_Files/nginx_configuration"
NGINX_DEST="/etc/nginx/sites-available/astraea-webserver"
LOG_DIR="/var/log/nginx/astraea"
ACCESS_LOG="access.log"
ERROR_LOG="error.log"

# Create log directory and set permissions
sudo mkdir -p $LOG_DIR
sudo touch $LOG_DIR/$ACCESS_LOG
sudo touch $LOG_DIR/$ERROR_LOG
sudo chown -R www-data:adm $LOG_DIR
sudo chmod 775 -R $LOG_DIR

if [ -f "$NGINX_CONF_SRC" ]; then
    # Copy to sites-available
    sudo cp "$NGINX_CONF_SRC" "$NGINX_DEST"

    # Update server name
    echo "Configuring server_name as: $SRV_NAME"
    sudo sed -i "s/server_name .*/server_name $SRV_NAME;/g" "$NGINX_DEST"

    if [[ "$IS_PROXY" =~ ^[Yy]$ ]]; then
        read -p "Enter the IP address of the Reverse Proxy: " PROXY_IP
        echo "Configuring Nginx for proxy at $PROXY_IP..."
        
        # Update the specific lines in the copied file
        sudo sed -i "s/set_real_ip_from .*/set_real_ip_from $PROXY_IP;/g" "$NGINX_DEST"
        # Ensure the real_ip lines are active (remove # if they were commented)
        sudo sed -i "s/# real_ip_header/real_ip_header/g" "$NGINX_DEST"
    else
        echo "Standard setup detected. Commenting out proxy-specific real_ip directives..."
        sudo sed -i "s/real_ip_header/# real_ip_header/g" "$NGINX_DEST"
        sudo sed -i "s/set_real_ip_from/# set_real_ip_from/g" "$NGINX_DEST"
    fi

    # Create symlink to sites-enabled
    sudo ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/
    
    # Remove default nginx config if it exists to avoid port 80 conflicts
    if [ -f /etc/nginx/sites-enabled/default ]; then
        sudo rm /etc/nginx/sites-enabled/default
    fi

    echo "🔍 Verifying Nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx configuration is valid."
    else
        echo "❌ Nginx configuration test failed! Check $NGINX_DEST for errors."
    fi
else
    echo "❌ Error: nginx_configuration source file not found!"
fi

# 7. Environment File Setup
echo "📝 Setting up environment files..."

# Backend .env
if [ -f "backend/.env_example" ]; then
    if [ ! -f "backend/.env" ]; then
        cp "backend/.env_example" "backend/.env"
        echo "✅ Created backend/.env"
    else
        echo "ℹ️  backend/.env already exists, skipping copy."
    fi
else
    echo "⚠️  Warning: backend/.env_example not found."
fi

# Frontend .env
if [ -f "frontend/.env_example" ]; then
    if [ ! -f "frontend/.env" ]; then
        cp "frontend/.env_example" "frontend/.env"
        echo "✅ Created frontend/.env"
    else
        echo "ℹ️  frontend/.env already exists, skipping copy."
    fi
else
    echo "⚠️  Warning: frontend/.env_example not found."
fi

# 8. Set Directory Permissions
# Assuming script is run from inside the Astraea-Webserver directory
PROJECT_ROOT=$(pwd)
echo "📂 Setting permissions for $PROJECT_ROOT..."

sudo usermod -a -G $TARGET_USER www-data
sudo chown -R $TARGET_USER:www-data "$PROJECT_ROOT"
sudo chmod -R 750 "$PROJECT_ROOT"

echo "-------------------------------------------------------"
echo "✅ Setup Complete!"
echo "1. Ensure your database 'astraea' is created."
echo "2. Edit your .env files. (backend/.env & frontend/.env)"
echo "3. Run 'make initialSetup' to finish the deployment."
echo "-------------------------------------------------------"