"""
backend/piggery/services/weather.py   (or backend/piggery/weather.py — matches the import in views.py)

Weather data fetched from Open-Meteo (free, no API key).
Pig-specific risk analysis delegated to weather_intelligence.py.

Import path used by views.py:
    from .weather import get_weather_alert
"""

import requests

DEFAULT_LAT = 13.9626
DEFAULT_LON = 121.5264


def get_weather_data(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> dict:
    """Fetch current weather from Open-Meteo API (free, no key required)."""
    url    = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":  lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "wind_speed_10m",
            "weather_code",
        ],
        "timezone":     "Asia/Manila",
        "forecast_days": 1,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        return {"error": str(e)}


def get_weather_alert(location: str = None, farm=None) -> dict:
    """
    Returns weather data plus pig-specific risk assessment.

    When `farm` is provided, the pig population is used to compute
    per-stage risk. When only location is provided (legacy call),
    returns generic alerts only.

    Used by:
      GET /api/farms/{id}/weather/
      Dashboard weather card
      Notification generation
    """
    data = get_weather_data()

    if "error" in data:
        return {
            "error":          data["error"],
            "alerts":         [],
            "alert_count":    0,
            "temperature_c":  None,
            "humidity_percent": None,
            "pig_comfort":    None,
        }

    current  = data.get("current", {})
    temp_c   = round(float(current.get("temperature_2m",        25.0)), 1)
    humidity = round(float(current.get("relative_humidity_2m",  70.0)), 1)
    precip   = round(float(current.get("precipitation",          0.0)), 1)
    wind     = round(float(current.get("wind_speed_10m",          0.0)), 1)
    wcode    = int(current.get("weather_code", 0))
    condition, condition_icon = _decode_weather_code(wcode)

    # ── Generic piggery alerts (always present) ───────────────────────────────
    alerts = []

    if temp_c >= 35:
        alerts.append({
            "type":    "critical",
            "title":   "Dangerous heat alert",
            "message": (f"Temperature is {temp_c}°C. Severe heat stress risk for all pigs. "
                        "Immediate cooling intervention required."),
        })
    elif temp_c >= 27:
        alerts.append({
            "type":    "warning",
            "title":   "Heat stress risk",
            "message": (f"Temperature is {temp_c}°C. Monitor pigs for panting and lethargy. "
                        "Increase water supply and improve ventilation."),
        })

    if humidity >= 85:
        alerts.append({
            "type":    "warning",
            "title":   "High humidity",
            "message": (f"Humidity at {humidity}%. High humidity amplifies heat stress. "
                        "Improve ventilation. Risk is increased at current temperature."),
        })

    if temp_c < 22:
        alerts.append({
            "type":    "warning",
            "title":   "Cold stress risk for piglets",
            "message": (f"Temperature is {temp_c}°C. Piglets require 30–35°C. "
                        "Verify heat lamp function in farrowing pens."),
        })
    elif temp_c < 26:
        alerts.append({
            "type":    "info",
            "title":   "Cool temperature — check piglets",
            "message": (f"Temperature is {temp_c}°C. Below optimal range for piglets (30–35°C). "
                        "Monitor farrowing pen temperatures."),
        })

    if precip > 5:
        alerts.append({
            "type":    "info",
            "title":   "Heavy rain",
            "message": (f"Rainfall: {precip} mm. Ensure pens have proper drainage. "
                        "Keep piglets dry to prevent chilling."),
        })

    # ── Pig-specific risk analysis (requires farm with pig population) ────────
    pig_comfort = None
    if farm is not None:
        try:
            from .weather_intelligence import evaluate_farm_weather_risk
            pig_comfort = evaluate_farm_weather_risk(farm, temp_c, humidity)

            # Merge pig-specific notifications into alerts
            for notif in pig_comfort.get("notifications", []):
                # Avoid duplicating the generic alerts
                already_covered = any(
                    notif["title"][:20] in a["title"]
                    for a in alerts
                )
                if not already_covered:
                    alerts.append({
                        "type":    notif["status"],
                        "title":   notif["title"],
                        "message": notif["message"],
                    })
        except Exception:
            pig_comfort = None

    return {
        "temperature_c":    temp_c,
        "humidity_percent": humidity,
        "precipitation_mm": precip,
        "wind_speed_kph":   wind,
        "condition":        condition,
        "condition_icon":   condition_icon,
        "alerts":           alerts,
        "alert_count":      len(alerts),
        "pig_comfort":      pig_comfort,
    }


def _decode_weather_code(code: int) -> tuple:
    """
    Decode Open-Meteo WMO weather code into human-readable label and icon key.
    https://open-meteo.com/en/docs#weathervariables
    Returns (label, icon_key)
    icon_key maps to frontend PNG: "sunny" | "cloudy" | "rainy" | "stormy" | "foggy"
    """
    if code == 0:
        return "Clear Sky", "sunny"
    elif code == 1:
        return "Mainly Clear", "sunny"
    elif code == 2:
        return "Partly Cloudy", "cloudy"
    elif code == 3:
        return "Overcast", "cloudy"
    elif code in (45, 48):
        return "Foggy", "foggy"
    elif code in (51, 53, 55):
        return "Drizzle", "rainy"
    elif code in (61, 63, 65):
        return "Rain", "rainy"
    elif code in (71, 73, 75, 77):
        return "Snow", "cloudy"
    elif code in (80, 81, 82):
        return "Rain Showers", "rainy"
    elif code in (95, 96, 99):
        return "Thunderstorm", "stormy"
    else:
        return "Partly Cloudy", "cloudy"