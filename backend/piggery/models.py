from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class Farm(models.Model):
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="farm")
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Pig(models.Model):
    STAGE_CHOICES = [
        ("piglet", "Piglet"),
        ("weaner", "Weaner"),
        ("grower", "Grower"),
        ("finisher", "Finisher"),
        ("breeder", "Breeder"),
    ]
    STATUS_CHOICES = [
        ("healthy", "Healthy"),
        ("under_treatment", "Under Treatment"),
        ("critical", "Critical"),
        ("deceased", "Deceased"),
    ]
    GENDER_CHOICES = [("male", "Male"), ("female", "Female")]

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="pigs")
    name = models.CharField(max_length=100)
    pig_id = models.CharField(max_length=20, unique=True)  # e.g. P-001
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    breed = models.CharField(max_length=100, default="Landrace")
    growth_stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="piglet")
    health_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="healthy")
    last_checkup_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def age_in_months(self):
        from datetime import date
        today = date.today()
        delta = today - self.date_of_birth
        return delta.days // 30

    @property
    def latest_weight(self):
        record = self.weight_records.order_by("-recorded_at").first()
        return record.weight_kg if record else None

    def __str__(self):
        return f"{self.name} ({self.pig_id})"


class WeightRecord(models.Model):
    pig = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="weight_records")
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2)
    recorded_at = models.DateField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.pig.name} — {self.weight_kg}kg on {self.recorded_at}"


class VaccinationRecord(models.Model):
    pig = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="vaccinations")
    vaccine_name = models.CharField(max_length=200)  # e.g. Hog Cholera, FMD
    date_given = models.DateField()
    next_due_date = models.DateField(null=True, blank=True)
    administered_by = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.pig.name} — {self.vaccine_name}"


class DiseaseRecord(models.Model):
    OUTCOME_CHOICES = [
        ("ongoing", "Ongoing"),
        ("recovered", "Recovered"),
        ("deceased", "Deceased"),
    ]

    pig = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="diseases")
    disease_name = models.CharField(max_length=200)
    diagnosed_date = models.DateField()
    treatment = models.CharField(max_length=300, blank=True)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default="ongoing")
    resolved_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.pig.name} — {self.disease_name}"


class BreedingRecord(models.Model):
    STATUS_CHOICES = [
        ("bred", "Bred"),
        ("pregnant", "Pregnant"),
        ("farrowed", "Farrowed"),
        ("open", "Open"),
        ("failed", "Failed"),
    ]

    sow = models.ForeignKey(
        Pig, on_delete=models.CASCADE, related_name="breeding_records",
        limit_choices_to={"gender": "female"}
    )
    boar = models.ForeignKey(
        Pig, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sired_records", limit_choices_to={"gender": "male"}
    )
    breeding_date = models.DateField()
    expected_farrowing_date = models.DateField(null=True, blank=True)
    actual_farrowing_date = models.DateField(null=True, blank=True)
    pregnancy_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="bred")
    piglets_born_alive = models.PositiveIntegerField(null=True, blank=True)
    piglets_born_dead = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        # Auto-calculate expected farrowing (pigs gestate ~114 days)
        if self.breeding_date and not self.expected_farrowing_date:
            from datetime import timedelta
            self.expected_farrowing_date = self.breeding_date + timedelta(days=114)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sow.name} bred on {self.breeding_date}"


# ─── Inventory ───────────────────────────────────────────────────────────────

class FeedInventory(models.Model):
    FEED_TYPE_CHOICES = [
        ("starter", "Luntian Starter"),
        ("grower", "Luntian Grower"),
        ("finisher", "Luntian Finisher"),
        ("lactation", "Sow Lactation Mix"),
    ]

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="feed_inventory")
    feed_type = models.CharField(max_length=30, choices=FEED_TYPE_CHOICES)
    stock_kg = models.DecimalField(max_digits=8, decimal_places=2)
    daily_usage_kg = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    last_restocked = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def days_remaining(self):
        if self.daily_usage_kg and self.daily_usage_kg > 0:
            return int(self.stock_kg / self.daily_usage_kg)
        return None

    def __str__(self):
        return f"{self.get_feed_type_display()} — {self.stock_kg}kg"


class MedicineInventory(models.Model):
    CATEGORY_CHOICES = [
        ("antibiotic", "Antibiotic"),
        ("antiparasitic", "Antiparasitic"),
        ("vitamin", "Vitamin"),
        ("vaccine", "Vaccine"),
        ("other", "Other"),
    ]

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="medicine_inventory")
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    quantity = models.PositiveIntegerField()
    unit = models.CharField(max_length=50, default="doses")  # tabs, vials, doses
    low_stock_threshold = models.PositiveIntegerField(default=10)
    expiry_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_low_stock(self):
        return self.quantity <= self.low_stock_threshold

    def __str__(self):
        return f"{self.name} — {self.quantity} {self.unit}"


class FeedUsageLog(models.Model):
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="feed_logs")
    feed = models.ForeignKey(FeedInventory, on_delete=models.CASCADE, related_name="usage_logs")
    amount_used_kg = models.DecimalField(max_digits=6, decimal_places=2)
    logged_at = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.feed} used {self.amount_used_kg}kg on {self.logged_at}"


class Notification(models.Model):
    TYPE_CHOICES = [
        ("health", "Health Alert"),
        ("breeding", "Breeding"),
        ("inventory", "Inventory"),
        ("weather", "Weather"),
        ("vaccination", "Vaccination Due"),
    ]

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    sent_via_sms = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.notification_type}] {self.title}"
    
class HealthLog(models.Model):
    APPETITE_CHOICES = [
        ("normal", "Normal"),
        ("poor",   "Poor"),
        ("none",   "Not eating"),
    ]
    BEHAVIOR_CHOICES = [
        ("normal",     "Normal"),
        ("lethargic",  "Lethargic"),
        ("aggressive", "Aggressive"),
        ("isolating",  "Isolating from group"),
    ]
    STOOL_CHOICES = [
        ("normal",    "Normal"),
        ("diarrhea",  "Diarrhea"),
        ("constipated","Constipated"),
        ("bloody",    "Bloody"),
    ]

    pig              = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="health_logs")
    logged_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date_logged      = models.DateField(auto_now_add=True)
    time_logged      = models.TimeField(auto_now_add=True)

    # Vitals
    temperature_c    = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    respiratory_rate = models.IntegerField(null=True, blank=True, help_text="Breaths per minute")
    heart_rate       = models.IntegerField(null=True, blank=True, help_text="BPM")

    # Observations
    appetite         = models.CharField(max_length=20, choices=APPETITE_CHOICES, default="normal")
    behavior         = models.CharField(max_length=20, choices=BEHAVIOR_CHOICES, default="normal")
    stool_condition  = models.CharField(max_length=20, choices=STOOL_CHOICES,    default="normal")

    # Physical signs (checkboxes)
    has_cough        = models.BooleanField(default=False)
    has_nasal_discharge = models.BooleanField(default=False)
    has_skin_lesions = models.BooleanField(default=False)
    has_lameness     = models.BooleanField(default=False)
    has_vomiting     = models.BooleanField(default=False)

    # Auto-filled by the system after rule evaluation
    severity         = models.CharField(
        max_length=20,
        choices=[("normal","Normal"),("warning","Warning"),("critical","Critical")],
        default="normal"
    )
    system_findings  = models.TextField(blank=True, help_text="Auto-generated by rule engine")
    notes            = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_logged", "-time_logged"]

    def __str__(self):
        return f"{self.pig.name} health log — {self.date_logged} [{self.severity}]"
    
class UserProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    phone_number = models.CharField(max_length=20, blank=True, default="")

    def __str__(self):
        return f"{self.user.username} — {self.phone_number}"

@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    """Auto-create a profile whenever a new User is created."""
    if created:
        UserProfile.objects.get_or_create(user=instance)