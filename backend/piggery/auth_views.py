"""
Token-based login view.
POST /api/auth/login/  { "username": "...", "password": "..." }
Returns: { "token": "...", "user_id": 1, "farm_id": 1 }
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Farm


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)
    if not user:
        return Response({"error": "Invalid credentials"}, status=400)

    token, _ = Token.objects.get_or_create(user=user)
    farm = Farm.objects.filter(owner=user).first()

    return Response({
        "token": token.key,
        "user_id": user.id,
        "username": user.username,
        "farm_id": farm.id if farm else None,
        "farm_name": farm.name if farm else None,
    })
@api_view(["POST"])
def logout_view(request):
    try:
        request.user.auth_token.delete()
        return Response({"message": "Logged out successfully"})
    except:
        return Response({"error": "Something went wrong"}, status=400)