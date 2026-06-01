"""
backend/piggery/auth_views.py

Registration architecture:
  1. All three records (User, UserProfile, Farm) are created inside
     transaction.atomic() — if any step fails, ALL are rolled back.
     No orphaned User without a Farm can ever exist after this point.

  2. The post_save signal on User creates UserProfile automatically,
     so get_or_create_profile() is a safe idempotent call.

  3. Farm is ALWAYS created. No role check. Every registered account
     gets a Farm immediately so pig/feed endpoints work on first login.
"""
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.db import transaction
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import Farm, UserProfile


def get_or_create_profile(user):
    """Always safely get or create a user profile."""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def _log(user, action, description, request=None):
    """Create an audit log entry safely. Never raises."""
    try:
        from .models import AuditLog
        ip = ""
        if request:
            x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = x_forwarded.split(",")[0] if x_forwarded else request.META.get("REMOTE_ADDR", "")
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name="Auth",
            description=description,
            ip_address=ip,
        )
    except Exception:
        pass


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "").strip()

    if not username or not password:
        return Response(
            {"error": "Please enter both username and password."},
            status=400
        )

    user = authenticate(username=username, password=password)

    if not user:
        return Response(
            {"error": "Incorrect username or password. Please check your details and try again."},
            status=400
        )

    if not user.is_active:
        return Response(
            {"error": "This account has been disabled. Please contact the administrator."},
            status=400
        )

    # Update last_login
    django_login(request, user)

    # Safety net: if this user somehow has no farm, create one now
    # This handles accounts created before the fix was applied
    profile = get_or_create_profile(user)
    farm    = Farm.objects.filter(owner=user).first()
    if not farm and not (user.is_staff or user.is_superuser):
        farm = Farm.objects.create(
            owner=user,
            name=f"{user.first_name or user.username}'s Farm",
            location="Concepcion, Tarlac",
        )

    token, _ = Token.objects.get_or_create(user=user)
    _log(user, "login", f"User '{user.username}' signed in successfully.", request)

    return Response({
        "token":    token.key,
        "farm_id":  farm.id if farm else None,
        "username": user.username,
        "role":     profile.role,
        "is_admin": user.is_staff or user.is_superuser,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new farmer account.

    Uses transaction.atomic() so User + UserProfile + Farm are ALL
    created together or ALL rolled back. No partial state is possible.
    """
    full_name = request.data.get("full_name", "").strip()
    username  = request.data.get("username",  "").strip()
    password  = request.data.get("password",  "").strip()
    phone     = request.data.get("phone_number", "").strip()
    farm_name = request.data.get("farm_name", "").strip()

    # Validation
    if not full_name:
        return Response({"error": "Please enter your full name."}, status=400)
    if not username:
        return Response({"error": "Please enter a username."}, status=400)
    if " " in username:
        return Response({"error": "Username cannot contain spaces."}, status=400)
    if not password:
        return Response({"error": "Please enter a password."}, status=400)
    if len(password) < 6:
        return Response({"error": "Password must be at least 6 characters long."}, status=400)
    if User.objects.filter(username=username).exists():
        return Response(
            {"error": "That username is already taken. Please choose a different one."},
            status=400
        )

    parts = full_name.split(" ", 1)
    first = parts[0]
    last  = parts[1] if len(parts) > 1 else ""

    # ── Everything inside atomic() — all-or-nothing ────────────────────────
    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first,
            last_name=last,
        )
        # post_save signal will have already created a bare UserProfile.
        # We fetch it and update with the registration data.
        profile              = get_or_create_profile(user)
        profile.phone_number = phone
        profile.role         = "farmer"
        profile.farm_type    = "solo"
        profile.save()

        # Farm is ALWAYS created here — never conditional
        name = farm_name or f"{full_name}'s Farm"
        farm = Farm.objects.create(
            owner=user,
            name=name,
            location="Concepcion, Tarlac",
        )

        token, _ = Token.objects.get_or_create(user=user)

    _log(user, "create", f"New farmer account registered: '{username}'.", request)

    return Response({
        "token":    token.key,
        "farm_id":  farm.id,
        "username": user.username,
        "role":     "farmer",
        "is_admin": False,
        "message":  f"Welcome to Piglytics, {first}! 🐷",
    }, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    user = request.user
    _log(user, "logout", f"User '{user.username}' signed out.", request)
    try:
        user.auth_token.delete()
    except Exception:
        pass
    return Response({"message": "Logged out successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    GET /api/auth/me/

    Token validation endpoint used by AuthContext on cold start.
    Returns 200 if the token is valid, 401 if expired/invalid (handled by DRF).
    Returns minimal user data to allow AuthContext to refresh state if needed.
    """
    user = request.user
    try:
        is_admin = user.profile.role == "admin" or user.is_staff or user.is_superuser
    except Exception:
        is_admin = user.is_staff or user.is_superuser

    farm = None
    try:
        from .models import Farm
        farm = Farm.objects.filter(owner=user).first()
    except Exception:
        pass

    return Response({
        "id":       user.id,
        "username": user.username,
        "is_admin": is_admin,
        "farm_id":  farm.id if farm else None,
    })