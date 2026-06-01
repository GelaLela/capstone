from django.urls import path, include
from rest_framework_nested import routers
from .auth_views import login_view, register_view, logout_view
from .views import (
    FarmViewSet, PigViewSet, WeightRecordViewSet,
    VaccinationViewSet, DiseaseViewSet, BreedingViewSet,
    FeedInventoryViewSet, MedicineInventoryViewSet,
    NotificationViewSet, HealthLogViewSet, AuditLogViewSet, FarmerAnalyticsViewSet
)
from .views import AdminStatsViewSet, AdminFarmerViewSet

router = routers.DefaultRouter()
router.register(r"farms",         FarmViewSet,              basename="farm")
router.register(r"pigs",          PigViewSet,               basename="pig")
router.register(r"breeding",      BreedingViewSet,          basename="breeding")
router.register(r"feed",          FeedInventoryViewSet,     basename="feed")
router.register(r"medicine",      MedicineInventoryViewSet, basename="medicine")
router.register(r"notifications", NotificationViewSet,      basename="notification")
router.register(r"audit-logs",    AuditLogViewSet,          basename="audit-logs")

pig_router = routers.NestedDefaultRouter(router, r"pigs", lookup="pig")
pig_router.register(r"weights",      WeightRecordViewSet, basename="pig-weights")
pig_router.register(r"vaccinations", VaccinationViewSet,  basename="pig-vaccinations")
pig_router.register(r"diseases",     DiseaseViewSet,      basename="pig-diseases")
pig_router.register(r"health-logs",  HealthLogViewSet,    basename="pig-health-logs")
router.register(r"admin/stats",   AdminStatsViewSet,  basename="admin-stats")
router.register(r"admin/farmers", AdminFarmerViewSet, basename="admin-farmers")
router.register(r"admin/farmer-analytics", FarmerAnalyticsViewSet, basename="farmer-analytics")

urlpatterns = [
    path("api/", include(router.urls)),
    path("api/", include(pig_router.urls)),
    path("api/auth/login/",    login_view,    name="login"),
    path("api/auth/register/", register_view, name="register"),
    path("api/auth/logout/",   logout_view,   name="logout"),
]
