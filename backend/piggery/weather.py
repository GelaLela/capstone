"""
piggery/weather.py

Weather service using Open-Meteo API (free, no API key required).
Docs: https://open-meteo.com/en/docs

Coordinates: Sariaya, Quezon, Philippines
  DEFAULT_LAT = 14.0009
  DEFAULT_LON = 121.4869

If your farm is in a different municipality, update these two values.
Open-Meteo uses a ~1km grid — coordinates within your barangay are accurate enough.
"""

import requests

DEFAULT_LAT     = 14.0009
DEFAULT_LON     = 121.4869
WEATHER_TIMEOUT = 5  # seconds


# ─────────────────────────────────────────────────────────────────────────────
# PIG COMFORT RANGES
# Scientifically accepted thermoneutral zones by growth stage.
# ─────────────────────────────────────────────────────────────────────────────

PIG_COMFORT_RANGES = {
    "piglet": {
        "label":     "Newborn / Piglet",
        "tnz_low_c":  30.0, "tnz_high_c": 35.0,
        "tnz_low_f":  86.0, "tnz_high_f": 95.0,
        "cold_rec": (
            "Provide heat lamps or supplemental heating in the farrowing area. "
            "Add extra bedding. Eliminate drafts. "
            "Target pen temperature of 30–35°C (86–95°F)."
        ),
        "heat_rec": (
            "Increase ventilation and airflow. Provide cool, fresh water at all times. "
            "Use misting or evaporative cooling if available. Reduce stocking density."
        ),
    },
    "weaner": {
        "label":     "Nursery / Weaned Pig",
        "tnz_low_c":  21.0, "tnz_high_c": 28.0,
        "tnz_low_f":  70.0, "tnz_high_f": 82.0,
        "cold_rec": (
            "Provide supplemental heat or deep bedding. "
            "Block drafts and reduce ventilation openings. "
            "Check feeder and drinker access."
        ),
        "heat_rec": (
            "Increase ventilation. Ensure continuous access to cool water. "
            "Avoid moving pigs during peak heat (10am–3pm). "
            "Monitor for panting and lethargy."
        ),
    },
    "grower": {
        "label":     "Grower Pig",
        "tnz_low_c":  18.0, "tnz_high_c": 22.0,
        "tnz_low_f":  64.0, "tnz_high_f": 72.0,
        "cold_rec": (
            "Add bedding material to reduce heat loss. Reduce ventilation slightly. "
            "Monitor feed intake — cold pigs eat more to maintain body temperature."
        ),
        "heat_rec": (
            "Increase water supply. Improve air circulation. Provide shade. "
            "Reduce stocking density. Move feeding to early morning or evening."
        ),
    },
    "finisher": {
        "label":     "Finishing / Market Pig",
        "tnz_low_c":  18.0, "tnz_high_c": 22.0,
        "tnz_low_f":  64.0, "tnz_high_f": 72.0,
        "cold_rec": (
            "Add bedding. Monitor feed conversion ratio. "
            "Check for huddling as a sign of cold stress."
        ),
        "heat_rec": (
            "Heat stress in finishers reduces daily gain significantly. "
            "Increase water points. Add shade cloth or roofing. "
            "Schedule handling for cooler parts of the day."
        ),
    },
    "breeder": {
        "label":     "Adult / Mature Pig (Breeder)",
        "tnz_low_c":  15.0, "tnz_high_c": 21.0,
        "tnz_low_f":  59.0, "tnz_high_f": 70.0,
        "cold_rec": (
            "Adult pigs tolerate cold better than younger pigs. "
            "Provide dry bedding. Ensure shelter from rain and wind. "
            "Monitor sows in late gestation closely."
        ),
        "heat_rec": (
            "Heat stress reduces conception rates and litter size. "
            "Provide wallows or cooling mist for sows. "
            "Schedule breeding for early morning. "
            "Boar fertility declines above 27°C."
        ),
    },
}


def _celsius_to_fahrenheit(c: float) -> float:
    return round(c * 9 / 5 + 32, 1)


def classify_stage_comfort(stage: str, temp_c: float) -> dict:
    cfg    = PIG_COMFORT_RANGES.get(stage, PIG_COMFORT_RANGES["breeder"])
    temp_f = _celsius_to_fahrenheit(temp_c)

    if temp_c < cfg["tnz_low_c"]:
        status, label, rec = "cold_stress", "Cold Stress Risk", cfg["cold_rec"]
    elif temp_c > cfg["tnz_high_c"]:
        status, label, rec = "heat_stress", "Heat Stress Risk", cfg["heat_rec"]
    else:
        status = "normal"
        label  = "Normal"
        rec    = (
            f"Temperature is within the comfortable range for {cfg['label']}. "
            "Continue regular monitoring."
        )

    return {
        "stage":          stage,
        "stage_label":    cfg["label"],
        "status":         status,
        "status_label":   label,
        "tnz_low_c":      cfg["tnz_low_c"],
        "tnz_high_c":     cfg["tnz_high_c"],
        "tnz_low_f":      cfg["tnz_low_f"],
        "tnz_high_f":     cfg["tnz_high_f"],
        "temp_c":         round(temp_c, 1),
        "temp_f":         temp_f,
        "recommendation": rec,
    }


def evaluate_farm_pig_comfort(farm, temp_c: float) -> dict:
    STAGE_ORDER = ["piglet", "weaner", "grower", "finisher", "breeder"]

    stage_counts = {}
    try:
        for pig in farm.pigs.exclude(health_status="deceased"):
            s = pig.growth_stage
            stage_counts[s] = stage_counts.get(s, 0) + 1
    except Exception:
        stage_counts = {}

    if not stage_counts:
        stage_counts = {s: 0 for s in STAGE_ORDER}

    assessments  = []
    has_heat     = False
    has_cold     = False
    worst_status = "normal"
    SEVERITY     = {"normal": 0, "cold_stress": 1, "heat_stress": 2}

    for stage in STAGE_ORDER:
        if stage not in stage_counts:
            continue
        result               = classify_stage_comfort(stage, temp_c)
        result["pig_count"]  = stage_counts[stage]
        assessments.append(result)

        if result["status"] == "heat_stress":
            has_heat = True
        if result["status"] == "cold_stress":
            has_cold = True
        if SEVERITY.get(result["status"], 0) > SEVERITY.get(worst_status, 0):
            worst_status = result["status"]

    if worst_status == "heat_stress":
        overall_label = "Heat Stress Risk"
        summary = (
            f"Current temperature {round(temp_c, 1)}°C "
            f"({_celsius_to_fahrenheit(temp_c)}°F) exceeds the comfort zone "
            "for one or more pig groups on your farm. Take cooling action."
        )
    elif worst_status == "cold_stress":
        overall_label = "Cold Stress Risk"
        summary = (
            f"Current temperature {round(temp_c, 1)}°C "
            f"({_celsius_to_fahrenheit(temp_c)}°F) is below the comfort zone "
            "for one or more pig groups. Provide supplemental heating."
        )
    else:
        overall_label = "Normal"
        summary = (
            f"Temperature {round(temp_c, 1)}°C "
            f"({_celsius_to_fahrenheit(temp_c)}°F) is within the comfortable "
            "range for all pig groups on your farm."
        )

    return {
        "overall_status":      worst_status,
        "overall_label":       overall_label,
        # KEY FIX: field renamed from stage_assessments to stage_risks
        # DashboardScreen reads comfort?.stage_risks — must match this name
        "stage_risks":         assessments,
        "pig_comfort_summary": summary,
        "has_heat_stress":     has_heat,
        "has_cold_stress":     has_cold,
        "temp_c":              round(temp_c, 1),
        "temp_f":              _celsius_to_fahrenheit(temp_c),
    }


def get_weather_data(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> dict:
    """Fetch current weather from Open-Meteo. Returns raw dict or error dict."""
    url    = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":      lat,
        "longitude":     lon,
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
        response = requests.get(url, params=params, timeout=WEATHER_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        return {"error": "Weather service timed out. Please try again later."}
    except requests.ConnectionError:
        return {"error": "Cannot reach weather service. Check internet connection."}
    except requests.RequestException as e:
        return {"error": str(e)}


def get_weather_alert(location: str = None, farm=None) -> dict:
    """
    Main weather function called by GET /api/farms/{id}/weather/

    FIX: removed double pig_comfort evaluation that existed in previous version.
    Previous version called evaluate_farm_pig_comfort() twice — once before
    temp_c was rounded (result discarded) and again inside a try block.
    Now called exactly once, after temp_c is fully parsed and rounded.
    """
    data = get_weather_data()

    if "error" in data:
        return {
            "error":            data["error"],
            "temperature_c":    None,
            "temperature_f":    None,
            "humidity_percent": None,
            "precipitation_mm": None,
            "wind_speed_kph":   None,
            "condition":        "Unavailable",
            "alerts":           [],
            "alert_count":      0,
            "pig_comfort":      None,
        }

    current   = data.get("current", {})
    # Parse and round temp_c FIRST before using it anywhere
    temp_c    = round(float(current.get("temperature_2m", 25.0)), 1)
    temp_f    = _celsius_to_fahrenheit(temp_c)
    humidity  = round(float(current.get("relative_humidity_2m", 70.0)), 1)
    precip    = round(float(current.get("precipitation",         0.0)), 1)
    wind      = round(float(current.get("wind_speed_10m",         0.0)), 1)
    wcode     = int(current.get("weather_code", 0))
    condition = _decode_weather_code(wcode)

    # Evaluate pig comfort ONCE using the fully parsed temp_c
    pig_comfort = None
    if farm is not None:
        try:
            pig_comfort = evaluate_farm_pig_comfort(farm, temp_c)
        except Exception:
            pig_comfort = None

    # Build alerts using pig_comfort (already evaluated above)
    alerts = []

    if temp_c >= 35:
        alerts.append({
            "type":    "critical",
            "title":   "Dangerous heat — immediate action required",
            "message": (
                f"Temperature is {temp_c}°C ({temp_f}°F). "
                "Exceeds the upper limit of all pig comfort zones. "
                "Activate cooling systems immediately."
            ),
        })
    elif pig_comfort and pig_comfort.get("has_heat_stress"):
        alerts.append({
            "type":    "warning",
            "title":   "Heat stress risk",
            "message": (
                f"Temperature is {temp_c}°C ({temp_f}°F). "
                f"{pig_comfort['pig_comfort_summary']}"
            ),
        })

    if temp_c < 15:
        alerts.append({
            "type":    "warning",
            "title":   "Cold stress risk",
            "message": (
                f"Temperature is {temp_c}°C ({temp_f}°F). "
                "Below comfort range for all pig groups. "
                "Provide supplemental heating and extra bedding."
            ),
        })
    elif pig_comfort and pig_comfort.get("has_cold_stress"):
        alerts.append({
            "type":    "info",
            "title":   "Cold stress risk for some pig groups",
            "message": pig_comfort["pig_comfort_summary"],
        })

    if humidity >= 85:
        alerts.append({
            "type":    "warning",
            "title":   "High humidity",
            "message": (
                f"Humidity at {humidity}%. "
                "High humidity amplifies heat stress. Improve ventilation."
            ),
        })

    if precip > 5:
        alerts.append({
            "type":    "info",
            "title":   "Heavy rain",
            "message": (
                f"Rainfall: {precip}mm. "
                "Ensure pens have proper drainage and bedding stays dry."
            ),
        })

    return {
        "temperature_c":    temp_c,
        "temperature_f":    temp_f,
        "humidity_percent": humidity,
        "precipitation_mm": precip,
        "wind_speed_kph":   wind,
        "condition":        condition,
        "alerts":           alerts,
        "alert_count":      len(alerts),
        "pig_comfort":      pig_comfort,
    }


def _decode_weather_code(code: int) -> str:
    if code == 0:              return "Clear Sky"
    elif code == 1:            return "Mainly Clear"
    elif code == 2:            return "Partly Cloudy"
    elif code == 3:            return "Overcast"
    elif code in (45, 48):     return "Foggy"
    elif code in (51, 53, 55): return "Drizzle"
    elif code in (61, 63, 65): return "Rain"
    elif code in (71, 73, 75): return "Snow"
    elif code in (80, 81, 82): return "Rain Showers"
    elif code in (95, 96, 99): return "Thunderstorm"
    else:                      return "Partly Cloudy"