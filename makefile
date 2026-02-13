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

### Greeting message
define GREETING
	@echo "$(GREEN)$(VERSION)$(RESET)"
	@echo "================================================================="
	@echo "$(YELLOW)*****************" $(PROJECT_NAME) "*******************$(RESET)"
	@echo "=================================================================\n";
endef

### Show greeting message
greeting:
	$(GREETING)

### Builds Frontend
buildFrontend:
	@echo "$(GREEN)Starting frontend build at $(BOLD_BLUE)$$(date +"%T")$(RESET)"

	@echo "$(BLUE)Deleting old static files$(RESET)"
	@cd frontend/dist/assets && find . -name 'index-*.js' -delete && find . -name 'index-*.css' -delete || \
	(echo "$(RED)Error: Deleting old static files failed$(RESET)" && exit 1)
	
	@echo "$(BLUE)Building Front-end$(RESET)"
	@cd frontend && npm run build || \
	(echo "$(RED)Error: Building frontend failed$(RESET)" && exit 1)

### @echo "$(BLUE)Collecting Static$(RESET)"
###	@cd backend && python manage.py collectstatic --noinput || \
	(echo "$(RED)Error: Collecting Static failed$(RESET)" && exit 1)

	@echo "$(GREEN)Finished frontend build"



### Deploy project, clears any cache, restarts the service
deploy:

	@echo "$(GREEN)Starting deployment at $(BOLD_BLUE)$$(date +"%T")$(RESET)"

	@echo "$(BLUE)Deleting old static files$(RESET)"
	@cd frontend/dist/assets && find . -name 'index-*.js' -delete && find . -name 'index-*.css' -delete || \
	(echo "$(RED)Error: Deleting old static files failed$(RESET)" && exit 1)
	
	@echo "$(BLUE)Building Front-end$(RESET)"
	@cd frontend && npm run build || \
	(echo "$(RED)Error: Building frontend failed$(RESET)" && exit 1)

	@echo "$(BLUE)Collecting Static$(RESET)"
	@cd backend && python manage.py collectstatic --noinput || \
	(echo "$(RED)Error: Collecting Static failed$(RESET)" && exit 1)

	@echo "$(BLUE)Restarting Guinicon$(RESET)"
	@sudo systemctl restart gunicorn || \
	(echo "$(RED)Error: Restarting Guinicon failed$(RESET)" && exit 1)

	@echo "$(BLUE)Restarting NGINX$(RESET)"
	@sudo systemctl restart nginx || \
	(echo "$(RED)Error: Restarting NGINX failed$(RESET)" && exit 1)

	@echo "$(BLUE)Clearing Cache$(RESET)"
	@cd backend && python manage.py clear_cache || \
	(echo "$(RED)Error: Clearing Cache failed$(RESET)" && exit 1)

	@echo "$(GREEN)Finished deploying"

### Restarts core system web services
restart:
	@echo "$(BLUE)Restarting Guinicon$(RESET)"
	@sudo systemctl restart gunicorn || \
	(echo "$(RED)Error: Restarting Guinicon failed$(RESET)" && exit 1)

	@echo "$(BLUE)Restarting NGINX$(RESET)"
	@sudo systemctl restart nginx || \
	(echo "$(RED)Error: Restarting NGINX failed$(RESET)" && exit 1)

	@echo "$(BLUE)Clearing Cache$(RESET)"
	@cd backend && python manage.py clear_cache || \
	(echo "$(RED)Error: Clearing Cache failed$(RESET)" && exit 1)

### Handles creating any migrations, groups, or folders
initialSetup: virtualenv
	@echo "$(BLUE)Creating initial setup$(RESET)"
	@cd backend && source venv/bin/activate && \
	python manage.py wait_for_db && \
	python manage.py makemigrations && \
    python manage.py migrate && \
	(echo "$(RED)Error: Initial setup failed$(RESET)" && exit 1)
	@echo "$(GREEN)Finished initial setup$(RESET)$(BLUE) IMPORTANT - Run 'python manage.py generate_secret_key' to for the Secret_Key to enter into `.env`"

### Clears the cache
clearCache:
	
	@echo "$(BLUE)Clearing Cache$(RESET)"
	@cd backend && python manage.py clear_cache || \
	(echo "$(RED)Error: Clearing cache failed$(RESET)" && exit 1)

### Display help information
help:
	$(GREETING)
	@echo "Available commands:"
	@echo "$(BLUE)buildFrontend$(RESET) - Builds Frontend"
	@echo "$(BLUE)deploy$(RESET) - Deploy project to gunicorn"
	@echo "$(BLUE)initialSetup$(RESET) - Configures any migrates, creates needed folders"
	@echo "$(BLUE)update$(RESET) - Updates the site after new data has been pulled down"
	@echo "$(BLUE)restart$(RESET) - Restarts core system web services"
	@echo "$(BLUE)clearCache$(RESET) - Clears the cache"


virtualenv:
	@echo "$(BLUE)Creating virtual environment$(RESET)"
	@cd backend && python -m venv venv
	@echo "$(BLUE)Activating virtual environment$(RESET)"
	@source venv/bin/activate && \
	pip install -r requirements.txt