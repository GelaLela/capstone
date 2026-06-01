"""
backend/piggery/migrations/0007_architecture_improvements.py

Save as exactly: backend/piggery/migrations/0007_architecture_improvements.py

This migration adds all new fields and models from the architecture review.
Dependency: 0006_create_missing_farms (your current last migration).
Run with: python manage.py migrate
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import datetime


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("piggery", "0006_create_missing_farms"),
    ]

    operations = [

        # ── Farm: add onboarding fields ───────────────────────────────────────
        migrations.AddField(
            model_name="farm",
            name="onboarding_type",
            field=models.CharField(
                choices=[("new", "New Farm — no prior history"),
                         ("existing", "Existing Farm — has prior history")],
                default="new", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="farm",
            name="baseline_established",
            field=models.BooleanField(default=True),
        ),

        # ── FarmBaseline model ────────────────────────────────────────────────
        migrations.CreateModel(
            name="FarmBaseline",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("years_in_operation",         models.PositiveIntegerField(default=0)),
                ("pigs_at_registration",       models.PositiveIntegerField(default=0)),
                ("avg_breeding_sows",          models.PositiveIntegerField(default=0)),
                ("litters_last_12_months",     models.PositiveIntegerField(default=0)),
                ("avg_litter_size_historical", models.DecimalField(decimal_places=1, default=0, max_digits=4)),
                ("avg_daily_feed_kg_per_pig",  models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ("common_diseases",            models.TextField(blank=True)),
                ("notes",                      models.TextField(blank=True)),
                ("created_at",                 models.DateTimeField(auto_now_add=True)),
                ("farm", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="baseline",
                    to="piggery.farm",
                )),
            ],
        ),

        # ── Pig: add new fields ───────────────────────────────────────────────
        migrations.AddField(
            model_name="pig",
            name="is_historical",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pig",
            name="deceased_date",
            field=models.DateField(blank=True, null=True),
        ),

        # ── PigBaseline model ─────────────────────────────────────────────────
        migrations.CreateModel(
            name="PigBaseline",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("total_litters",              models.PositiveIntegerField(default=0)),
                ("total_piglets_born",         models.PositiveIntegerField(default=0)),
                ("total_piglets_weaned",       models.PositiveIntegerField(default=0)),
                ("last_farrowing_date",        models.DateField(blank=True, null=True)),
                ("major_diseases_history",     models.TextField(blank=True)),
                ("vaccination_status_summary", models.TextField(blank=True)),
                ("weight_at_6_months",         models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ("weight_at_12_months",        models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ("notes",                      models.TextField(blank=True)),
                ("pig", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="baseline",
                    to="piggery.pig",
                )),
            ],
        ),

        # ── WeightRecord: add body_condition_score ────────────────────────────
        migrations.AddField(
            model_name="weightrecord",
            name="body_condition_score",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True,
                choices=[(1,"1 — Thin"),(2,"2 — Lean"),(3,"3 — Ideal"),(4,"4 — Fat"),(5,"5 — Obese")],
            ),
        ),

        # ── BreedingRecord: add weaning fields ────────────────────────────────
        migrations.AddField(
            model_name="breedingrecord",
            name="piglets_weaned",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="breedingrecord",
            name="wean_date",
            field=models.DateField(blank=True, null=True),
        ),

        # ── FeedInventory: add price_per_kg ───────────────────────────────────
        migrations.AddField(
            model_name="feedinventory",
            name="price_per_kg",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),

        # ── FeedUsageLog: rename logged_at → date_used, add logged_by ─────────
        migrations.AddField(
            model_name="feedusagelog",
            name="date_used",
            field=models.DateField(default=datetime.date.today),
        ),
        migrations.AddField(
            model_name="feedusagelog",
            name="logged_by",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # ── MedicineUsageLog model ────────────────────────────────────────────
        migrations.CreateModel(
            name="MedicineUsageLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("amount_used",      models.PositiveIntegerField()),
                ("date_used",        models.DateField(default=datetime.date.today)),
                ("administered_by",  models.CharField(blank=True, max_length=200)),
                ("reason",           models.TextField(blank=True)),
                ("farm", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="medicine_logs",
                    to="piggery.farm",
                )),
                ("medicine", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="usage_logs",
                    to="piggery.medicineinventory",
                )),
                ("pig", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="medicine_usage",
                    to="piggery.pig",
                )),
            ],
            options={"ordering": ["-date_used"]},
        ),

        # ── Notification: add forecast type ───────────────────────────────────
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("health",      "Health Alert"),
                    ("breeding",    "Breeding"),
                    ("inventory",   "Inventory"),
                    ("weather",     "Weather"),
                    ("vaccination", "Vaccination Due"),
                    ("forecast",    "Forecast Alert"),
                ],
                max_length=20,
            ),
        ),
    ]