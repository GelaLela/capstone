"""
piggery/weather.py

Self-contained weather service using Open-Meteo API.
Free to use, no API key required.
Docs: https://open-meteo.com/en/docs

This file lives at:  backend/piggery/weather.py
Imported by views.py as:  from .weather import get_weather_alert
"""

import requests

# Default coordinates — Concepcion, Tarlac, Philippines
DEFAULT_LAT = 15.3256
DEFAULT_LON  = 120.6560


def get_weather_data(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> dict:
    """Fetch current weather from Open-Meteo. Returns raw API response or error dict."""
    url = "https://api.open-meteo.com/v1/forecast"
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
        "timezone":      "Asia/Manila",
        "forecast_days": 1,
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"error": str(e)}


def get_weather_alert(location: str = None) -> dict:
    """
    Returns current weather data plus piggery-specific health alerts.
    Called by: GET /api/farms/{id}/weather/

    Never raises — always returns a dict so the dashboard still loads
    even when the weather API is unreachable.
    """
    data = get_weather_data()

    if "error" in data:
        return {
            "error":            data["error"],
            "temperature_c":    None,
            "humidity_percent": None,
            "precipitation_mm": None,
            "wind_speed_kph":   None,
            "alerts":           [],
            "alert_count":      0,
        }

    current  = data.get("current", {})
    temp     = current.get("temperature_2m",       25.0)
    humidity = current.get("relative_humidity_2m", 70.0)
    precip   = current.get("precipitation",         0.0)
    wind     = current.get("wind_speed_10m",         0.0)

    alerts = []

    # Heat stress — dangerous above 32°C for pigs
    if temp >= 32:
        alerts.append({
            "type":    "danger",
            "title":   "Extreme heat alert",
            "message": (
                f"Temperature is {temp}°C. Provide extra water and shade. "
                "Reduce feeding during peak heat (11am–3pm)."
            ),
        })
    elif temp >= 28:
        alerts.append({
            "type":    "warning",
            "title":   "Heat stress risk",
            "message": (
                f"Temperature is {temp}°C. Monitor pigs for panting or lethargy. "
                "Increase water supply."
            ),
        })

    # Cold stress — unusual in PH lowlands but affects piglets
    if temp < 18:
        alerts.append({
            "type":    "info",
            "title":   "Cool temperature",
            "message": f"Temperature is {temp}°C. Provide extra bedding for piglets.",
        })

    # High humidity increases respiratory disease risk
    if humidity >= 85:
        alerts.append({
            "type":    "warning",
            "title":   "High humidity",
            "message": f"Humidity at {humidity}%. Improve ventilation to reduce disease risk.",
        })

    # Heavy rain — drainage alert
    if precip > 5:
        alerts.append({
            "type":    "info",
            "title":   "Heavy rain",
            "message": (
                f"Rainfall: {precip}mm. Ensure pig pens have proper drainage and are dry."
            ),
        })

    return {
        "temperature_c":    temp,
        "humidity_percent": humidity,
        "precipitation_mm": precip,
        "wind_speed_kph":   wind,
        "alerts":           alerts,
        "alert_count":      len(alerts),
        "pig_comfort":      None,   # populated by weather_intelligence if available
    }