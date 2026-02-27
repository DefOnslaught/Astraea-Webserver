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

# 6. Set Directory Permissions
# Assuming script is run from inside the Astraea-Webserver directory
PROJECT_ROOT=$(pwd)
echo "📂 Setting permissions for $PROJECT_ROOT..."

sudo usermod -a -G $TARGET_USER www-data
sudo chown -R $TARGET_USER:www-data "$PROJECT_ROOT"
sudo chmod -R 750 "$PROJECT_ROOT"

echo "-------------------------------------------------------"
echo "✅ Setup Complete!"
echo "1. Ensure your database 'astraea' is created."
echo "2. Edit your .env files."
echo "3. Run 'make initialSetup' to finish the deployment."
echo "-------------------------------------------------------"