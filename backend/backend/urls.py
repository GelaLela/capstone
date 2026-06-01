from django.contrib import admin
from django.urls import path, include
from piggery.auth_views import login_view, register_view

urlpatterns = [
    path("api/auth/login/",    login_view,    name="login"),
    path("api/auth/register/", register_view, name="register"),
    path("admin/", admin.site.urls),
    path("", include("piggery.urls")),
]