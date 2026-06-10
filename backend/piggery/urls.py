from django.urls import path, include
from rest_framework_nested import routers

from .auth_views import login_view, logout_view, register_view, me_view
from .views import (
    # Farmer-facing
    FarmViewSet,
    PigViewSet,
    WeightRecordViewSet,
    VaccinationViewSet,
    DiseaseViewSet,
    BreedingViewSet,
    FeedInventoryViewSet,
    MedicineInventoryViewSet,
    NotificationViewSet,
    HealthLogViewSet,
    # Admin-facing
    AuditLogViewSet,
    AdminStatsViewSet,
    AdminFarmerViewSet,
    FarmerAnalyticsViewSet,
)

# ── Top-level router ──────────────────────────────────────────────────────────
router = routers.DefaultRouter()
router.register(r"farms",          FarmViewSet,              basename="farm")
router.register(r"pigs",           PigViewSet,               basename="pig")
router.register(r"breeding",       BreedingViewSet,          basename="breeding")
router.register(r"feed",           FeedInventoryViewSet,     basename="feed")
router.register(r"medicine",       MedicineInventoryViewSet, basename="medicine")
router.register(r"notifications",  NotificationViewSet,      basename="notification")
router.register(r"audit-logs",     AuditLogViewSet,          basename="audit-log")

# ── Admin routes ──────────────────────────────────────────────────────────────
router.register(r"admin/stats",     AdminStatsViewSet,      basename="admin-stats")
router.register(r"admin/farmers",   AdminFarmerViewSet,     basename="admin-farmers")
router.register(r"admin/analytics", FarmerAnalyticsViewSet, basename="admin-analytics")

# ── Nested router ─────────────────────────────────────────────────────────────
pig_router = routers.NestedDefaultRouter(router, r"pigs", lookup="pig")
pig_router.register(r"weights",      WeightRecordViewSet, basename="pig-weights")
pig_router.register(r"vaccinations", VaccinationViewSet,  basename="pig-vaccinations")
pig_router.register(r"diseases",     DiseaseViewSet,      basename="pig-diseases")
pig_router.register(r"health-logs",  HealthLogViewSet,    basename="pig-health-logs")

urlpatterns = [
    path("auth/token/", login_view),
    path("auth/logout/", logout_view),
    path("auth/register/", register_view),
    path("auth/me/", me_view),

    path("", include(router.urls)),
    path("", include(pig_router.urls)),
]