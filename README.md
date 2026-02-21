# Astraea: Centralized Patching Manager
Astraea is a robust Server Patching Management system designed to provide a unified dashboard for system updates. It works in tandem with the Astraea Agent to monitor installed packages, schedule patches, and track system health across your infrastructure.

## 🛠 Prerequisites For Bare Metal (Non Docker)
    Python 3.10+ & venv

    MySQL Server - Changes to configuration files will be needed in order to use anything else

    Redis Server (for caching and background tasks)

    Node.js (v18+) & npm (for the Vite frontend)

    Nginx (to serve the content)

    Assumes Parent Directory is /opt

    Assumes user account called `darren` - if different, changes to folder perms and service files needed

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

> [!WARNING]
> **User Account Setup:**</br>
> The service files in `backend/1_Host_Required_Files` are configured for a user named `darren`. If your username is different, run this command to update them before running `make initialSetup`:
```bash
sed -i 's/darren/YOUR_USERNAME/g' backend/1_Host_Required_Files/gunicorn.service
```

**Database Preparation**

We must create a database table before we can deploy the site. Ensure you also make a user as well with full permissions to the table.
```sql
CREATE DATABASE astraea;
```

**Directory Permissions**

If you encounter 403 Forbidden errors on the web interface, ensure the proper permissions are setup and `www-data` user can access everything - change `darren` if your username is different
```bash
sudo usermod -a -G darren www-data
sudo chown darren:www-data -R /opt/Astraea-Webserver
sudo chmod 750 /opt/Astraea-Webserver
```

### 3. Edit Required Files
Files to edit in-order for the webserver and frontend to work correctly

    backend/.env
    backend/backend/settings.py - Verify settings look correct most info is handled via .env
    frontend/.env


### 4. Run Required Make Commands
> [!WARNING]
> This assumes the full directory of the webserver is `/opt/Astraea-Webserver` if it's not, you will have to edit the files in `backend/1_Host_Required_Files`.</br>

Leverage the Makefile to handle the virtual environment, Python dependencies, and initial database migrations:

**Initial Setup**

Creates Gunicorn System Files/Nginx config & log files, Python venv, installs dependencies, configures any migrations
```bash
make initialSetup
```

**Build & Deploy**

Runs unit tests, builds the frontend and backend, and restarts services.
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

**Create Secret Key**

If you have not created a Secret Key for `backend/.env` do so now, and save it
```bash
backend/venv/bin/python backend/manage.py generate_secret_key
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
| make status | | Primary Health Check. Shows service status, disk usage, and pending migrations.  |
| make initialSetup | | Creates Python venv, installs dependencies, configures any migrations, creates Gunicorn service files, Nginx config files and log files. |
| make deploy | skip=yes | Runs unit tests, builds the frontend and backend, and restarts services. *arg used to skip test -Optional |
| make buildBackend | | skip=yes | Builds Backend, restarts services. *arg used to skip test -Optional |
| make buildFrontend | | Builds Frontend |
| make test | skip=yes | Executes the Django test suite. *arg used to skip test -Optional |
| make test-only | app=app.tests | Runs specific app tests. *arg usage: app=servers.tests.PatchingSystemTests |
| make clearCache | | Clears the cache. |

## Installing With Docker
Status: Development in progress. Dockerfile and docker-compose configurations are coming in v1.1.0.