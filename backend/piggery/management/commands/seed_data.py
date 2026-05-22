"""
Seed command — populates the database with 15 dummy pigs and sample data.

Run with:
    python manage.py seed_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from datetime import date, timedelta
from piggery.models import (
    Farm, Pig, WeightRecord, VaccinationRecord,
    DiseaseRecord, BreedingRecord, FeedInventory,
    MedicineInventory, Notification,
)


PIGS = [
    ("Pinky",       "P-001", "2024-02-01", "female", "Landrace",         "breeder",  "healthy"),
    ("Bacon Boy",   "P-002", "2024-10-01", "male",   "Duroc",            "finisher", "critical"),
    ("Princess",    "P-003", "2023-10-01", "female", "Large White",      "breeder",  "healthy"),
    ("Lechon Jr.",  "P-004", "2024-11-01", "male",   "Landrace",         "grower",   "healthy"),
    ("Chicharon",   "P-005", "2024-12-01", "male",   "Crossbreed",       "grower",   "healthy"),
    ("Hammy",       "P-006", "2024-09-01", "male",   "Large White",      "finisher", "healthy"),
    ("Rosita",      "P-007", "2023-12-01", "female", "Landrace",         "breeder",  "healthy"),
    ("Chubs",       "P-008", "2024-11-15", "male",   "Duroc",            "grower",   "healthy"),
    ("Mudpie",      "P-009", "2025-01-01", "female", "Philippine Native","weaner",   "under_treatment"),
    ("Lola Baboy",  "P-010", "2023-04-01", "female", "Landrace",         "breeder",  "healthy"),
    ("Squishy",     "P-011", "2025-02-01", "female", "Crossbreed",       "piglet",   "healthy"),
    ("Tusok",       "P-012", "2025-02-10", "male",   "Crossbreed",       "piglet",   "healthy"),
    ("Crispa",      "P-013", "2023-08-01", "female", "Large White",      "breeder",  "healthy"),
    ("Biggy",       "P-014", "2024-08-01", "male",   "Duroc",            "finisher", "under_treatment"),
    ("Liit",        "P-015", "2025-02-15", "male",   "Philippine Native","piglet",   "healthy"),
]

WEIGHTS = {
    "P-001": [(128, -60), (115, -120)],
    "P-002": [(72,  -10), (65,  -40)],
    "P-003": [(145, -14), (130, -60)],
    "P-004": [(58,  -7),  (50,  -30)],
    "P-005": [(44,  -7),  (38,  -30)],
    "P-006": [(88,  -7),  (80,  -30)],
    "P-007": [(135, -14), (120, -60)],
    "P-008": [(62,  -5),  (55,  -30)],
    "P-009": [(28,  -7),  (22,  -30)],
    "P-010": [(160, -14), (150, -60)],
    "P-011": [(8,   -7)],
    "P-012": [(7,   -7)],
    "P-013": [(148, -14), (135, -60)],
    "P-014": [(95,  -7),  (87,  -30)],
    "P-015": [(6,   -7)],
}


class Command(BaseCommand):
    help = "Seed database with 15 dummy pigs and sample records"

    def handle(self, *args, **options):
        self.stdout.write("Seeding Piglytics data...")

        # 1. Create user & farm
        user, created = User.objects.get_or_create(username="farmer")
        if created:
            user.set_password("piglytics123")
            user.save()
            self.stdout.write("  Created user: farmer / piglytics123")

        farm, _ = Farm.objects.get_or_create(
            owner=user,
            defaults={"name": "Dela Cruz Farm", "location": "Concepcion, Tarlac, Philippines"}
        )
        self.stdout.write(f"  Farm: {farm.name}")

        # 2. Create pigs
        pig_map = {}
        today = date.today()

        for name, pid, dob, gender, breed, stage, status in PIGS:
            pig, _ = Pig.objects.get_or_create(
                pig_id=pid,
                defaults={
                    "farm": farm,
                    "name": name,
                    "date_of_birth": date.fromisoformat(dob),
                    "gender": gender,
                    "breed": breed,
                    "growth_stage": stage,
                    "health_status": status,
                    "last_checkup_date": today - timedelta(days=14),
                }
            )
            pig_map[pid] = pig

        self.stdout.write(f"  Created {len(pig_map)} pigs")

        # 3. Weight records
        for pid, entries in WEIGHTS.items():
            pig = pig_map.get(pid)
            if not pig:
                continue
            for weight, days_offset in entries:
                WeightRecord.objects.get_or_create(
                    pig=pig,
                    recorded_at=today + timedelta(days=days_offset),
                    defaults={"weight_kg": weight}
                )

        self.stdout.write("  Added weight records")

        # 4. Vaccinations
        vax_data = [
            ("P-001", "Hog Cholera",  today - timedelta(days=90),  today + timedelta(days=90)),
            ("P-002", "FMD",          today - timedelta(days=75),  today + timedelta(days=105)),
            ("P-003", "Erysipelas",   today - timedelta(days=120), today - timedelta(days=1)),
            ("P-004", "Hog Cholera",  today - timedelta(days=30),  today + timedelta(days=150)),
            ("P-006", "FMD",          today - timedelta(days=45),  today + timedelta(days=135)),
            ("P-007", "Hog Cholera",  today - timedelta(days=60),  today + timedelta(days=120)),
            ("P-010", "Erysipelas",   today - timedelta(days=90),  today + timedelta(days=90)),
            ("P-013", "Hog Cholera",  today - timedelta(days=30),  today + timedelta(days=150)),
        ]
        for pid, vaccine, given, nxt in vax_data:
            pig = pig_map.get(pid)
            if pig:
                VaccinationRecord.objects.get_or_create(
                    pig=pig, vaccine_name=vaccine,
                    defaults={"date_given": given, "next_due_date": nxt, "administered_by": "Dr. Santos"}
                )

        self.stdout.write("  Added vaccination records")

        # 5. Disease history
        DiseaseRecord.objects.get_or_create(
            pig=pig_map["P-002"], disease_name="Fever / respiratory",
            defaults={"diagnosed_date": today - timedelta(days=4), "treatment": "Amoxicillin", "outcome": "ongoing"}
        )
        DiseaseRecord.objects.get_or_create(
            pig=pig_map["P-009"], disease_name="Skin lesions",
            defaults={"diagnosed_date": today - timedelta(days=40), "treatment": "Ivermectin", "outcome": "recovered", "resolved_date": today - timedelta(days=20)}
        )
        DiseaseRecord.objects.get_or_create(
            pig=pig_map["P-014"], disease_name="Lameness",
            defaults={"diagnosed_date": today - timedelta(days=10), "treatment": "Anti-inflammatory", "outcome": "ongoing"}
        )

        self.stdout.write("  Added disease records")

        # 6. Breeding records
        breeding_data = [
            ("P-001", today - timedelta(days=120), "farrowed",  today - timedelta(days=6),  10),
            ("P-003", today - timedelta(days=98),  "pregnant",  None,                        None),
            ("P-007", today - timedelta(days=78),  "pregnant",  None,                        None),
            ("P-010", today - timedelta(days=48),  "pregnant",  None,                        None),
            ("P-013", today - timedelta(days=160), "farrowed",  today - timedelta(days=46),  8),
            ("P-014", today - timedelta(days=200), "farrowed",  today - timedelta(days=86),  9),
        ]
        for pid, bred, status, actual, alive in breeding_data:
            pig = pig_map.get(pid)
            if not pig:
                continue
            BreedingRecord.objects.get_or_create(
                sow=pig, breeding_date=bred,
                defaults={
                    "pregnancy_status": status,
                    "actual_farrowing_date": actual,
                    "piglets_born_alive": alive,
                }
            )

        self.stdout.write("  Added breeding records")

        # 7. Feed inventory
        feed_items = [
            ("starter",   60,  3.0),
            ("grower",    120, 8.0),
            ("finisher",  60,  4.0),
            ("lactation", 12,  3.0),
        ]
        for ftype, stock, usage in feed_items:
            FeedInventory.objects.get_or_create(
                farm=farm, feed_type=ftype,
                defaults={"stock_kg": stock, "daily_usage_kg": usage, "last_restocked": today - timedelta(days=10)}
            )

        self.stdout.write("  Added feed inventory")

        # 8. Medicine inventory
        meds = [
            ("Amoxicillin",         "antibiotic",    30,  "tabs",  10),
            ("Ivermectin",          "antiparasitic", 20,  "vials", 5),
            ("Vitamin B12",         "vitamin",       12,  "doses", 15),
            ("Oxytocin",            "other",         8,   "vials", 3),
            ("Hog Cholera Vaccine", "vaccine",       5,   "doses", 2),
            ("Vitamin E+Selenium",  "vitamin",       25,  "tabs",  10),
            ("Penicillin",          "antibiotic",    15,  "vials", 5),
            ("Electrolyte Mix",     "other",         40,  "sachets",10),
        ]
        for name, cat, qty, unit, threshold in meds:
            MedicineInventory.objects.get_or_create(
                farm=farm, name=name,
                defaults={"category": cat, "quantity": qty, "unit": unit, "low_stock_threshold": threshold}
            )

        self.stdout.write("  Added medicine inventory")

        # 9. Sample notifications
        notif_data = [
            ("health",      "Health alert: Bacon Boy",     "Bacon Boy (P-002) is showing signs of fever. Immediate attention needed."),
            ("breeding",    "Princess farrowing soon",     "Princess (P-003) is expected to farrow in 4 days. Prepare the farrowing pen."),
            ("inventory",   "Low stock: Vitamin B12",      "Vitamin B12 is running low (12 doses remaining). Please restock soon."),
            ("weather",     "Heat stress risk",            f"Temperature is 32°C. Monitor pigs for panting or lethargy. Increase water supply."),
            ("vaccination", "Vaccine due: Princess",       "Princess (P-003) needs Erysipelas vaccine. Due: yesterday."),
        ]
        for ntype, title, message in notif_data:
            Notification.objects.get_or_create(
                farm=farm, title=title,
                defaults={"notification_type": ntype, "message": message}
            )

        self.stdout.write("  Added notifications")
        self.stdout.write(self.style.SUCCESS("\nDone! Login with: farmer / piglytics123"))