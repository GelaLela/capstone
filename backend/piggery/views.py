from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Avg
from datetime import date, timedelta

from .models import (
    Farm, Pig, WeightRecord, VaccinationRecord,
    DiseaseRecord, BreedingRecord, FeedInventory,
    MedicineInventory, FeedUsageLog, Notification, HealthLog,
)
from .serializers import (
    FarmSerializer, PigListSerializer, PigDetailSerializer,
    WeightRecordSerializer, VaccinationRecordSerializer,
    DiseaseRecordSerializer, BreedingRecordSerializer,
    FeedInventorySerializer, MedicineInventorySerializer,
    FeedUsageLogSerializer, NotificationSerializer, HealthLogSerializer,
)
from .weather import get_weather_alert
from .services.sms import send_sms


class FarmViewSet(viewsets.ModelViewSet):
    serializer_class = FarmSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Farm.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        """Single endpoint for all dashboard summary data."""
        farm = self.get_object()
        pigs = farm.pigs.exclude(health_status="deceased")

        # Pigs due for farrowing within 7 days
        upcoming_farrowing = BreedingRecord.objects.filter(
            sow__farm=farm,
            pregnancy_status="pregnant",
            expected_farrowing_date__lte=date.today() + timedelta(days=7),
        ).count()

        # Low feed stock items
        low_feed = farm.feed_inventory.filter(stock_kg__lt=20).count()

        # Low medicine items
        low_medicine = [m for m in farm.medicine_inventory.all() if m.is_low_stock]

        # Vaccinations due within 7 days
        vax_due = VaccinationRecord.objects.filter(
            pig__farm=farm,
            next_due_date__lte=date.today() + timedelta(days=7),
        ).count()

        data = {
            "farm_name": farm.name,
            "total_pigs": pigs.count(),
            "healthy": pigs.filter(health_status="healthy").count(),
            "under_treatment": pigs.filter(health_status="under_treatment").count(),
            "critical": pigs.filter(health_status="critical").count(),
            "pregnant_sows": pigs.filter(
                gender="female",
                breeding_records__pregnancy_status="pregnant"
            ).distinct().count(),
            "upcoming_farrowing": upcoming_farrowing,
            "low_feed_items": low_feed,
            "low_medicine_items": len(low_medicine),
            "vaccinations_due": vax_due,
        }
        return Response(data)

    @action(detail=True, methods=["get"])
    def weather(self, request, pk=None):
        """Fetch weather for the farm's location and return any alerts."""
        farm = self.get_object()
        alert = get_weather_alert(farm.location)
        return Response(alert)


class PigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["retrieve"]:
            return PigDetailSerializer
        return PigListSerializer

    def get_queryset(self):
        farm = Farm.objects.get(owner=self.request.user)
        qs = farm.pigs.exclude(health_status="deceased")

        # Filter by stage or health
        stage = self.request.query_params.get("stage")
        health = self.request.query_params.get("health")
        if stage:
            qs = qs.filter(growth_stage=stage)
        if health:
            qs = qs.filter(health_status=health)
        return qs

    def perform_create(self, serializer):
        farm = Farm.objects.get(owner=self.request.user)
        serializer.save(farm=farm)

    @action(detail=True, methods=["post"])
    def log_weight(self, request, pk=None):
        """Add a new weight record for a pig."""
        pig = self.get_object()
        serializer = WeightRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(pig=pig)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def growth_chart(self, request, pk=None):
        """Return weight history for charting in the app."""
        pig = self.get_object()
        records = pig.weight_records.order_by("recorded_at")
        data = [{"date": str(r.recorded_at), "weight_kg": float(r.weight_kg)} for r in records]
        return Response(data)

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Descriptive analytics — averages per growth stage."""
        farm = Farm.objects.get(owner=self.request.user)
        stages = ["piglet", "weaner", "grower", "finisher", "breeder"]
        result = []
        for stage in stages:
            pigs = farm.pigs.filter(growth_stage=stage)
            avg_weight = WeightRecord.objects.filter(
                pig__in=pigs
            ).order_by("-recorded_at").values("pig").distinct()
            result.append({
                "stage": stage,
                "count": pigs.count(),
            })
        return Response(result)


class WeightRecordViewSet(viewsets.ModelViewSet):
    serializer_class = WeightRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pig_id = self.kwargs.get("pig_pk")
        return WeightRecord.objects.filter(pig__id=pig_id, pig__farm__owner=self.request.user)

    def perform_create(self, serializer):
        pig = Pig.objects.get(pk=self.kwargs["pig_pk"])
        serializer.save(pig=pig)


class VaccinationViewSet(viewsets.ModelViewSet):
    serializer_class = VaccinationRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pig_id = self.kwargs.get("pig_pk")
        return VaccinationRecord.objects.filter(pig__id=pig_id, pig__farm__owner=self.request.user)

    def perform_create(self, serializer):
        pig = Pig.objects.get(pk=self.kwargs["pig_pk"])
        serializer.save(pig=pig)

    @action(detail=False, methods=["post"])
    def schedule(self, request, pig_pk=None):
        """Schedule a new upcoming vaccination."""
        pig = Pig.objects.get(pk=pig_pk)
        serializer = VaccinationRecordSerializer(data=request.data)
        if serializer.is_valid():
            record = serializer.save(pig=pig)
            # Create reminder notification
            Notification.objects.create(
                farm=pig.farm,
                notification_type="vaccination",
                title=f"Vaccination scheduled: {pig.name}",
                message=(
                    f"{record.vaccine_name} scheduled for {pig.name} "
                    f"on {record.next_due_date}."
                ),
            )
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class DiseaseViewSet(viewsets.ModelViewSet):
    serializer_class = DiseaseRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pig_id = self.kwargs.get("pig_pk")
        return DiseaseRecord.objects.filter(pig__id=pig_id, pig__farm__owner=self.request.user)

    def perform_create(self, serializer):
        pig = Pig.objects.get(pk=self.kwargs["pig_pk"])
        record = serializer.save(pig=pig)

        # Auto-send SMS if a new disease is logged
        farm = pig.farm
        send_sms(
            phone=farm.owner.profile.phone_number,
            message=f"[Piglytics] ALERT: {pig.name} diagnosed with {record.disease_name}. Please check immediately."
        )
        return record


class BreedingViewSet(viewsets.ModelViewSet):
    serializer_class = BreedingRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BreedingRecord.objects.filter(
            sow__farm__owner=self.request.user
        ).select_related("sow")

    @action(detail=False, methods=["get"])
    def forecast(self, request):
        """
        Rule-based reproductive forecasting using:
        - 114-day gestation period
        - 21-day estrous cycle
        - Average Daily Gain (ADG) benchmarks
        """
        from datetime import date, timedelta

        farm = Farm.objects.get(owner=request.user)
        today = date.today()

        # ── 1. Farrowing forecasts ────────────────────────────────────
        pregnant_records = BreedingRecord.objects.filter(
            sow__farm=farm,
            pregnancy_status__in=["pregnant", "bred"],
        ).select_related("sow")

        farrowing_forecasts = []
        for record in pregnant_records:
            days_pregnant  = (today - record.breeding_date).days
            days_remaining = 114 - days_pregnant
            gestation_pct  = round((days_pregnant / 114) * 100, 1)

            if days_pregnant <= 7:
                stage = "Newly bred — awaiting pregnancy confirmation"
            elif days_pregnant <= 30:
                stage = "Early gestation (embryo attachment)"
            elif days_pregnant <= 75:
                stage = "Mid gestation (fetal development)"
            elif days_pregnant <= 100:
                stage = "Late gestation (rapid fetal growth)"
            else:
                stage = "Pre-farrowing (prepare pen now)"

            # Margin of error: ±7 days (gestation range 107–121 days)
            MARGIN_DAYS = 7
            earliest_farrowing = record.breeding_date + timedelta(days=114 - MARGIN_DAYS)
            latest_farrowing   = record.breeding_date + timedelta(days=114 + MARGIN_DAYS)

            # Overdue only after the latest possible date
            is_overdue = today > latest_farrowing

            # Alert window: 7 days before earliest possible farrowing
            alert = (
                not is_overdue and
                (earliest_farrowing - today).days <= 7
            )

            farrowing_forecasts.append({
                "sow_name":               record.sow.name,
                "sow_id":                 record.sow.pig_id,
                "breeding_date":          str(record.breeding_date),
                "expected_farrowing":     str(record.expected_farrowing_date),
                "earliest_farrowing":     str(earliest_farrowing),
                "latest_farrowing":       str(latest_farrowing),
                "days_pregnant":          days_pregnant,
                "days_remaining":         max(0, days_remaining),
                "gestation_progress_pct": min(100, gestation_pct),
                "gestation_stage":        stage,
                "is_overdue":             is_overdue,
                "alert":                  alert,
                "pregnancy_status":       record.pregnancy_status,
            })

        # ── 2. Next breeding window (21-day estrous cycle) ────────────
        DAYS_TO_WEANING        = 21
        DAYS_WEANING_TO_ESTRUS = 5

        recently_farrowed = BreedingRecord.objects.filter(
            sow__farm=farm,
            pregnancy_status="farrowed",
            actual_farrowing_date__isnull=False,
        ).select_related("sow").order_by("-actual_farrowing_date")

        seen_sows     = set()
        next_breeding = []
        for record in recently_farrowed:
            if record.sow.id in seen_sows:
                continue
            seen_sows.add(record.sow.id)

            weaning_date = record.actual_farrowing_date + timedelta(days=DAYS_TO_WEANING)
            estrus_date  = weaning_date + timedelta(days=DAYS_WEANING_TO_ESTRUS)
            days_until   = (estrus_date - today).days

            next_breeding.append({
                "sow_name":         record.sow.name,
                "sow_id":           record.sow.pig_id,
                "farrowed_on":      str(record.actual_farrowing_date),
                "weaning_date":     str(weaning_date),
                "next_estrus_date": str(estrus_date),
                "days_until_estrus":days_until,
                "ready_to_breed":   days_until <= 0,
                "status": (
                    "Ready to breed now"
                    if days_until <= 0
                    else f"Estrus in {days_until} days"
                ),
            })

        # ── 3. ADG per pig vs benchmark ───────────────────────────────
        ADG_BENCHMARKS = {
            "piglet":   0.25,
            "weaner":   0.40,
            "grower":   0.65,
            "finisher": 0.85,
            "breeder":  0.20,
        }

        adg_data = []
        pigs = farm.pigs.exclude(health_status="deceased")
        for pig in pigs:
            records = pig.weight_records.order_by("recorded_at")
            if records.count() < 2:
                continue
            first = records.first()
            last  = records.last()
            days  = (last.recorded_at - first.recorded_at).days
            if days == 0:
                continue

            adg       = round(float(last.weight_kg - first.weight_kg) / days, 3)
            benchmark = ADG_BENCHMARKS.get(pig.growth_stage, 0.5)
            performance = round((adg / benchmark) * 100, 1)

            adg_data.append({
                "pig_name":                    pig.name,
                "pig_id":                      pig.pig_id,
                "growth_stage":                pig.growth_stage,
                "current_weight":              float(last.weight_kg),
                "adg_kg_per_day":              adg,
                "benchmark_kg_per_day":        benchmark,
                "performance_vs_benchmark_pct":performance,
                "status": (
                    "Above benchmark" if performance >= 100
                    else "Below benchmark" if performance < 80
                    else "Near benchmark"
                ),
            })

        return Response({
            "farrowing_forecasts":    farrowing_forecasts,
            "next_breeding_windows":  next_breeding,
            "adg_performance":        adg_data,
            "summary": {
                "pregnant_sows": BreedingRecord.objects.filter(
                    sow__farm=farm,
                    pregnancy_status="pregnant"
                ).count(),
                "farrowing_within_7_days":    sum(1 for f in farrowing_forecasts if f["alert"]),
                "sows_ready_to_breed":        sum(1 for b in next_breeding if b["ready_to_breed"]),
                "pigs_above_adg_benchmark":   sum(1 for a in adg_data if a["status"] == "Above benchmark"),
                "pigs_below_adg_benchmark":   sum(1 for a in adg_data if a["status"] == "Below benchmark"),
            }
        })

    @action(detail=True, methods=["post"])
    def record_farrowing(self, request, pk=None):
        """
        Record actual farrowing with piglet counts.
        Updates breeding record and sow health status.
        """
        record = self.get_object()
        piglets_alive = request.data.get("piglets_born_alive")
        piglets_dead  = request.data.get("piglets_born_dead", 0)
        notes         = request.data.get("notes", "")

        if piglets_alive is None:
            return Response(
                {"error": "piglets_born_alive is required."},
                status=400
            )

        record.pregnancy_status    = "farrowed"
        record.piglets_born_alive  = int(piglets_alive)
        record.piglets_born_dead   = int(piglets_dead)
        record.actual_farrowing_date = date.today()
        record.notes               = notes
        record.save()

        # Create in-app notification
        total = int(piglets_alive) + int(piglets_dead)
        Notification.objects.create(
            farm=record.sow.farm,
            notification_type="breeding",
            title=f"{record.sow.name} has farrowed!",
            message=(
                f"{record.sow.name} delivered {piglets_alive} live "
                f"and {piglets_dead} dead piglet(s) "
                f"({total} total) on {date.today()}."
            ),
        )

        return Response(BreedingRecordSerializer(record).data)

    @action(detail=False, methods=["get"])
    def sow_performance(self, request):
        """
        Sow performance analytics —
        total litters, avg live piglets, survival rate per sow.
        """
        farm = Farm.objects.get(owner=request.user)
        sows = farm.pigs.filter(gender="female", growth_stage="breeder")

        results = []
        for sow in sows:
            records = BreedingRecord.objects.filter(
                sow=sow, pregnancy_status="farrowed"
            )
            total_litters = records.count()
            if total_litters == 0:
                continue

            total_alive = sum(r.piglets_born_alive or 0 for r in records)
            total_dead  = sum(r.piglets_born_dead  or 0 for r in records)
            total_born  = total_alive + total_dead
            avg_alive   = round(total_alive / total_litters, 1)
            survival    = round((total_alive / total_born * 100), 1) if total_born > 0 else 0

            # Performance rating
            if avg_alive >= 10 and survival >= 90:
                rating = "Excellent"
            elif avg_alive >= 8 and survival >= 80:
                rating = "Good"
            elif avg_alive >= 6:
                rating = "Average"
            else:
                rating = "Poor"

            results.append({
                "sow_name":        sow.name,
                "sow_id":          sow.pig_id,
                "total_litters":   total_litters,
                "total_alive":     total_alive,
                "total_dead":      total_dead,
                "avg_live_piglets":avg_alive,
                "survival_rate":   survival,
                "performance_rating": rating,
                "last_farrowed":   str(records.order_by("-actual_farrowing_date").first().actual_farrowing_date or "—"),
            })

        # Sort best performers first
        results.sort(key=lambda x: (x["avg_live_piglets"], x["survival_rate"]), reverse=True)
        return Response(results)

class FeedInventoryViewSet(viewsets.ModelViewSet):
    serializer_class = FeedInventorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        farm = Farm.objects.get(owner=self.request.user)
        return farm.feed_inventory.all()

    def perform_create(self, serializer):
        farm = Farm.objects.get(owner=self.request.user)
        serializer.save(farm=farm)

    @action(detail=True, methods=["post"])
    def log_usage(self, request, pk=None):
        """Deduct feed used today from stock and trigger alerts if low."""
        feed = self.get_object()
        amount = float(request.data.get("amount_kg", 0))
        if amount <= 0:
            return Response({"error": "Amount must be greater than 0."}, status=400)
        if amount > feed.stock_kg:
            return Response({"error": "Not enough stock."}, status=400)

        from decimal import Decimal
        feed.stock_kg = feed.stock_kg - Decimal(str(amount))
        feed.save()

        FeedUsageLog.objects.create(farm=feed.farm, feed=feed, amount_used_kg=amount)

        # ── Trigger low stock alert if days remaining drops to 5 or below ──
        if feed.days_remaining is not None and int(feed.days_remaining) <= 5:
            from .models import Notification
            from .services.sms import send_low_stock_alert

            # Create in-app notification
            Notification.objects.get_or_create(
                farm=feed.farm,
                title=f"Low feed: {feed.get_feed_type_display()}",
                defaults={
                    "notification_type": "inventory",
                    "message": (
                        f"{feed.get_feed_type_display()} is running low — "
                        f"{feed.stock_kg}kg remaining "
                        f"(~{feed.days_remaining} days at current usage). "
                        f"Please restock soon."
                    ),
                    "is_read": False,
                }
            )

            # Send SMS if phone number is available
            try:
                phone = feed.farm.owner.profile.phone_number
                send_low_stock_alert(
                    phone,
                    feed.get_feed_type_display(),
                    f"{feed.stock_kg}kg"
                )
            except Exception:
                pass  # Skip SMS if profile/phone not set up yet

        return Response(FeedInventorySerializer(feed).data)


class MedicineInventoryViewSet(viewsets.ModelViewSet):
    serializer_class = MedicineInventorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        farm = Farm.objects.get(owner=self.request.user)
        return farm.medicine_inventory.all()

    def perform_create(self, serializer):
        farm = Farm.objects.get(owner=self.request.user)
        serializer.save(farm=farm)

    @action(detail=True, methods=["post"])
    def update_stock(self, request, pk=None):
        """Add or deduct medicine stock."""
        medicine = self.get_object()
        action_type = request.data.get("action", "deduct")  # "deduct" or "restock"
        amount = int(request.data.get("amount", 0))

        if amount <= 0:
            return Response({"error": "Amount must be greater than 0."}, status=400)

        if action_type == "deduct":
            if amount > medicine.quantity:
                return Response({"error": "Not enough stock."}, status=400)
            medicine.quantity -= amount
        else:
            medicine.quantity += amount

        medicine.save()

        # Trigger low stock notification if needed
        if medicine.is_low_stock:
            from .models import Notification
            Notification.objects.get_or_create(
                farm=medicine.farm,
                title=f"Low stock: {medicine.name}",
                defaults={
                    "notification_type": "inventory",
                    "message": (
                        f"{medicine.name} is running low — "
                        f"{medicine.quantity} {medicine.unit} remaining. "
                        f"Please restock soon."
                    ),
                    "is_read": False,
                }
            )

        return Response(MedicineInventorySerializer(medicine).data)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        farm = Farm.objects.get(owner=self.request.user)
        return farm.notifications.all()

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response({"status": "marked as read"})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        farm = Farm.objects.get(owner=self.request.user)
        farm.notifications.filter(is_read=False).update(is_read=True)
        return Response({"status": "all marked as read"})
    
    
class HealthLogViewSet(viewsets.ModelViewSet):
    serializer_class   = HealthLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pig_id = self.kwargs.get("pig_pk")
        return HealthLog.objects.filter(
            pig__id=pig_id,
            pig__farm__owner=self.request.user
        )

    def perform_create(self, serializer):
        from .services.health_rules import evaluate_health_log
        from .services.sms import send_health_alert

        pig = Pig.objects.get(pk=self.kwargs["pig_pk"])
        log = serializer.save(pig=pig, logged_by=self.request.user)

        # ── Run rule engine ───────────────────────────────────────
        severity, findings = evaluate_health_log(log)
        log.severity       = severity
        log.system_findings = findings
        log.save()

        # ── Auto-update pig health status ─────────────────────────
        if severity == "critical":
            pig.health_status = "critical"
        elif severity == "warning":
            pig.health_status = "under_treatment"
        else:
            pig.health_status = "healthy"
        pig.last_checkup_date = log.date_logged
        pig.save()

        # ── Create in-app notification if not normal ──────────────
        if severity != "normal":
            first_finding = findings.split("\n")[0]
            Notification.objects.create(
                farm=pig.farm,
                notification_type="health",
                title=f"{'🔴 CRITICAL' if severity == 'critical' else '🟡 Warning'}: {pig.name}",
                message=first_finding,
                is_read=False,
            )

            # ── Send SMS ──────────────────────────────────────────
            try:
                phone = pig.farm.owner.profile.phone_number
                if phone:
                    send_health_alert(phone, pig.name, first_finding[:100])
            except Exception:
                pass