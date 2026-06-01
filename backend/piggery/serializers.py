"""
backend/piggery/serializers.py

Complete serializer file.

Changes vs previous versions:
  - HealthLogSerializer ADDED  (was missing — caused ImportError on startup)
  - HealthLog added to models import
  - DiseaseRecordSerializer now includes disease_category field
  - BreedingRecordSerializer includes sow_pig_id, piglets_weaned, wean_date
"""
from rest_framework import serializers
from .models import (
    Farm, Pig, WeightRecord, VaccinationRecord,
    DiseaseRecord, BreedingRecord, FeedInventory,
    MedicineInventory, FeedUsageLog, Notification, HealthLog,
)


class WeightRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WeightRecord
        fields = ["id", "weight_kg", "recorded_at", "body_condition_score", "notes"]


class VaccinationRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VaccinationRecord
        fields = ["id", "vaccine_name", "date_given", "next_due_date", "administered_by", "notes"]


class DiseaseRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DiseaseRecord
        fields = [
            "id", "disease_category", "disease_name",
            "diagnosed_date", "treatment", "outcome", "resolved_date", "notes",
        ]


class HealthLogSerializer(serializers.ModelSerializer):
    """
    Serializes HealthLog records for read and write.

    system_findings and severity are computed by health_rules.evaluate_health_log()
    in the view before the record is saved, so they are read-only here.

    All physical sign fields (has_cough, has_nasal_discharge, etc.) are included
    so analytics can aggregate symptom frequency across the farm.
    """
    class Meta:
        model  = HealthLog
        fields = [
            "id", "pig", "date_logged", "time_logged",
            # Vitals
            "temperature_c", "respiratory_rate", "heart_rate",
            # Observations
            "appetite", "behavior", "stool_condition",
            # Physical signs
            "has_cough", "has_nasal_discharge", "has_skin_lesions",
            "has_lameness", "has_vomiting",
            # Computed by health_rules — read only
            "severity", "system_findings",
            "notes",
        ]
        read_only_fields = ["severity", "system_findings", "date_logged", "time_logged"]


class BreedingRecordSerializer(serializers.ModelSerializer):
    sow_name   = serializers.CharField(source="sow.name",   read_only=True)
    sow_pig_id = serializers.CharField(source="sow.pig_id", read_only=True)

    class Meta:
        model  = BreedingRecord
        fields = [
            "id", "sow", "sow_name", "sow_pig_id", "boar", "breeding_date",
            "expected_farrowing_date", "actual_farrowing_date",
            "pregnancy_status", "piglets_born_alive", "piglets_born_dead",
            "piglets_weaned", "wean_date", "notes",
        ]


class PigListSerializer(serializers.ModelSerializer):
    age_in_months = serializers.ReadOnlyField()
    latest_weight = serializers.ReadOnlyField()

    class Meta:
        model  = Pig
        fields = [
            "id", "name", "pig_id", "date_of_birth", "age_in_months",
            "gender", "breed", "growth_stage", "health_status",
            "last_checkup_date", "latest_weight",
        ]


class PigDetailSerializer(serializers.ModelSerializer):
    age_in_months    = serializers.ReadOnlyField()
    latest_weight    = serializers.ReadOnlyField()
    weight_records   = WeightRecordSerializer(many=True, read_only=True)
    vaccinations     = VaccinationRecordSerializer(many=True, read_only=True)
    diseases         = DiseaseRecordSerializer(many=True, read_only=True)
    breeding_records = BreedingRecordSerializer(many=True, read_only=True)

    class Meta:
        model  = Pig
        fields = "__all__"


class FeedInventorySerializer(serializers.ModelSerializer):
    days_remaining        = serializers.ReadOnlyField()
    feed_type_display     = serializers.CharField(source="get_feed_type_display", read_only=True)
    effective_daily_usage = serializers.ReadOnlyField()

    class Meta:
        model  = FeedInventory
        fields = [
            "id", "feed_type", "feed_type_display", "stock_kg",
            "daily_usage_kg", "effective_daily_usage", "price_per_kg",
            "days_remaining", "last_restocked", "updated_at",
        ]


class MedicineInventorySerializer(serializers.ModelSerializer):
    is_low_stock     = serializers.ReadOnlyField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model  = MedicineInventory
        fields = [
            "id", "name", "category", "category_display", "quantity", "unit",
            "low_stock_threshold", "is_low_stock", "expiry_date", "updated_at",
        ]


class FeedUsageLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeedUsageLog
        fields = ["id", "feed", "amount_used_kg", "date_used", "notes"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = [
            "id", "notification_type", "title", "message",
            "is_read", "sent_via_sms", "created_at",
        ]


class FarmSerializer(serializers.ModelSerializer):
    pig_count         = serializers.SerializerMethodField()
    healthy_pig_count = serializers.SerializerMethodField()

    class Meta:
        model  = Farm
        fields = ["id", "name", "location", "pig_count", "healthy_pig_count", "created_at"]

    def get_pig_count(self, obj):
        return obj.pigs.exclude(health_status="deceased").count()

    def get_healthy_pig_count(self, obj):
        return obj.pigs.filter(health_status="healthy").count()