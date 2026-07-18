from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from celery.schedules import crontab
from datetime import timedelta
import os

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "127.0.0.1").split(",")

CORS_ALLOW_CREDENTIALS = True # Update for prod
CORS_ALLOW_ALL_ORIGINS = False  # Switch to False to use the specific list below
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")

# Only send cookies over HTTPS
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "True").lower() == "true"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "True").lower() == "true"

CSRF_COOKIE_HTTPONLY = False  # Must be False so JS can read it
CSRF_COOKIE_SAMESITE = 'Strict'  # Prevent cross-site cookie sending
CSRF_TRUSTED_ORIGINS = os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")

# Prevent the site from being rendered in an <iframe> (Prevents Clickjacking)
X_FRAME_OPTIONS = 'DENY'

# Tell Django it is behind a proxy and to trust the X-Forwarded-Proto header
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Browser-side security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# --- SESSION SETTINGS (Applies to Django Admin) ---
SESSION_COOKIE_AGE = 3600 
SESSION_EXPIRE_AT_BROWSER_CLOSE = True 
SESSION_SAVE_EVERY_REQUEST = True

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_celery_beat',
    'backend',
    'users',
    'servers',
    'configuration',
    'notifications',
    'administration',
    'reports',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'users.middleware.UpdateLastActivityMiddleware'
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / '..' / 'frontend' / 'dist',
            BASE_DIR / 'templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'


# Caching related info

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

CACHE_MIDDLEWARE_KEY_PREFIX = "astraea"

# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': os.getenv("DB_ENGINE"),
        'NAME': os.getenv("DB_NAME"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
    }
}

MYSQL_CONF_PATH = os.getenv("MYSQL_LOCAL_CONF")
if MYSQL_CONF_PATH and MYSQL_CONF_PATH.strip():
    DATABASES['default']['OPTIONS'] = {
        'read_default_file': MYSQL_CONF_PATH.strip(),
    }

AUTH_USER_MODEL = 'users.User'

# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
    {
        'NAME': 'users.validators.ComplexityValidator',
    },
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        #'rest_framework_simplejwt.authentication.JWTAuthentication',
        'users.authenticate.CustomJWTAuthentication',
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False, # Enable if you don't want users to be forced to sign back in when `REFRESH_TOKEN_LIFETIME` expires
    "BLACKLIST_AFTER_ROTATION": True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    "UPDATE_LAST_LOGIN": True,

    # --- COOKIE SETTINGS ---
    "AUTH_COOKIE": "access_token",       # Cookie name for access token
    "AUTH_COOKIE_REFRESH": "refresh_token", # Cookie name for refresh token
    "AUTH_COOKIE_SECURE": os.getenv("AUTH_COOKIE_SECURE", "True").lower() == "true",          # Only send over HTTPS
    "AUTH_COOKIE_HTTP_ONLY": True,       # Prevent JS access (XSS protection)
    "AUTH_COOKIE_PATH": "/",             # Available to all paths
    "AUTH_COOKIE_SAMESITE": "Lax",       # CSRF protection
}


"""
    Settings used by Verification and Password Reset
"""
BASE_URL = os.getenv('BASE_URL')
VERIFY_LINK_EXPIRY_MINUTES = int(os.getenv('VERIFY_LINK_EXPIRY_MINUTES', 60))
RESET_LINK_EXPIRY_MINUTES = int(os.getenv('RESET_LINK_EXPIRY_MINUTES', 60))


""" 
    EMAIL
"""

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
ENABLE_EMAIL = os.getenv('ENABLE_EMAIL')
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
EMAIL_PORT = os.getenv('EMAIL_PORT')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'


# Patching related options
PATCH_THRESHOLD_DAYS = os.getenv("PATCH_THRESHOLD_DAYS", "30")


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'America/Toronto'

USE_I18N = True

USE_TZ = True

"""
    Celery
"""
CELERY_BROKER_URL = os.getenv("CELERY_REDIS_URL", "redis://127.0.0.1:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_REDIS_URL", "redis://127.0.0.1:6379/1")
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_ENABLE_UTC = False
CELERY_TIMEZONE = TIME_ZONE


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'
STATICFILES_DIRS = [
    BASE_DIR / '..' / 'frontend' / 'dist',
]
STATIC_ROOT = BASE_DIR / 'staticfiles'

LOG_DIR = os.path.join(BASE_DIR, 'logs')
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOG_DIR, 'astraea_general.log'),
            'maxBytes': 1024 * 1024 * 5,  # 5 MB
            'backupCount': 5,             # Keep 5 old log files
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOG_DIR, 'astraea_errors.log'),
            'maxBytes': 1024 * 1024 * 5,  # 5 MB
            'backupCount': 10,            # Keep more error history
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'error_file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}