# 🌌 Astraea: Centralized Patching Manager

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0+-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react&logoColor=black)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Astraea** is a high-performance Server Patching Management system designed to provide a unified command center for infrastructure maintenance. It works in tandem with the **Astraea Agent** to automated patching toggles, patching history, view all packages installed in your infrastructure across distributed Linux environments.

---

## 🏗️ Architecture Overview

Astraea utilizes a central Hub-and-Spoke model:

* **Astraea Dashboard:** A Django/React web interface for administrators.
* **Task Engine:** Redis & Celery-powered asynchronous workers for handling fleet-wide patch triggers.
* **Remote Agents:** Lightweight Python agent installed on target nodes that report back to the Centralized Manager via a secure REST API.
* **Caching:** Powered by **Redis**, our caching layer is built with absolute speed in mind. By offloading frequently accessed session data and volatile system metrics to an in-memory store, Astraea ensures **extremely fast results** and a highly responsive UI, even when managing a massive fleet of distributed agents.

---

## 🛠️ Prerequisites (Bare Metal)

Before installation, ensure your host meets the following requirements:

| Component | Requirement | Purpose |
| :--- | :--- | :--- |
| **Python** | 3.10+ | Django 6.0 Core & Automation Scripts |
| **Node.js** | v18+ | Vite Frontend Tooling |
| **Redis** | 6.0+ | Message Broker for Background Tasks |
| **Database** | MySQL 8.0+ / ProstgreSQL 15+ | Relational Data Store (utf8mb4) |
| **Web Server** | Nginx | Reverse Proxy & Static File Hosting |

---

## 🚀 Installation (Bare Metal)

### 1. Environment Preparation

Clone the repository to `/opt/Astraea-Webserver` and run the initial setup script:

```bash
cd /opt
git clone https://github.com/DefOnslaught/Astraea-Webserver.git
cd Astraea-Webserver
chmod +x setup.sh
./setup.sh
```

### 2. Database Configuration

Choose the block corresponding to your database engine. Replace `your_secure_password` with a strong credential.

#### Option A: MySQL / MariaDB

```sql
-- Create database with proper encoding for Django
CREATE DATABASE astraea CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (Use 'localhost' if DB is on the same machine as Astraea)
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

Edit the environment files to link your database and secret keys.

1. **Backend:** `backend/.env`
2. **Frontend:** `frontend/.env`

### 4. Generate Secret Key

If you haven't defined a `SECRET_KEY` in your `.env`, generate one now:

```bash
backend/venv/bin/python backend/manage.py generate_secret_key
```

### 5. Deployment via Makefile

The included Makefile automates the heavy lifting of service configuration and migration.

```bash
# Initialize venv, dependencies, Nginx, and Gunicorn
make initialSetup

# Run migrations and deploy the stack
make deploy
```

---

## 🔐 Superuser Setup

### Create Superuser

Grant yourself full access to the administration dashboard:

```bash
backend/venv/bin/python backend/manage.py createsuperuser
```

> [!IMPORTANT]
> **RBAC Visibility:** Only users marked as `is_staff` or `is_superuser` will see the **Administration** tab in the sidebar. With no access to Django's Admin page.

---

## 🐳 Containerized Deployment (Docker)

For rapid deployment or testing, use the provided Docker Compose configuration.

### Configuration

Update `backend/.env` for internal container networking:

* `DB_HOST=db`
* `REDIS_URL=redis://redis:6379/0`

### Build & Up

```bash
make docker-up
```

**Default Credentials:**

* **URL:** `http://localhost/`
* **Admin User:** `admin@astraea.local`
* **Password:** `AstraeaAdmin123!`

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
