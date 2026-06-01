"""
backend/piggery/auth_views.py — complete replacement

Fixes applied:
  Issue 2: register_view always creates a Farm regardless of role
  Issue 4: role is hardcoded to "farmer" — removed from client input
  Issue 5: django_login() called on success so user.last_login is updated
"""
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login   # ← Issue 5 fix
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

    # ── Issue 5 fix: call django_login() so user.last_login is updated ────────
    django_login(request, user)

    profile  = get_or_create_profile(user)
    farm     = Farm.objects.filter(owner=user).first()
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

    Issue 2 fix: Farm is ALWAYS created regardless of role.
    Issue 4 fix: Role is hardcoded to "farmer" — client no longer controls it.
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
        return Response({"error": "That username is already taken. Please choose a different one."}, status=400)

    parts = full_name.split(" ", 1)
    first = parts[0]
    last  = parts[1] if len(parts) > 1 else ""

    user = User.objects.create_user(
        username=username,
        password=password,
        first_name=first,
        last_name=last,
    )

    # Profile — role is always "farmer", set by the system not the user
    profile              = get_or_create_profile(user)
    profile.phone_number = phone
    profile.role         = "farmer"   # ← Issue 4 fix: hardcoded
    profile.farm_type    = "solo"     # ← default
    profile.save()

    # Farm — ALWAYS created so pig/feed/inventory endpoints never get a missing farm
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
    """Delete the user's token and create an audit log entry."""
    user = request.user
    _log(user, "logout", f"User '{user.username}' signed out.", request)
    try:
        user.auth_token.delete()
    except Exception:
        pass
    return Response({"message": "Logged out successfully."})