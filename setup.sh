#!/bin/bash

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS. Please install dependencies manually."
    exit 1
fi

install_nodejs_v26() {
    echo "📦 Installing Node.js v26..."
    
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        sudo apt-get purge -y nodejs npm
        sudo apt-get autoremove -y
        sudo apt-get install -y ca-certificates curl gnupg
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_26.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
        sudo apt-get update
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "fedora" || "$OS" == "centos" || "$OS" == "rhel" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_26.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    
    echo "✅ Node.js $(node -v) installed successfully."
}


echo "-------------------------------------------------------"
echo "Astraea Bare Metal Setup"
echo "-------------------------------------------------------"

read -p "Enter the system username that will run Astraea [$(whoami)]: " TARGET_USER
TARGET_USER=${TARGET_USER:-$(whoami)}

echo "Using system user: $TARGET_USER"
echo "Detecting system: $OS..."

case $OS in
    ubuntu|debian)
        sudo apt update
        sudo apt install -y python3-dev python3-venv python3-pip \
        default-libmysqlclient-dev build-essential pkg-config \
        redis-server nginx curl libssl-dev \
        libjpeg-dev zlib1g-dev libffi-dev
        install_nodejs_v26
        ;;
    
    fedora|centos|rhel)
        if [[ "$OS" != "fedora" ]]; then
            sudo dnf install -y epel-release
        fi
        sudo dnf groupinstall -y "Development Tools"
        sudo dnf install -y python3-devel python3-pip \
        gcc gcc-c++ make pkgconf-pkg-config redis nginx curl \
        openssl-devel libjpeg-turbo-devel zlib-devel libffi-devel redhat-rpm-config
        install_nodejs_v26
        ;;

    *)
        echo "❌ Unsupported OS: $OS."
        exit 1
    ;;
esac

sudo systemctl enable redis-server
sudo systemctl start redis-server

echo "🔧 Configuring service files and permissions for $TARGET_USER..."

SRC_DIR="backend/1_Host_Required_Files"
DEST_DIR="/etc/systemd/system"

SERVICES=("gunicorn.service" "astraea-worker.service" "astraea-beat.service")

for SVC in "${SERVICES[@]}"; do
    if [ -f "$SRC_DIR/$SVC" ]; then
        sed -i "s/darren/$TARGET_USER/g" "$SRC_DIR/$SVC"
        
        sudo cp "$SRC_DIR/$SVC" "$DEST_DIR/"

        echo "✅ Configured $SVC"
    else
        echo "⚠️  Warning: $SVC not found in $SRC_DIR"
    fi
done

if [ -f "$SRC_DIR/gunicorn.socket" ]; then
    sudo cp "$SRC_DIR/gunicorn.socket" "$DEST_DIR/"
    echo "✅ Configured gunicorn.socket"
else
    echo "⚠️  Warning: gunicorn.socket not found in $SRC_DIR"
fi

echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "🌐 Configuring Nginx..."

read -p "Enter the Domain or IP for this server (e.g. astraea.lan 192.168.1.50) [astraea.lan localhost]: " SRV_NAME
SRV_NAME=${SRV_NAME:-"astraea.lan localhost"}

read -p "Is this webserver behind a reverse proxy? (y/n) [n]: " IS_PROXY
IS_PROXY=${IS_PROXY:-n}

NGINX_CONF_SRC="backend/1_Host_Required_Files/nginx_configuration"
NGINX_DEST="/etc/nginx/sites-available/astraea-webserver"
LOG_DIR="/var/log/nginx/astraea"
ACCESS_LOG="access.log"
ERROR_LOG="error.log"

sudo mkdir -p $LOG_DIR
sudo touch $LOG_DIR/$ACCESS_LOG
sudo touch $LOG_DIR/$ERROR_LOG
sudo chown -R www-data:adm $LOG_DIR
sudo chmod 775 -R $LOG_DIR

if [ -f "$NGINX_CONF_SRC" ]; then
    sudo cp "$NGINX_CONF_SRC" "$NGINX_DEST"

    echo "Configuring server_name as: $SRV_NAME"
    sudo sed -i "s/server_name .*/server_name $SRV_NAME;/g" "$NGINX_DEST"

    if [[ "$IS_PROXY" =~ ^[Yy]$ ]]; then
        read -p "Enter the IP address of the Reverse Proxy: " PROXY_IP
        echo "Configuring Nginx for proxy at $PROXY_IP..."
        
        sudo sed -i "s/set_real_ip_from .*/set_real_ip_from $PROXY_IP;/g" "$NGINX_DEST"
        sudo sed -i "s/# real_ip_header/real_ip_header/g" "$NGINX_DEST"
    else
        echo "Standard setup detected. Commenting out proxy-specific real_ip directives..."
        sudo sed -i "s/real_ip_header/# real_ip_header/g" "$NGINX_DEST"
        sudo sed -i "s/set_real_ip_from/# set_real_ip_from/g" "$NGINX_DEST"
    fi

    sudo ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/
    
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

echo "📝 Setting up environment files..."

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

PROTECTED_PATH="$PROJECT_ROOT/protected_storage"
if [ ! -d "$PROTECTED_PATH" ]; then
    echo "📂 Creating protected storage directory..."
    sudo mkdir -p "$PROTECTED_PATH"
    echo "✅ Protected storage directory ready."
fi

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