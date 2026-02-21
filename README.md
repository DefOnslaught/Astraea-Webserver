# Astraea: Centralized Patching Manager
Astraea is a robust Server Patching Management system designed to provide a unified dashboard for system updates. It works in tandem with the Astraea Agent to monitor installed packages, schedule patches, and track system health across your infrastructure.

## 🛠 Prerequisites For Bare Metal (Non Docker)
    Python 3.10+ & venv

    MySQL Server - Changes to configuration files will be needed in order to use anything else

    Redis Server (for caching and background tasks)

    Node.js (v18+) & npm (for the Vite frontend)

    Nginx (to serve the content)

    Assumes Parent Directory is /opt

### Quick install for Ubuntu
> [!NOTE]
> If your system is not Debian based, then change this command to suite your distro. 
````bash
sudo apt update
sudo apt install python3-dev python3-venv default-libmysqlclient-dev build-essential pkg-config redis-server nodejs npm nginx -y
````

## 🚀 Installation (Bare Metal)
Follow these steps to get the Astraea environment running manually.

### 1. Clone and Environment Setup
````bash
git clone https://github.com/DefOnslaught/Astraea-Webserver.git
cd Astraea-Webserver
cp backend/.env_example backend/.env
cp frontend/.env_example frontend/.env
````

### 2. Database & Directory Permissions
Preparation required:

**Database Preparation**
We must create a database table before we can deploy the site. Ensure you also make a user as well with full permissions to the table.
```sql
CREATE DATABASE astraea;
```

**Directory Permissions**
If you encounter 403 Forbidden errors on the web interface, ensure the Nginx user (www-data) has execution permissions on the `/opt` and `/opt/Astraea-Webserver` directories:
```bash
sudo chmod +x /opt
sudo chmod +x /opt/Astraea-Webserver
```

### 3. Edit Required Files
Files to edit in-order for the webserver and frontend to work correctly

    backend/.env
    backend/backend/settings.py
    frontend/.env

### 4. System Services (Gunicorn & Nginx)
Copy the configuration files provided in the repository to your system directories:

> [!WARNING]
> This assumes the full directory of the webserver is `/opt/Astraea-Webserver` if it's not, you will have to edit the files below

**Gunicorn:**
```bash
sudo cp backend/1.\ Host_Required_Files/gunicorn.service /etc/systemd/system/
sudo cp backend/1.\ Host_Required_Files/gunicorn.socket /etc/systemd/system/
sudo systemctl enable --now gunicorn.socket
```

**Nginx:**
```bash
sudo cp backend/1.\ Host_Required_Files/nginx_configuration /etc/nginx/sites-available/astraea
sudo ln -s /etc/nginx/sites-available/astraea /etc/nginx/sites-enabled/
sudo mkdir /var/log/nginx/astraea/
sudo touch /var/log/nginx/astraea/access.log /var/log/nginx/astraea/error.log
sudo chown www-data:adm -R /var/log/nginx/astraea/
sudo chmod 755 /var/log/nginx/astraea/
sudo chmod 644 -R /var/log/nginx/astraea/
sudo nginx -t && sudo systemctl restart nginx
```

### 5. Run Required Make Commands
Leverage the Makefile to handle the virtual environment, Python dependencies, and initial database migrations:

**Setup Python Environment**
```bash
make initialSetup
```

**Build & Deploy**
```bash
make deploy
```

### 6. First-Time Configuration
Once the deployment is successful, you need to set up your administrative account and prepare the system.

**Create Superuser**
```bash
# Run this from the root directory
backend/venv/bin/python backend/manage.py createsuperuser
```

**Verify System Health**
Run the status check to ensure everything is communicating correctly:
```bash
make status
```

### ⌨️ Makefile Commands reference
The Makefile is the primary way to interact with the Astraea environment, below are some of the primary commands used when building, or wanting to easily restart the stack.


| Command      | Args     | Description |
|--------------|----------|----------|
| make status  |      | Primary Health Check. Shows service status, disk usage, and pending migrations.  |
| make initialSetup | | Creates Python venv, installs dependencies, configures any migrations |
| make deploy | skip=yes | Runs unit tests, builds the frontend and backend, and restarts services. *arg used to skip test -Optional |
| make buildBackend | skip=yes | Builds Backend, restarts services. *arg used to skip test -Optional |
| make buildFrontend |  | Builds Frontend |
| make test | skip=yes | Executes the Django test suite. *arg used to skip test -Optional |
| make test-only | app=app.tests | Runs specific app tests. *arg usage: app=servers.tests.PatchingSystemTests |
| make clearCache | | Clears the cache. |

## Installing With Docker
Status: Development in progress. Dockerfile and docker-compose configurations are coming in v1.1.0.