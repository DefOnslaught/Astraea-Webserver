.PHONY: greeting buildFrontend deploy initialSetup restart clearCache help

### Unique variables per project
PROJECT_NAME = "Astraea"
VERSION = "v1.0.0"

### Styling variables
BLACK   = \033[0;30m
RED     = \033[0;31m
GREEN   = \033[0;32m
YELLOW  = \033[0;33m
BLUE    = \033[0;34m
MAGENTA = \033[0;35m
CYAN    = \033[0;36m
WHITE   = \033[0;37m

BOLD_BLACK   = \033[1;30m
BOLD_RED     = \033[1;31m
BOLD_GREEN   = \033[1;32m
BOLD_YELLOW  = \033[1;33m
BOLD_BLUE    = \033[1;34m
BOLD_MAGENTA = \033[1;35m
BOLD_CYAN    = \033[1;36m
BOLD_WHITE   = \033[1;37m

UNDERLINE_BLACK   = \033[4;30m
UNDERLINE_RED     = \033[4;31m
UNDERLINE_GREEN   = \033[4;32m
UNDERLINE_YELLOW  = \033[4;33m
UNDERLINE_BLUE    = \033[4;34m
UNDERLINE_MAGENTA = \033[4;35m
UNDERLINE_CYAN    = \033[4;36m
UNDERLINE_WHITE   = \033[4;37m

BACKGROUND_BLACK   = \033[40m
BACKGROUND_RED     = \033[41m
BACKGROUND_GREEN   = \033[42m
BACKGROUND_YELLOW  = \033[43m
BACKGROUND_BLUE    = \033[44m
BACKGROUND_MAGENTA = \033[45m
BACKGROUND_CYAN    = \033[46m
BACKGROUND_WHITE   = \033[47m

RESET = \033[0m

# Helper for Python in Venv
VENV_PYTHON = backend/venv/bin/python
VENV_PIP = backend/venv/bin/pip

### Greeting message
define GREETING
	@echo "$(GREEN)$(VERSION)$(RESET)"
	@echo "================================================================="
	@echo "$(YELLOW)*****************" $(PROJECT_NAME) "*******************$(RESET)"
	@echo "=================================================================\n"
endef


### Show greeting message
greeting:
	$(GREETING)

### Builds Frontend
buildFrontend:
	@echo "$(GREEN)Starting frontend build...$(RESET)"
	@mkdir -p frontend/dist/assets
	@echo "$(BLUE)Cleaning old assets...$(RESET)"
	@rm -f frontend/dist/assets/index-*.js frontend/dist/assets/index-*.css
	@cd frontend && npm install && npm run build || (echo "$(RED)Frontend build failed$(RESET)"; exit 1)


### Deploy project, clears any cache, restarts the service
deploy: buildFrontend
	@echo "$(GREEN)Deploying Django...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py collectstatic --noinput || (echo "$(RED)Static collection failed$(RESET)"; exit 1)
	@echo "$(BLUE)Restarting Services...$(RESET)"
	@sudo systemctl restart gunicorn
	@sudo systemctl restart nginx
	@$(VENV_PYTHON) backend/manage.py clear_cache || echo "$(YELLOW)Cache clear failed, skipping...$(RESET)"
	@echo "$(GREEN)Deployment Complete!$(RESET)"


### Restarts core system web services
restart:
	@echo "$(BLUE)Restarting Gunicorn$(RESET)"
	@sudo systemctl restart gunicorn || exit 1
	@echo "$(BLUE)Restarting NGINX$(RESET)"
	@sudo systemctl restart nginx || exit 1
	@echo "$(BLUE)Clearing Cache$(RESET)"
	@$(VENV_PYTHON) backend/manage.py clear_cache || exit 1


### Handles creating any migrations, groups, or folders
initialSetup: virtualenv
	@echo "$(BLUE)Running Migrations...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py wait_for_db || exit 1
	@$(VENV_PYTHON) backend/manage.py makemigrations || exit 1
	@$(VENV_PYTHON) backend/manage.py migrate || exit 1
	@echo "$(GREEN)Finished initial setup$(RESET)"
	@echo "$(BOLD_CYAN)IMPORTANT:$(RESET) Run '$(VENV_PYTHON) backend/manage.py generate_secret_key' to get your key for .env"


virtualenv:
	@echo "$(BLUE)Setting up Virtualenv...$(RESET)"
	@python3 -m venv backend/venv
	@$(VENV_PYTHON) -m pip install --upgrade pip
	@$(VENV_PYTHON) -m pip install -r backend/requirements.txt || (echo "$(RED)Pip install failed$(RESET)"; exit 1)


### Clears the cache
clearCache:
	@$(VENV_PYTHON) backend/manage.py clear_cache || (echo "$(RED)Clear cache failed$(RESET)"; exit 1)


### Display help information
help:
	$(GREETING)
	@echo "Available commands:"
	@echo "$(BLUE)buildFrontend$(RESET) - Builds Frontend"
	@echo "$(BLUE)deploy$(RESET) - Deploy project to gunicorn"
	@echo "$(BLUE)initialSetup$(RESET) - Configures any migrates, creates needed folders"
	@echo "$(BLUE)restart$(RESET) - Restarts core system web services"
	@echo "$(BLUE)clearCache$(RESET) - Clears the cache"