.PHONY: buildBackend buildFrontend test test-only deploy initialSetup restart clearCache status docker-up docker-down docker-status docker-logs help

### Unique variables per project
PROJECT_NAME = "Astraea"
VERSION = "1.0.0"

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

# Timing Tool - We capture the time to a temp file, then echo it with colors
# The -p flag gives us simple 'real X.XX' output
TIME_CMD = /usr/bin/time -p

# Silenced Recursive Make
M_SILENT = $(MAKE) --no-print-directory

# Updated helper to print the time with colors
# This reads the 'real' time from the output and wraps it in your CYAN styling
define PRINT_TIME
    @if [ -f $(1) ]; then \
        printf "$(BOLD_CYAN)Finished in: $$(grep real $(1) | awk '{print $$2}')s$(RESET)\n"; \
        rm -f $(1); \
    fi
endef

# --- AUTOMATIC GREETING ---
# We only print if MAKELEVEL is 0 (the first call)
ifeq ($(MAKELEVEL),0)
  _GREETING := $(shell printf "=================================================================\n" >&2; \
                     printf "                            $(YELLOW)$(PROJECT_NAME)$(RESET)\n" >&2; \
                     printf "                             $(GREEN)$(VERSION)$(RESET)\n" >&2; \
                     printf "=================================================================\n" >&2)
endif

# --- TIMED TARGETS ---

test:
ifeq ("$(skip)", "yes")
	@echo "$(RED)!WARNING! $(RESET)$(BOLD_MAGENTA)Skipping Unit Tests...$(RESET)"
else
	@$(TIME_CMD) -o .test_time $(M_SILENT) run-tests-internal
	$(call PRINT_TIME,.test_time)
endif

buildBackend: test
	@$(TIME_CMD) -o .buildBackend_time $(M_SILENT) run-buildBackend-internal
	$(call PRINT_TIME,.buildBackend_time)

buildFrontend:
	@$(TIME_CMD) -o .buildFrontend_time $(M_SILENT) run-buildFrontend-internal
	$(call PRINT_TIME,.buildFrontend_time)

test-only:
	@$(TIME_CMD) -o .test_only_time $(M_SILENT) run-test-only-internal app=$(app)
	$(call PRINT_TIME,.test_only_time)

deploy:
	@$(TIME_CMD) -o .deploy_time $(M_SILENT) deploy-internal skip=$(skip)
	$(call PRINT_TIME,.deploy_time)

initialSetup:
	@$(TIME_CMD) -o .initialSetup_time $(M_SILENT) initialSetup-internal
	$(call PRINT_TIME,.initialSetup_time)

restart:
	@$(TIME_CMD) -o .restart_time $(M_SILENT) restart-internal
	$(call PRINT_TIME,.restart_time)

# --- INTERNAL LOGIC (The actual work) ---

run-tests-internal:
	@echo "$(BOLD_MAGENTA)Running Unit Tests...$(RESET)"
	@cd backend && venv/bin/python manage.py test --noinput || ( \
		echo "\n$(BACKGROUND_RED)$(BOLD_WHITE)  TESTS FAILED  $(RESET)"; \
		exit 1; \
	)
	@$(VENV_PYTHON) backend/manage.py clear_cache
	@echo "\n$(BACKGROUND_GREEN)$(BOLD_WHITE)  ALL TESTS PASSED  $(RESET)"

run-test-only-internal:
	@cd backend && venv/bin/python manage.py test $(app) --noinput || ( \
		echo "\n$(BACKGROUND_RED)$(BOLD_WHITE)  TESTS FAILED  $(RESET)"; \
		exit 1; \
	)
	@$(VENV_PYTHON) backend/manage.py clear_cache
	@echo "\n$(BACKGROUND_GREEN)$(BOLD_WHITE)  TESTS PASSED  $(RESET)"

run-buildBackend-internal:
	@echo "$(GREEN)Deploying Django Backend...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py clear_cache || echo "$(YELLOW)Cache clear failed, skipping...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py collectstatic --noinput || exit 1
	@sudo systemctl restart gunicorn
	@sudo systemctl restart nginx

run-buildFrontend-internal:
	@echo "$(GREEN)Starting frontend build...$(RESET)"
	@mkdir -p frontend/dist/assets
	@cd frontend && npm install && npm run build || exit 1

deploy-internal: test buildFrontend
	@echo "$(GREEN)Finalizing Deployment...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py collectstatic --noinput
	@sudo systemctl restart gunicorn
	@sudo systemctl restart nginx
	@echo "$(BOLD_GREEN)Deployment Successful!$(RESET)"

restart-internal:
	@$(VENV_PYTHON) backend/manage.py clear_cache
	@sudo systemctl restart gunicorn
	@sudo systemctl restart nginx
	@echo "$(BLUE)Services Restarted.$(RESET)"

initialSetup-internal: setupGunicorn setupNginx virtualenv
	@$(VENV_PYTHON) backend/manage.py wait_for_db
	@echo "$(BLUE)Running Migrations...$(RESET)"
	@$(VENV_PYTHON) backend/manage.py makemigrations
	@$(VENV_PYTHON) backend/manage.py migrate
	@echo "$(GREEN)Setup Complete.$(RESET)"

virtualenv:
	@python3 -m venv backend/venv
	@backend/venv/bin/pip install -r backend/requirements.txt

setupGunicorn:
	@echo "$(CYAN)Creating Gunicorn Service Files$(RESET)"
	@sudo cp backend/1_Host_Required_Files/gunicorn.service /etc/systemd/system/
	@sudo cp backend/1_Host_Required_Files/gunicorn.socket /etc/systemd/system/
	@sudo systemctl daemon-reload
	@sudo systemctl enable gunicorn.service && sudo systemctl enable gunicorn.socket
	@echo "$(GREEN)Gunicorn Setup Complete$(RESET)"
	
setupNginx:
	@echo "$(CYAN)Creating Nginx Configuration File$(RESET)"
	@sudo cp backend/1_Host_Required_Files/nginx_configuration /etc/nginx/sites-available/astraea
	@sudo ln -sf /etc/nginx/sites-available/astraea /etc/nginx/sites-enabled/

	@echo "$(CYAN)Creating Nginx Log Folder/Files$(RESET)"
	@sudo mkdir /var/log/nginx/astraea/
	@sudo touch /var/log/nginx/astraea/access.log /var/log/nginx/astraea/error.log
	@sudo chown www-data:adm -R /var/log/nginx/astraea/
	@sudo chmod 755 /var/log/nginx/astraea/
	@sudo chmod 644 -R /var/log/nginx/astraea/

	@sudo nginx -t
	@echo "$(GREEN)Nginx Setup Complete$(RESET)"

clean:
	@echo "$(BOLD_RED)Cleaning up...$(RESET)"
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@rm -rf frontend/dist backend/staticfiles

status:
	@printf "$(BOLD_CYAN)--- Astraea System Status ---$(RESET)\n"
	@for service in nginx gunicorn redis-server; do \
		status=$$(systemctl is-active $$service); \
		if [ "$$status" = "active" ]; then \
			printf "$(BOLD_WHITE)%-12s:$(RESET) $(GREEN)ACTIVE$(RESET)\n" "$$service"; \
		else \
			printf "$(BOLD_WHITE)%-12s:$(RESET) $(RED)INACTIVE ($$status)$(RESET)\n" "$$service"; \
		fi; \
	done
	@printf "$(BOLD_WHITE)Server Uptime:$(RESET) %s\n" "$$(uptime -p)"
	@printf "$(BOLD_WHITE)Disk Usage:$(RESET)  %s used\n" "$$(df -h / | awk 'NR==2 {print $$5}')"
	@printf "$(BOLD_WHITE)Memory:$(RESET)      $$(free -m | awk 'NR==2 {print $$3"MB / "$$2"MB"}')\n"
	@$(VENV_PYTHON) backend/manage.py wait_for_db
	@printf "$(BOLD_WHITE)Migrations:$(RESET) "
	@$(VENV_PYTHON) backend/manage.py showmigrations | grep '\[ \]' > /dev/null && \
		printf "$(YELLOW)Pending Migrations Found!$(RESET)\n" || printf "$(GREEN)Up to date$(RESET)\n"
	@printf "$(BOLD_CYAN)-----------------------------$(RESET)\n"

docker-up:
	@echo "$(BOLD_GREEN)Starting Astraea Docker Stack...$(RESET)"
	@docker compose up --build -d
	@echo "$(BOLD_YELLOW)Astraea is starting at http://localhost$(RESET)"
	@echo "$(CYAN)Default Admin: admin / AstraeaAdmin123!$(RESET)"

docker-down:
	@docker compose down

docker-logs:
	@docker compose logs -f

docker-status:
	@docker compose ps

### Display help information
help:
	@echo "$(GREEN)Available commands:$(RESET)"
	@echo "$(BLUE)buildBackend$(RESET) - $(CYAN)Builds Backend, to skip unit testing: make buildBackend skip=yes$(RESET)"
	@echo "$(BLUE)buildFrontend$(RESET) - $(CYAN)Builds Frontend$(RESET)"
	@echo "$(BLUE)test$(RESET) - $(CYAN)Runs all backend test$(RESET)"
	@echo "$(BLUE)test-only$(RESET) - $(CYAN)Runs specific app tests: make test-only app=servers.tests.PatchingSystemTests$(RESET)"
	@echo "$(BLUE)deploy$(RESET) - $(CYAN)Deploy project, to skip unit testing: make deploy skip=yes$(RESET)"
	@echo "$(BLUE)initialSetup$(RESET) - $(CYAN)Configures any migrates$(RESET)"
	@echo "$(BLUE)restart$(RESET) - $(CYAN)Restarts core system web services$(RESET)"
	@echo "$(BLUE)clearCache$(RESET) - $(CYAN)Clears the cache$(RESET)"
	@echo "$(BLUE)clean$(RESET) - $(CYAN)Cleans up python cache, test artifacts, and build files$(RESET)"
	@echo "$(BLUE)status$(RESET) - $(CYAN)Shows status of all core services$(RESET)"
	@echo "$(BLUE)docker-up$(RESET) - $(CYAN)Builds and Starts the Docker Container$(RESET)"
	@echo "$(BLUE)docker-down$(RESET) - $(CYAN)Brings down the containers$(RESET)"
	@echo "$(BLUE)docker-status$(RESET) - $(CYAN)Shows status of the containers$(RESET)"
	@echo "$(BLUE)docker-logs$(RESET) - $(CYAN)Shows the logs$(RESET)"