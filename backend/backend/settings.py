from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-change-this-before-production"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True") != "False"

ALLOWED_HOSTS = [
    "newpiglytics.pythonanywhere.com",
    "localhost",
    "127.0.0.1",
    "192.168.1.4"
    ".ngrok-free.app",
    "cultural-routine-nape.ngrok-free.dev",
]

# ── Apps ──────────────────────────────────────────────────────────────────────
# NOTE: django_celery_beat has been removed.
# Celery + Redis does NOT work on PythonAnywhere free tier.
# Leaving it in INSTALLED_APPS causes an import error on startup if
# the celery package is not installed on PythonAnywhere.
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "piggery",
]

# ── Middleware ────────────────────────────────────────────────────────────────
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

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

# ── Database — SQLite ─────────────────────────────────────────────────────────
# Keeping SQLite for the capstone defense.
# The database file is stored at backend/db.sqlite3 on PythonAnywhere.
# PythonAnywhere persists files in ~/piglytics/backend/ across reloads.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME":   BASE_DIR / "db.sqlite3",
    }
}

# ── CORS ──────────────────────────────────────────────────────────────────────
# Required for React Native APK to call this backend from any IP.
CORS_ALLOW_ALL_ORIGINS = True

# ── REST Framework ────────────────────────────────────────────────────────────
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

# ── Static files ──────────────────────────────────────────────────────────────
# STATIC_ROOT is required so Django admin works on PythonAnywhere.
# Not used by the React Native frontend.
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ── Localisation ──────────────────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE      = "en-us"
TIME_ZONE          = "Asia/Manila"
USE_I18N           = True
USE_TZ             = True

# ── SMS — PhilSMS ─────────────────────────────────────────────────────────────
# Add your token in the PythonAnywhere WSGI file or as environment variables.
PHILSMS_TOKEN     = os.getenv("PHILSMS_TOKEN")
PHILSMS_SENDER_ID = os.getenv("PHILSMS_SENDER_ID", "PIGLYTICS")