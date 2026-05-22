"""
Scheduled background tasks using Celery.
These run daily to send SMS alerts and check for issues.

Setup:
    pip install celery redis django-celery-beat
    Add 'django_celery_beat' to INSTALLED_APPS
    Run: celery -A backend worker --loglevel=info
         celery -A backend beat --loglevel=info
"""

from celery import shared_task
from datetime import date, timedelta
from .models import Farm, BreedingRecord, VaccinationRecord, Notification
from .sms import (
    send_farrowing_reminder,
    send_vaccination_reminder,
    send_low_stock_alert,
)
from .weather import get_weather_alert


@shared_task
def check_farrowing_reminders():
    """Run daily: SMS farmers if a sow is due to farrow within 5 days."""
    upcoming = BreedingRecord.objects.filter(
        pregnancy_status="pregnant",
        expected_farrowing_date__lte=date.today() + timedelta(days=5),
        expected_farrowing_date__gte=date.today(),
    ).select_related("sow__farm__owner")

    for record in upcoming:
        farm = record.sow.farm
        phone = getattr(farm.owner, "profile", None)
        if not phone:
            continue
        days_left = (record.expected_farrowing_date - date.today()).days
        send_farrowing_reminder(phone.phone_number, record.sow.name, days_left)

        # Also create in-app notification
        Notification.objects.get_or_create(
            farm=farm,
            notification_type="breeding",
            title=f"{record.sow.name} farrowing soon",
            defaults={
                "message": f"{record.sow.name} is expected to farrow in {days_left} day(s). Prepare the farrowing pen.",
                "sent_via_sms": True,
            }
        )


@shared_task
def check_vaccination_due():
    """Run daily: alert if any pig has a vaccination due in the next 7 days."""
    due_soon = VaccinationRecord.objects.filter(
        next_due_date__lte=date.today() + timedelta(days=7),
        next_due_date__gte=date.today(),
    ).select_related("pig__farm__owner")

    for record in due_soon:
        farm = record.pig.farm
        phone = getattr(farm.owner, "profile", None)
        if not phone:
            continue
        send_vaccination_reminder(phone.phone_number, record.pig.name, record.vaccine_name)

        Notification.objects.get_or_create(
            farm=farm,
            notification_type="vaccination",
            title=f"Vaccine due: {record.pig.name}",
            defaults={
                "message": f"{record.pig.name} needs {record.vaccine_name} by {record.next_due_date}.",
                "sent_via_sms": True,
            }
        )


@shared_task
def check_low_inventory():
    """Run daily: alert for low feed or medicine stock."""
    for farm in Farm.objects.all():
        phone = getattr(farm.owner, "profile", None)

        # Check feed
        for feed in farm.feed_inventory.all():
            if feed.days_remaining is not None and feed.days_remaining <= 5:
                msg = f"{feed.get_feed_type_display()} — {feed.stock_kg}kg (~{feed.days_remaining} days left)"
                if phone:
                    send_low_stock_alert(phone.phone_number, feed.get_feed_type_display(), f"{feed.stock_kg}kg")
                Notification.objects.create(
                    farm=farm,
                    notification_type="inventory",
                    title=f"Low feed: {feed.get_feed_type_display()}",
                    message=msg,
                )

        # Check medicine
        for med in farm.medicine_inventory.all():
            if med.is_low_stock:
                if phone:
                    send_low_stock_alert(phone.phone_number, med.name, f"{med.quantity} {med.unit}")
                Notification.objects.create(
                    farm=farm,
                    notification_type="inventory",
                    title=f"Low stock: {med.name}",
                    message=f"{med.name} is low ({med.quantity} {med.unit} remaining).",
                )


@shared_task
def send_daily_weather_alert():
    """Run every morning: send weather alerts to all farms."""
    for farm in Farm.objects.all():
        weather = get_weather_alert(farm.location)
        if weather.get("alert_count", 0) > 0:
            phone = getattr(farm.owner, "profile", None)
            for alert in weather["alerts"]:
                Notification.objects.create(
                    farm=farm,
                    notification_type="weather",
                    title=alert["title"],
                    message=alert["message"],
                )