# 🌌 Astraea: Centralized Patching Manager

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0+-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-26+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Astraea** is a high-performance Server Patching Management system designed to provide a unified command center for infrastructure maintenance. It works in tandem with the [Astraea Agent](https://github.com/DefOnslaught/Astraea-Agent) to automate patching toggles, track patching history, and monitor installed packages across distributed Linux environments.

---

## 🏗️ Architecture Overview

Astraea utilizes a central Hub-and-Spoke model:

* **Astraea Dashboard:** A Django/React web interface for system administrators.
* **Task Engine:** Redis & Celery-powered asynchronous workers for handling fleet-wide patch triggers and external service integrations (like Zabbix maintenance windows), ensuring the web dashboard remains non-blocking and highly responsive.
* **Remote Agents:** Lightweight Python agent installed on target nodes that report back to the Centralized Manager via a secure REST API.
* **Caching:** Powered by **Redis**, our caching layer is built with absolute speed in mind. By offloading frequently accessed session data and volatile system metrics to an in-memory store, Astraea ensures **extremely fast results** and a highly responsive UI, even when managing a massive fleet of distributed agents.
* **Notifications:** Sends notifications to configured services such as Email or Discord. Can be toggled per server, patch status, or notify for any out of date servers.
* **Zabbix Support:** Integrates with Zabbix to automatically handle maintenance windows during patching cycles.

---

## 🛠️ Prerequisites (Bare Metal)

Before installation, ensure your host meets the following requirements:

| Component | Requirement | Purpose |
| :--- | :--- | :--- |
| **OS** | Ubuntu/Debian/RHEL | Supported by automated `setup.sh` |
| **Python** | 3.10+ | Django 6.0 Core & Automation Scripts |
| **Node.js** | v20+ | Vite Frontend Tooling |
| **Redis** | 6.0+ | Message Broker for Background Tasks |
| **Database** | MySQL 8.0+ / PostgreSQL 15+ | Relational Data Store (utf8mb4) |
| **Web Server** | Nginx | Serving the Website |

---

## 🚀 Installation (Bare Metal)

### Important File Locations

These files are ones that you either need to change, or at least inspect to ensure the  site is configured how you want it.

```bash
# Settings.py
backend/backend/settings.py

# Backend .env
backend/.env

# Frontend .env
frontend/.env
```

### 1. Environment Preparation

The included `setup.sh` automates dependency installation, Nginx site configuration, service files, and system permissions.

```bash
cd /opt
git clone https://github.com/DefOnslaught/Astraea-Webserver.git
cd Astraea-Webserver
chmod +x setup.sh
./setup.sh
```

*Note: The script will prompt for your preferred system user and Nginx `server_name`.*

### 2. Database Configuration

Choose the block corresponding to your database engine. Replace `your_secure_password` with a strong credential.

#### Option A: MySQL / MariaDB

```sql
-- Create database with proper encoding for Django
CREATE DATABASE astraea CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (Use 'localhost' if DB is on the same machine as Astraea, otherwise '%')
CREATE USER 'astraea_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON astraea.* TO 'astraea_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Option B: PostgreSQL

```sql
-- Create database
CREATE DATABASE astraea;

-- Create user and grant privileges
CREATE USER astraea_user WITH PASSWORD 'your_secure_password';
ALTER ROLE astraea_user SET client_encoding TO 'utf8';
ALTER ROLE astraea_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE astraea_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE astraea TO astraea_user;
```

### 3. Application Secrets

Edit the environment files to link your database and secret keys. (copy .env_example to make .env files)

1. **Backend:** `backend/.env`
2. **Frontend:** `frontend/.env`

### 4. Core Initialization

Run the Makefile's initial setup. This creates the Python virtual environment (`venv`), installs project-specific requirements, and prepares Gunicorn.

```bash
# This creates the venv and installs all Python/Node dependencies
make initialSetup
```

### 5. Finalizing Deployment

Once the environment is initialized, generate your unique security keys and deploy the services.

```bash
# Generate a Django Secret Key (if not manually set in .env)
backend/venv/bin/python backend/manage.py generate_secret_key

# Run migrations, build frontend assets, and restart services
make deploy
```

---

## 🔐 Administration

### Create Superuser

Grant yourself full access to the administration dashboard:

```bash
backend/venv/bin/python backend/manage.py createsuperuser
```

> [!IMPORTANT]
> **RBAC Visibility:** Only users marked as `is_staff` or `is_superuser` will see the **Administration** tab in the sidebar. Users with `is_superuser` will be able to access to Django's Admin page.

---

## 🐳 Containerized Deployment (Docker) - WORK IN PROGRESS NOT TESTED

For rapid deployment using Docker Compose, Astraea provides a pre-configured multi-container stack including the Web Server, Celery Worker, Celery Beat, Redis, and MySQL.

### 1. Configure Environment

Update your `backend/.env` to use Docker's internal networking. In Docker, services communicate using their service names defined in `docker-compose.yml`.

```env
# Database - Matches the 'db' service in compose
DB_HOST=db
DB_NAME=astraea_db
DB_USER=root
DB_PASSWORD=secretpassword

# Redis - Matches the 'redis' service in compose
# Using separate DB indexes (0 and 1) to isolate Cache from Task Broker
REDIS_URL=redis://redis:6379/0
CELERY_REDIS_URL=redis://redis:6379/1
```

Update your `frontend/.env` to use Dockers internal networking.

```env
VITE_API_URL=web
```

### 2. Launch the Stack

Run the following command from the root directory:

```bash
docker compose up -d --build
```

### 3. Access & Health

Once the containers are healthy:

* **Web UI:** [http://localhost](http://localhost)
* **Default Admin:** `admin@astraea.local` / `AstraeaAdmin123!`

**Note:** On the first boot, the `web` container automatically handles database migrations, superuser creation, and static file collection.

### 4. Container Management

| Action | Command |
| :--- | :--- |
| **View Logs** | `docker-compose logs -f` |
| **Stop Stack** | `docker-compose down` |
| **Restart Worker** | `docker-compose restart worker` |
| **Shell Access** | `docker-compose exec web bash` |

---

## ⌨️ Makefile Commands Reference

| Command | Description |
| :--- | :--- |
| `make help` | Displays all available commands and arguments |
| `make status` | **Primary Health Check.** Shows service status and pending migrations. |
| `make initialSetup` | Configures venv, Nginx, Gunicorn, and logs. |
| `make deploy` | Runs tests, builds both tiers, and restarts services. |
| `make buildBackend` | Rebuilds the Django core and restarts Gunicorn. |
| `make buildFrontend` | Rebuilds the Vite/React static assets. |
| `make test` | Executes the full Django test suite. |
| `make clearCache` | Purges the Redis cache and temporary files. |

---
