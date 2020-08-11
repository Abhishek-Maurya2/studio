from django.conf import settings


def report_exception(exception=None):
    if getattr(settings, "SENTRY_ACTIVE"):
        from sentry_sdk import capture_exception

        capture_exception(exception)
