from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-change-this-in-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "django_celery_beat",

    # Our app
    "piggery",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
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
# Allow React Native app to connect during development
CORS_ALLOW_ALL_ORIGINS = True  # Set to False and list allowed origins in production

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# Celery (for background SMS/alert tasks)
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
CELERY_BEAT_SCHEDULE = {
    "check-farrowing-daily": {
        "task": "piggery.tasks.check_farrowing_reminders",
        "schedule": 86400,  # every 24 hours
    },
    "check-vaccination-daily": {
        "task": "piggery.tasks.check_vaccination_due",
        "schedule": 86400,
    },
    "check-inventory-daily": {
        "task": "piggery.tasks.check_low_inventory",
        "schedule": 86400,
    },
    "weather-alert-morning": {
        "task": "piggery.tasks.send_daily_weather_alert",
        "schedule": 86400,
    },
}

# SMS — Semaphore (https://semaphore.co)
# SEMAPHORE_API_KEY = "your_semaphore_api_key_here"
# SEMAPHORE_SENDER_NAME = "PIGLYTICS"

# PhilSMS — https://philsms.com
PHILSMS_TOKEN = "2834|NMZ4HgacVWT0Cti4zTca3wSoXCQk9io0EzjO6oqCc67674d6"   # paste from your dashboard
# PHILSMS_SENDER_ID = "PIGLYTCS"              # max 11 characters

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True