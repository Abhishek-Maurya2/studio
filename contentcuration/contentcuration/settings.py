"""
Django settings for contentcuration project.

Generated by 'django-admin startproject' using Django 1.8.1.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.8/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
import re
import logging
import pycountry
from datetime import datetime, timedelta
from contentcuration.utils.incidents import INCIDENTS

logging.getLogger("newrelic").setLevel(logging.CRITICAL)
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("boto3").setLevel(logging.WARNING)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STORAGE_ROOT = "storage"
DB_ROOT = "databases"

STATIC_ROOT = os.getenv("STATICFILES_DIR") or os.path.join(BASE_DIR, "static")
CSV_ROOT = "csvs"

# hardcoding all this info for now. Potential for shared reference with webpack?
WEBPACK_LOADER = {
    'DEFAULT': {
        # trailing empty string to include trailing /
        'BUNDLE_DIR_NAME': os.path.join('js', 'bundles', ''),
        'STATS_FILE': os.path.join(BASE_DIR, 'build', 'webpack-stats.json'),
    }
}

PERMISSION_TEMPLATE_ROOT = os.path.join(BASE_DIR, "contentcuration", "templates", "permissions")

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.8/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or '_s0k@&o%m6bzg7s(0p(w6z5xbo%vy%mj+xx(w3mhs=f0ve0+h2'

# SECURITY WARNING: don't run with debug turned on in production!
# DEBUG = True

SESSION_COOKIE_NAME = 'kolibri_studio_sessionid'

ALLOWED_HOSTS = ["*"]  # In production, we serve through a file socket, so this is OK.


# Application definition

INSTALLED_APPS = (
    'contentcuration.apps.ContentConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.sites',
    'django.contrib.staticfiles',
    'rest_framework',
    'raven.contrib.django.raven_compat',
    'django_js_reverse',
    'kolibri_content',
    'readonly',
    'email_extras',
    'le_utils',
    'rest_framework.authtoken',
    'search',
    'django_s3_storage',
    'webpack_loader',
)

SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'studio_db_cache',
    }
}

# READ-ONLY SETTINGS
INCIDENT = INCIDENTS.get(os.getenv('STUDIO_INCIDENT_TYPE'))
SITE_READ_ONLY = INCIDENT and INCIDENT['readonly']

if SITE_READ_ONLY:
    CACHES['default']['BACKEND'] = 'django.core.cache.backends.locmem.LocMemCache'
    CACHES['default']['LOCATION'] = 'readonly_cache'


MIDDLEWARE_CLASSES = (
    # 'django.middleware.cache.UpdateCacheMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.common.BrokenLinkEmailsMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.http.ConditionalGetMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'contentcuration.middleware.db_readonly.DatabaseReadOnlyMiddleware',
    # 'django.middleware.cache.FetchFromCacheMiddleware',
)

if os.getenv("GCLOUD_ERROR_REPORTING"):
    MIDDLEWARE_CLASSES = (
        "contentcuration.middleware.error_reporting.ErrorReportingMiddleware",
    ) + MIDDLEWARE_CLASSES

SUPPORTED_BROWSERS = [
    'Chrome',
    'Firefox',
    'Safari',
]

HEALTH_CHECK_BROWSERS = [
    'kube-probe',
    'GoogleHC',
]

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
        'contentcuration.permissions.CustomPermission',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        # 'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    )
}

ROOT_URLCONF = 'contentcuration.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': ['/templates/'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'readonly.context_processors.readonly',
                'contentcuration.context_processors.site_variables',
            ],
        },
    },
]

WSGI_APPLICATION = 'contentcuration.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.8/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',  # Add 'postgresql_psycopg2', 'mysql', 'sqlite3' or 'oracle'.
        'NAME': os.getenv("DATA_DB_NAME") or 'gonano',  #  Or path to database file if using sqlite3.
        # The following settings are not used with sqlite3:

        # For dev purposes only
        'USER': os.getenv('DATA_DB_USER') or 'learningequality',
        'PASSWORD': os.getenv('DATA_DB_PASS') or 'kolibri',
        'HOST': os.getenv('DATA_DB_HOST') or 'localhost',      # Empty for localhost through domain sockets or '127.0.0.1' for localhost through TCP.
        'PORT': '',                      # Set to empty string for default.
    },
}



DATABASE_ROUTERS = [
    "kolibri_content.router.ContentDBRouter",
]

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.getenv('DJANGO_LOG_FILE') or 'django.log'
        },
        'console': {
            'class': 'logging.StreamHandler',
        },
        'null': {
            'class': 'logging.NullHandler'
        }
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'DEBUG' if globals().get('DEBUG') else 'INFO',
            'propagate': True,
        },
        'django.db.backends': {
            'handlers': ['null'],
            'propagate': False,
            'level': 'DEBUG'
        }
    }
}

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

LANGUAGE_CODE = 'en'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

LOCALE_PATHS = (
    os.path.join(BASE_DIR, 'locale'),
    pycountry.LOCALES_DIR,
)

ugettext = lambda s: s
LANGUAGES = (
    ('en', ugettext('English')),
    ('es', ugettext('Spanish')),
    ('es-es', ugettext('Spanish - Spain')),
    ('es-mx', ugettext('Spanish - Mexico')),
    ('en-PT', ugettext('English - Pirate')),
)


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.8/howto/static-files/

STATIC_URL = '/static/'

STORAGE_URL = '/content/storage/'

CONTENT_DATABASE_URL = '/content/databases/'

CSV_URL = '/content/csvs/'

LOGIN_REDIRECT_URL = '/channels/'

AUTH_USER_MODEL = 'contentcuration.User'

ACCOUNT_ACTIVATION_DAYS = 7
REGISTRATION_OPEN = True
SITE_ID = 1

# EMAIL_HOST = 'localhost'
# EMAIL_PORT = 8000
# EMAIL_HOST_USER = ''
# EMAIL_HOST_PASSWORD = ''
# EMAIL_USE_TLS = False
# EMAIL_BACKEND = 'django_mailgun.MailgunBackend'
# MAILGUN_ACCESS_KEY = 'ACCESS-KEY'
# MAILGUN_SERVER_NAME = 'SERVER-NAME'

SEND_USER_ACTIVATION_NOTIFICATION_EMAIL = bool(
    os.getenv("SEND_USER_ACTIVATION_NOTIFICATION_EMAIL")
)

SPACE_REQUEST_EMAIL = 'content@learningequality.org'
REGISTRATION_INFORMATION_EMAIL = 'studio-registrations@learningequality.org'
HELP_EMAIL = 'content@learningequality.org'
DEFAULT_FROM_EMAIL = 'Kolibri Studio <noreply@learningequality.org>'
POLICY_EMAIL = 'legal@learningequality.org'
ACCOUNT_DELETION_BUFFER = 5 # Used to determine how many days a user
                            # has to undo accidentally deleting account

DEFAULT_LICENSE = 1

SERVER_EMAIL = 'curation-errors@learningequality.org'
ADMINS = [('Errors', SERVER_EMAIL)]

DEFAULT_TITLE = "Kolibri Studio (Beta)"

IGNORABLE_404_URLS = [
    re.compile(r'\.(php|cgi)$'),
    re.compile(r'^/phpmyadmin/'),
    re.compile(r'^/apple-touch-icon.*\.png$'),
    re.compile(r'^/favicon\.ico$'),
    re.compile(r'^/robots\.txt$'),
]

# CELERY CONFIGURATIONS
BROKER_URL = 'redis://localhost:6379'
CELERY_RESULT_BACKEND = 'redis://localhost:6379'
BROKER_URL = "redis://:{password}@{endpoint}:/{db}".format(
    password=os.getenv("CELERY_REDIS_PASSWORD") or "",
    endpoint=os.getenv("CELERY_BROKER_ENDPOINT") or "localhost:6379",
    db=os.getenv("CELERY_REDIS_DB") or "0"
)
CELERY_RESULT_BACKEND = "redis://:{password}@{endpoint}:/{db}".format(
    password=os.getenv("CELERY_REDIS_PASSWORD") or "",
    endpoint=os.getenv("CELERY_RESULT_BACKEND_ENDPOINT") or "localhost:6379",
    db=os.getenv("CELERY_REDIS_DB") or "0"
) or CELERY_RESULT_BACKEND
CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE") or 'Africa/Nairobi'
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# When cleaning up orphan nodes, only clean up any that have been last modified
# since this date
# our default threshold is two weeks ago
TWO_WEEKS_AGO = datetime.now() - timedelta(days=14)
ORPHAN_DATE_CLEAN_UP_THRESHOLD = TWO_WEEKS_AGO

# CLOUD STORAGE SETTINGS
DEFAULT_FILE_STORAGE = 'django_s3_storage.storage.S3Storage'
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID') or 'development'
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY') or 'development'
AWS_S3_BUCKET_NAME = os.getenv('AWS_BUCKET_NAME') or 'content'
AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL') or 'http://localhost:9000'
AWS_AUTO_CREATE_BUCKET = False
AWS_S3_FILE_OVERWRITE = True
AWS_S3_BUCKET_AUTH = False

# GOOGLE DRIVE SETTINGS
GOOGLE_AUTH_JSON = "credentials/client_secret.json"
GOOGLE_STORAGE_REQUEST_SHEET = "16X6zcFK8FS5t5tFaGpnxbWnWTXP88h4ccpSpPbyLeA8"

# Used as the default parent to collect orphan nodes
ORPHANAGE_ROOT_ID = "00000000000000000000000000000000"

# IMPORTANT: Deleted chefs should not be in the orhpanage becuase this can lead to very large and painful resorts
# of the tree. This tree is special in that it should always be accessed inside a disable_mptt_updates code block,
# so we must be very careful to limit code that touches this tree and to carefully check code that does. If we
# do choose to implement restore of old chefs, we will need to ensure moving nodes does not cause a tree sort.
DELETED_CHEFS_ROOT_ID = "11111111111111111111111111111111"
