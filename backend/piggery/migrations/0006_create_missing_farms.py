from django.db import migrations


def create_missing_farms(apps, schema_editor):
    User        = apps.get_model("auth", "User")
    UserProfile = apps.get_model("piggery", "UserProfile")
    Farm        = apps.get_model("piggery", "Farm")

    for user in User.objects.filter(is_staff=False, is_superuser=False):
        UserProfile.objects.get_or_create(
            user=user,
            defaults={"role": "farmer", "farm_type": "solo"},
        )

        Farm.objects.get_or_create(
            owner=user,
            defaults={
                "name":     f"{user.first_name or user.username}'s Farm",
                "location": "Concepcion, Tarlac",
            },
        )


def reverse_migration(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("piggery", "0005_auditlog"),
    ]

    operations = [
        migrations.RunPython(
            create_missing_farms,
            reverse_migration,
        ),
    ]