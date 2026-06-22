from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import date


# ── Farm ──────────────────────────────────────────────────────────────────────

class Farm(models.Model):
    ONBOARDING_CHOICES = [
        ("new",      "New Farm — no prior history"),
        ("existing", "Existing Farm — has prior history"),
    ]
    owner               = models.OneToOneField(User, on_delete=models.CASCADE, related_name="farm")
    name                = models.CharField(max_length=200)
    location            = models.CharField(max_length=300)
    onboarding_type     = models.CharField(max_length=20, choices=ONBOARDING_CHOICES, default="new")
    baseline_established = models.BooleanField(default=True)
    created_at          = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class FarmBaseline(models.Model):
    """
    Historical summary entered at onboarding for farms that already existed
    before registering in Piglytics. Used to calibrate analytics so that
    metrics are accurate from day one rather than appearing artificially low.
    """
    farm                        = models.OneToOneField(Farm, on_delete=models.CASCADE, related_name="baseline")
    years_in_operation          = models.PositiveIntegerField(default=0)
    pigs_at_registration        = models.PositiveIntegerField(default=0)
    avg_breeding_sows           = models.PositiveIntegerField(default=0)
    litters_last_12_months      = models.PositiveIntegerField(default=0)
    avg_litter_size_historical  = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    avg_daily_feed_kg_per_pig   = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    common_diseases             = models.TextField(blank=True, help_text="Comma-separated list of historically common diseases")
    notes                       = models.TextField(blank=True)
    created_at                  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Baseline for {self.farm.name}"


# ── Pig ───────────────────────────────────────────────────────────────────────

class Pig(models.Model):
    STAGE_CHOICES = [
        ("piglet",   "Piglet"),
        ("weaner",   "Weaner"),
        ("grower",   "Grower"),
        ("finisher", "Finisher"),
        ("breeder",  "Breeder"),
    ]
    STATUS_CHOICES = [
        ("healthy",         "Healthy"),
        ("under_treatment", "Under Treatment"),
        ("critical",        "Critical"),
        ("deceased",        "Deceased"),
    ]
    GENDER_CHOICES = [("male", "Male"), ("female", "Female")]

    farm              = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="pigs")
    name              = models.CharField(max_length=100)
    pig_id            = models.CharField(max_length=20, unique=True)
    date_of_birth     = models.DateField()
    gender            = models.CharField(max_length=10, choices=GENDER_CHOICES)
    breed             = models.CharField(max_length=100, default="Landrace")
    growth_stage      = models.CharField(max_length=20, choices=STAGE_CHOICES, default="piglet")
    health_status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default="healthy")
    last_checkup_date = models.DateField(null=True, blank=True)
    is_historical     = models.BooleanField(default=False, help_text="True for pigs that existed before Piglytics registration")
    deceased_date     = models.DateField(null=True, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Auto-set deceased_date when health_status changes to deceased
        if self.health_status == "deceased" and not self.deceased_date:
            self.deceased_date = date.today()
        super().save(*args, **kwargs)

    @property
    def age_in_months(self):
        today = date.today()
        delta = today - self.date_of_birth
        return delta.days // 30

    @property
    def latest_weight(self):
        record = self.weight_records.order_by("-recorded_at").first()
        return float(record.weight_kg) if record else None

    @property
    def adg(self):
        """Average Daily Gain in kg/day between first and last weight records."""
        records = self.weight_records.order_by("recorded_at")
        if records.count() < 2:
            return None
        first = records.first()
        last  = records.last()
        days  = (last.recorded_at - first.recorded_at).days
        if days == 0:
            return None
        return round(float(last.weight_kg - first.weight_kg) / days, 3)

    def __str__(self):
        return f"{self.name} ({self.pig_id})"


class PigBaseline(models.Model):
    """
    Historical summary for pigs that existed before Piglytics registration.
    Incorporated into sow productivity analytics so performance is not
    underestimated for pigs with pre-existing breeding history.
    """
    pig                      = models.OneToOneField(Pig, on_delete=models.CASCADE, related_name="baseline")
    total_litters            = models.PositiveIntegerField(default=0)
    total_piglets_born       = models.PositiveIntegerField(default=0)
    total_piglets_weaned     = models.PositiveIntegerField(default=0)
    last_farrowing_date      = models.DateField(null=True, blank=True)
    major_diseases_history   = models.TextField(blank=True)
    vaccination_status_summary = models.TextField(blank=True)
    weight_at_6_months       = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    weight_at_12_months      = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    notes                    = models.TextField(blank=True)

    def __str__(self):
        return f"Baseline for {self.pig.name}"


# ── Weight & Health Records ───────────────────────────────────────────────────

class WeightRecord(models.Model):
    BCS_CHOICES = [
        (1, "1 — Thin"),
        (2, "2 — Lean"),
        (3, "3 — Ideal"),
        (4, "4 — Fat"),
        (5, "5 — Obese"),
    ]
    pig                 = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="weight_records")
    weight_kg           = models.DecimalField(max_digits=6, decimal_places=2)
    recorded_at         = models.DateField()
    body_condition_score = models.PositiveSmallIntegerField(null=True, blank=True, choices=BCS_CHOICES)
    notes               = models.TextField(blank=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.pig.name} — {self.weight_kg}kg on {self.recorded_at}"


class VaccinationRecord(models.Model):
    pig             = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="vaccinations")
    vaccine_name    = models.CharField(max_length=200)
    date_given      = models.DateField()
    next_due_date   = models.DateField(null=True, blank=True)
    administered_by = models.CharField(max_length=200, blank=True)
    notes           = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_given", "-id"]

    def __str__(self):
        return f"{self.pig.name} — {self.vaccine_name}"


class DiseaseRecord(models.Model):
    OUTCOME_CHOICES = [
        ("ongoing",   "Ongoing"),
        ("recovered", "Recovered"),
        ("deceased",  "Deceased"),
    ]
    pig           = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="diseases")
    CATEGORY_CHOICES = [
        ("respiratory",  "Respiratory"),
        ("digestive",    "Digestive"),
        ("skin",         "Skin & External"),
        ("reproductive", "Reproductive"),
        ("parasitic",    "Parasitic"),
        ("nutritional",  "Nutritional"),
        ("systemic",     "Systemic / Other"),
    ]
    disease_category = models.CharField(
        max_length=30, choices=CATEGORY_CHOICES, default="systemic",
        help_text="Structured disease category for analytics and reporting",
    )
    disease_name  = models.CharField(max_length=200)
    diagnosed_date = models.DateField()
    treatment     = models.CharField(max_length=300, blank=True)
    outcome       = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default="ongoing")
    resolved_date = models.DateField(null=True, blank=True)
    notes         = models.TextField(blank=True)

    class Meta:
        ordering = ["-diagnosed_date", "-id"]

    def __str__(self):
        return f"{self.pig.name} — {self.disease_name}"


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
        ("normal",      "Normal"),
        ("diarrhea",    "Diarrhea"),
        ("constipated", "Constipated"),
        ("bloody",      "Bloody"),
    ]
    SEVERITY_CHOICES = [
        ("normal",   "Normal"),
        ("warning",  "Warning"),
        ("critical", "Critical"),
    ]

    pig                 = models.ForeignKey(Pig, on_delete=models.CASCADE, related_name="health_logs")
    logged_by           = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date_logged         = models.DateField(auto_now_add=True)
    time_logged         = models.TimeField(auto_now_add=True)
    temperature_c       = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    respiratory_rate    = models.IntegerField(null=True, blank=True)
    heart_rate          = models.IntegerField(null=True, blank=True)
    appetite            = models.CharField(max_length=20, choices=APPETITE_CHOICES, default="normal")
    behavior            = models.CharField(max_length=20, choices=BEHAVIOR_CHOICES, default="normal")
    stool_condition     = models.CharField(max_length=20, choices=STOOL_CHOICES,    default="normal")
    has_cough           = models.BooleanField(default=False)
    has_nasal_discharge = models.BooleanField(default=False)
    has_skin_lesions    = models.BooleanField(default=False)
    has_lameness        = models.BooleanField(default=False)
    has_vomiting        = models.BooleanField(default=False)
    severity            = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="normal")
    system_findings     = models.TextField(blank=True)
    notes               = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_logged", "-time_logged"]

    def __str__(self):
        return f"{self.pig.name} health log — {self.date_logged} [{self.severity}]"


# ── Breeding ──────────────────────────────────────────────────────────────────

class BreedingRecord(models.Model):
    STATUS_CHOICES = [
        ("bred",      "Bred"),
        ("pregnant",  "Pregnant"),
        ("farrowed",  "Farrowed"),
        ("open",      "Open"),
        ("failed",    "Failed"),
    ]

    sow                     = models.ForeignKey(Pig, on_delete=models.CASCADE,
                                                related_name="breeding_records",
                                                limit_choices_to={"gender": "female"})
    boar                    = models.ForeignKey(Pig, on_delete=models.SET_NULL, null=True, blank=True,
                                                related_name="sired_records",
                                                limit_choices_to={"gender": "male"})
    breeding_date           = models.DateField()
    expected_farrowing_date = models.DateField(null=True, blank=True)
    actual_farrowing_date   = models.DateField(null=True, blank=True)
    pregnancy_status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default="bred")
    piglets_born_alive      = models.PositiveIntegerField(null=True, blank=True)
    piglets_born_dead       = models.PositiveIntegerField(default=0)
    piglets_weaned          = models.PositiveIntegerField(null=True, blank=True)
    wean_date               = models.DateField(null=True, blank=True)
    notes                   = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if self.breeding_date and not self.expected_farrowing_date:
            from datetime import timedelta
            self.expected_farrowing_date = self.breeding_date + timedelta(days=114)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-breeding_date", "-id"]

    def __str__(self):
        return f"{self.sow.name} bred on {self.breeding_date}"


# ── Inventory ─────────────────────────────────────────────────────────────────

class FeedInventory(models.Model):
    FEED_TYPE_CHOICES = [
        ("starter",   "Luntian Starter"),
        ("grower",    "Luntian Grower"),
        ("finisher",  "Luntian Finisher"),
        ("lactation", "Sow Lactation Mix"),
    ]

    farm            = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="feed_inventory")
    feed_type       = models.CharField(max_length=30, choices=FEED_TYPE_CHOICES)
    stock_kg        = models.DecimalField(max_digits=8, decimal_places=2)
    daily_usage_kg  = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    price_per_kg    = models.DecimalField(max_digits=8, decimal_places=2, default=0,
                                          help_text="Cost per kg for feed cost analytics")
    last_restocked  = models.DateField(null=True, blank=True)
    updated_at      = models.DateTimeField(auto_now=True)

    @property
    def effective_daily_usage(self):
        """
        Compute actual daily usage from the last 14 days of FeedUsageLog.
        Falls back to the manually-set daily_usage_kg if fewer than 7 log days exist.
        """
        from django.db.models import Sum, Count
        from datetime import timedelta
        cutoff = date.today() - timedelta(days=14)
        result = self.usage_logs.filter(date_used__gte=cutoff).aggregate(
            total=Sum("amount_used_kg"), days=Count("date_used", distinct=True)
        )
        if result["days"] and result["days"] >= 7:
            return float(result["total"]) / result["days"]
        return float(self.daily_usage_kg) if self.daily_usage_kg else 0

    @property
    def days_remaining(self):
        usage = self.effective_daily_usage
        if usage > 0:
            return int(float(self.stock_kg) / usage)
        return None

    @property
    def projected_monthly_cost(self):
        if self.price_per_kg and self.effective_daily_usage:
            return round(float(self.price_per_kg) * self.effective_daily_usage * 30, 2)
        return 0

    def __str__(self):
        return f"{self.get_feed_type_display()} — {self.stock_kg}kg"


class MedicineInventory(models.Model):
    CATEGORY_CHOICES = [
        ("antibiotic",    "Antibiotic"),
        ("antiparasitic", "Antiparasitic"),
        ("vitamin",       "Vitamin"),
        ("vaccine",       "Vaccine"),
        ("other",         "Other"),
    ]

    farm                  = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="medicine_inventory")
    name                  = models.CharField(max_length=200)
    category              = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    quantity              = models.PositiveIntegerField()
    unit                  = models.CharField(max_length=50, default="doses")
    low_stock_threshold   = models.PositiveIntegerField(default=10)
    expiry_date           = models.DateField(null=True, blank=True)
    updated_at            = models.DateTimeField(auto_now=True)

    @property
    def is_low_stock(self):
        return self.quantity <= self.low_stock_threshold

    def __str__(self):
        return f"{self.name} — {self.quantity} {self.unit}"


class FeedUsageLog(models.Model):
    """
    Log of actual feed usage. date_used is user-specified (not auto_now_add)
    so farmers can backdate entries and historical feed data can be entered
    at onboarding time.
    """
    farm           = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="feed_logs")
    feed           = models.ForeignKey(FeedInventory, on_delete=models.CASCADE, related_name="usage_logs")
    amount_used_kg = models.DecimalField(max_digits=6, decimal_places=2)
    date_used      = models.DateField(default=date.today)
    logged_by      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes          = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_used"]

    def __str__(self):
        return f"{self.feed} used {self.amount_used_kg}kg on {self.date_used}"


class MedicineUsageLog(models.Model):
    """
    Log of actual medicine usage per pig. Required for medicine shortage
    forecasting and treatment history analytics.
    """
    farm           = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="medicine_logs")
    medicine       = models.ForeignKey(MedicineInventory, on_delete=models.CASCADE, related_name="usage_logs")
    pig            = models.ForeignKey(Pig, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name="medicine_usage")
    amount_used    = models.PositiveIntegerField()
    date_used      = models.DateField(default=date.today)
    administered_by = models.CharField(max_length=200, blank=True)
    reason         = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_used"]

    def __str__(self):
        return f"{self.medicine.name} used {self.amount_used} on {self.date_used}"


# ── Notifications & Audit ─────────────────────────────────────────────────────

class Notification(models.Model):
    TYPE_CHOICES = [
        ("health",      "Health Alert"),
        ("breeding",    "Breeding"),
        ("inventory",   "Inventory"),
        ("weather",     "Weather"),
        ("vaccination", "Vaccination Due"),
        ("forecast",    "Forecast Alert"),
    ]

    farm              = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title             = models.CharField(max_length=200)
    message           = models.TextField()
    is_read           = models.BooleanField(default=False)
    sent_via_sms      = models.BooleanField(default=False)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.notification_type}] {self.title}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("create", "Created"),
        ("update", "Updated"),
        ("delete", "Deleted"),
        ("login",  "Login"),
        ("logout", "Logout"),
    ]

    user        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name  = models.CharField(max_length=100, blank=True)
    object_id   = models.CharField(max_length=50,  blank=True)
    description = models.TextField(blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} — {self.action} — {self.model_name} — {self.created_at}"


# ── User Profile ──────────────────────────────────────────────────────────────

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("farmer", "Farmer"),
        ("admin",  "Administrator"),
    ]
    FARM_TYPE_CHOICES = [
        ("solo",    "Solo Farm"),
        ("grouped", "Group Farm"),
    ]

    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone_number = models.CharField(max_length=20, blank=True, default="")
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default="farmer")
    farm_type    = models.CharField(max_length=20, choices=FARM_TYPE_CHOICES, default="solo")

    def __str__(self):
        return f"{self.user.username} — {self.role}"


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    """Auto-create a UserProfile whenever a new User is created."""
    if created:
        UserProfile.objects.get_or_create(user=instance)