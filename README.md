# Astraea: Centralized Patching Manager
Astraea is a robust Server Patching Management system designed to provide a unified dashboard for system updates. It works in tandem with the Astraea Agent to monitor installed packages, schedule patches, and track system health across your infrastructure.

## 🛠 Prerequisites For Bare Metal (Non Docker)
    Python 3.10+ - Required for Django 6.0 features

    Redis Server 6.0+ - Used for Astraea background tasks

    Node.js v18+ - Required for Vite

    Nginx - To serve the content

    MySQL/MariaDB	8.0 / 10.5	- Ensure utf8mb4 encoding is used

    Assumes Parent Directory is /opt

## 🚀 Installation (Bare Metal)
Follow these steps to get the Astraea environment running manually.

### 1. Run Quick Install Script
```bash
./setup.sh
```

### 2. Database Preparation

Astraea requires a MySQL or Postgres database. It is highly recommended to create a dedicated database user rather than using root.

**Login to your Database Server**
```bash
# Enter your admin password when prompted
mysql -u root -p
```

**Execute the following SQL commands**

Replace `your_secure_password` with a strong password of your choice.

```bash
-- 1. Create the database with UTF8MB4 support for modern emoji/special char handling
CREATE DATABASE astraea CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create a dedicated user for the Astraea application
-- Use 'localhost' if the DB is on the same machine, or '%' if it is remote
CREATE USER 'astraea_user'@'%' IDENTIFIED BY 'your_secure_password';

-- 3. Grant all privileges on the astraea database to this user
GRANT ALL PRIVILEGES ON astraea.* TO 'astraea_user'@'%';

-- 4. Apply the changes
FLUSH PRIVILEGES;
EXIT;
```

> [!TIP]
> **Keep these credentials handy!** You will need to input the Database Name (`astraea`), User (`astraea_user`), and `Password` into your `backend/.env` file in the next step.

**🧪 Quick Verification**

Before proceeding to the application setup, you can verify the credentials work by trying to log in as the new user:
```bash
mysql -u astraea_user -p your_secure_password
```

### 3. Edit Required Files
Files to edit in-order for the webserver and frontend to work correctly

    backend/.env
    backend/backend/settings.py - Verify settings look correct most info is handled via .env
    frontend/.env


### 3. Run Required Make Commands
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

### 4. First-Time Configuration
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
| make deploy | skip=no | Runs unit tests, builds the frontend and backend, and restarts services. *arg used to skip test -Optional |
| make buildBackend | | skip=yes | Builds Backend, restarts services. *arg used to skip test -Optional |
| make buildFrontend | | Builds Frontend |
| make test | skip=yes | Executes the Django test suite. *arg used to skip test -Optional |
| make test-only | app=app.tests | Runs specific app tests. *arg usage: app=servers.tests.PatchingSystemTests |
| make clearCache | | Clears the cache. |
| make docker-up | | Builds and Starts the Docker Container. |
| make docker-down | | Brings down the containers. |
| make docker-status | | Shows status of the containers. |
| make docker-logs | | Shows the logs. |

## 🐳 Installing With Docker
> [!WARNING]
> This requires you to install the `docker-compose-plugin`, find how to install it at [Docker Docs](https://docs.docker.com/compose/install/linux/)

### Before Running Commands!
Before running the command below, ensure your `backend/.env` is updated for the container network

```bash
DB_HOST=db
REDIS_URL=redis://redis:6379/1
DB_PASSWORD=your_secure_password - Must match with the docker-compose.yml `MYSQL_ROOT_PASSWORD`
```

Ensure your `frontend/.env` is correctly pointing to your server (if testing locally, localhost will work)
```bash
VITE_API_URL=http://localhost
```

**Build and Start**

```bash
make docker-up
```
> [!WARNING]
> **Security:** Change the password of the default admin account immediately upon first login!

**Default Admin Credentials**
```bash
Username = 'admin@astraea.local'
Password = 'AstraeaAdmin123!'
```

**Accessing the Administrator Dashboard**

The Administrator Dashboard is available at `http://localhost/admin/`