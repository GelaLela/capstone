"""
backend/piggery/services/weather_intelligence.py

Pig-specific weather risk engine.

Temperature standards are based on:
  - Philippine Bureau of Animal Industry (BAI) Swine Production Manual
  - NRC (National Research Council) Nutrient Requirements of Swine
  - University of Minnesota Extension Swine Thermoregulation Guide

Every function output feeds into:
  - weather endpoint (/api/farms/{id}/weather/)
  - dashboard weather card
  - notification generation
  - analytics Weather tab
  - prediction_engine health risk boost
  - admin stats (farms under stress)
"""

from datetime import date


# ─────────────────────────────────────────────────────────────────────────────
# COMFORT ZONE REFERENCE TABLE
# ─────────────────────────────────────────────────────────────────────────────

# Lower Critical Temperature (LCT): below this = cold stress
# Upper Critical Temperature (UCT): above this = heat stress
# Thermoneutral Zone (TNZ): LCT to UCT = comfortable

STAGE_COMFORT = {
    "piglet": {
        "label":          "Newborn / Piglet",
        "tnz_low":        30.0,   # °C
        "tnz_high":       35.0,
        "cold_warn":      26.0,   # still warm but declining
        "cold_critical":  22.0,   # hypothermia risk
        "heat_warn":      35.0,   # above TNZ
        "heat_critical":  38.0,   # severe heat stress
        "cold_risks":     ["Hypothermia", "Increased mortality", "Reduced growth"],
        "heat_risks":     ["Dehydration", "Respiratory distress"],
    },
    "weaner": {
        "label":          "Weaner (3–8 weeks)",
        "tnz_low":        21.0,
        "tnz_high":       28.0,
        "cold_warn":      18.0,
        "cold_critical":  14.0,
        "heat_warn":      29.0,
        "heat_critical":  35.0,
        "cold_risks":     ["Cold stress", "Reduced feed efficiency", "Pneumonia risk"],
        "heat_risks":     ["Reduced feed intake", "Dehydration"],
    },
    "grower": {
        "label":          "Grower (2–4 months)",
        "tnz_low":        18.0,
        "tnz_high":       22.0,
        "cold_warn":      14.0,
        "cold_critical":  10.0,
        "heat_warn":      27.0,
        "heat_critical":  35.0,
        "cold_risks":     ["Reduced growth rate", "Increased feed for warmth"],
        "heat_risks":     ["Heat stress", "Reduced ADG", "Reduced feed intake"],
    },
    "finisher": {
        "label":          "Finisher (5–6 months)",
        "tnz_low":        18.0,
        "tnz_high":       22.0,
        "cold_warn":      12.0,
        "cold_critical":  8.0,
        "heat_warn":      27.0,
        "heat_critical":  35.0,
        "cold_risks":     ["Reduced weight gain", "Increased feed cost"],
        "heat_risks":     ["Severe heat stress", "Reduced feed intake", "Slower market weight"],
    },
    "breeder": {
        "label":          "Breeder Sow / Boar",
        "tnz_low":        15.0,
        "tnz_high":       21.0,
        "cold_warn":      10.0,
        "cold_critical":  5.0,
        "heat_warn":      27.0,
        "heat_critical":  35.0,
        "cold_risks":     ["Cold stress", "Reduced feed efficiency"],
        "heat_risks":     ["Reduced reproductive performance", "Reduced conception rate",
                           "Summer infertility in boars"],
    },
}

# Humidity thresholds — high humidity amplifies heat stress
HUMIDITY_WARN     = 70   # %
HUMIDITY_HIGH     = 85   # % — significant amplifier
HUMIDITY_CRITICAL = 95   # % — dangerous with any heat

# Heat index correction: adds effective temperature when humidity is high
def _humidity_correction(temp_c, humidity_pct):
    """
    Simplified heat index adjustment.
    Above 70% humidity, perceived temperature is higher than actual.
    Returns effective_temp_c (felt temperature for risk calculation).
    """
    if temp_c < 20 or humidity_pct < 70:
        return temp_c  # humidity only matters during heat
    # Simplified Steadman formula approximation
    excess_hum = (humidity_pct - 70) / 100
    correction = round(excess_hum * 4.0, 1)  # max +4°C at 100% humidity
    return temp_c + correction


# ─────────────────────────────────────────────────────────────────────────────
# Stage-level risk evaluation
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_stage_risk(stage, temp_c, humidity_pct):
    """
    Evaluate weather risk for one pig growth stage.

    Returns:
      {
        stage:         str
        label:         str
        status:        "comfortable" | "mild_warning" | "warning" | "high_risk" | "critical"
        type:          "normal" | "cold" | "heat"
        tnz_low:       float
        tnz_high:      float
        effective_temp:float   (humidity-corrected temp for heat calculations)
        risks:         list[str]
        recommendation:str
      }
    """
    cfg          = STAGE_COMFORT.get(stage, STAGE_COMFORT["grower"])
    eff_temp     = _humidity_correction(temp_c, humidity_pct)

    # ── Cold evaluation (uses actual temp, not heat-index adjusted) ──────────
    if temp_c < cfg["cold_critical"]:
        status = "critical"
        r_type = "cold"
        risks  = cfg["cold_risks"]
        rec    = _cold_recommendation(stage, "critical")
    elif temp_c < cfg["cold_warn"]:
        status = "warning"
        r_type = "cold"
        risks  = cfg["cold_risks"]
        rec    = _cold_recommendation(stage, "warning")

    # ── Heat evaluation (uses humidity-corrected effective temp) ─────────────
    elif eff_temp >= cfg["heat_critical"]:
        status = "critical"
        r_type = "heat"
        risks  = cfg["heat_risks"]
        rec    = _heat_recommendation(stage, "critical", humidity_pct)
    elif eff_temp >= cfg["heat_warn"]:
        if humidity_pct >= HUMIDITY_HIGH:
            status = "high_risk"  # heat + high humidity = escalate
        else:
            status = "warning"
        r_type = "heat"
        risks  = cfg["heat_risks"]
        rec    = _heat_recommendation(stage, status, humidity_pct)
    elif eff_temp >= cfg["tnz_high"]:
        status = "mild_warning"
        r_type = "heat"
        risks  = ["Slight discomfort above thermoneutral zone"]
        rec    = f"Monitor {cfg['label']} for signs of heat discomfort. Ensure water is available."

    # ── Within thermoneutral zone ────────────────────────────────────────────
    else:
        status = "comfortable"
        r_type = "normal"
        risks  = []
        rec    = f"{cfg['label']} are within the optimal temperature range."

    return {
        "stage":          stage,
        "label":          cfg["label"],
        "status":         status,
        "type":           r_type,
        "tnz_low":        cfg["tnz_low"],
        "tnz_high":       cfg["tnz_high"],
        "effective_temp": eff_temp,
        "risks":          risks,
        "recommendation": rec,
    }


def _cold_recommendation(stage, level):
    if level == "critical":
        recs = {
            "piglet":   "CRITICAL: Piglets at hypothermia risk. Provide heat lamps immediately. Target 32–35°C in farrowing area.",
            "weaner":   "CRITICAL: Weaners at cold stress risk. Provide supplemental heating. Target 21–28°C.",
            "grower":   "Growers below critical temperature. Add deep bedding and block drafts.",
            "finisher": "Finishers below critical temperature. Add bedding and reduce ventilation.",
            "breeder":  "Breeders at cold stress risk. Provide additional bedding and close drafts.",
        }
    else:
        recs = {
            "piglet":   "Piglets below optimal range. Check heat lamp function. Monitor for huddling behavior.",
            "weaner":   "Weaners below comfort zone. Provide additional bedding or supplemental heat.",
            "grower":   "Growers below comfort zone. Add bedding and reduce air movement.",
            "finisher": "Finishers below comfort zone. Add bedding and reduce ventilation.",
            "breeder":  "Breeders below comfort zone. Provide extra bedding and block drafts.",
        }
    return recs.get(stage, "Provide supplemental heating and block drafts.")


def _heat_recommendation(stage, level, humidity):
    hum_note = " High humidity is amplifying heat stress." if humidity >= HUMIDITY_HIGH else ""
    if level == "critical":
        recs = {
            "piglet":   f"CRITICAL: Piglets at extreme heat risk. Immediately cool farrowing area with fans and misting.{hum_note}",
            "weaner":   f"CRITICAL: Weaners at heat stress risk. Activate cooling systems and provide cool water.{hum_note}",
            "grower":   f"CRITICAL: Growers may die without cooling. Activate sprinklers, maximize ventilation.{hum_note}",
            "finisher": f"CRITICAL: Finishers at severe heat stress. Cool pens immediately. Reduce feeding to cool hours.{hum_note}",
            "breeder":  f"CRITICAL: Breeders under severe heat stress. Boar fertility severely affected. Cool all pens.{hum_note}",
        }
    else:
        recs = {
            "piglet":   f"Piglets above comfort zone. Increase ventilation and provide fresh cool water.{hum_note}",
            "weaner":   f"Weaners in heat stress range. Increase airflow and hydration.{hum_note}",
            "grower":   f"Growers in heat stress range. Adjust feeding to cooler parts of the day. Increase water supply.{hum_note}",
            "finisher": f"Finishers in heat stress range. Feed during cooler morning/evening hours. Increase water.{hum_note}",
            "breeder":  f"Breeders in heat stress range. Reduced reproductive performance expected. Reduce mating during peak heat.{hum_note}",
        }
    return recs.get(stage, "Implement cooling measures and increase water supply.")


# ─────────────────────────────────────────────────────────────────────────────
# Farm-level risk evaluation
# ─────────────────────────────────────────────────────────────────────────────

STATUS_RANK = {"comfortable": 0, "mild_warning": 1, "warning": 2, "high_risk": 3, "critical": 4}
STATUS_LABEL = {
    "comfortable":  "Comfortable",
    "mild_warning": "Mild Risk",
    "warning":      "Warning",
    "high_risk":    "High Risk",
    "critical":     "Critical",
}
STATUS_COLOR = {
    "comfortable":  "healthy",
    "mild_warning": "amber",
    "warning":      "warning",
    "high_risk":    "danger",
    "critical":     "danger",
}


def evaluate_farm_weather_risk(farm, temp_c, humidity_pct):
    """
    Evaluate weather risk for the entire farm based on actual pig population.

    For each growth stage present on the farm, computes the risk level.
    Returns the worst-case stage and a per-stage breakdown.

    Returns:
      {
        overall_status:      str   (worst case across all stages)
        overall_label:       str
        overall_color:       str
        effective_temp:      float
        humidity_note:       str | None
        stage_risks:         list[dict]   (one per stage present on farm)
        pig_comfort_summary: str
        notifications:       list[dict]  (weather notifications to create)
      }
    """
    effective_temp = _humidity_correction(temp_c, humidity_pct)

    # Count pigs per stage on this farm
    stage_counts = {}
    for pig in farm.pigs.exclude(health_status="deceased"):
        s = pig.growth_stage
        stage_counts[s] = stage_counts.get(s, 0) + 1

    stage_risks  = []
    worst_rank   = 0
    worst_status = "comfortable"

    for stage, count in stage_counts.items():
        risk = evaluate_stage_risk(stage, temp_c, humidity_pct)
        risk["pig_count"] = count
        stage_risks.append(risk)
        rank = STATUS_RANK.get(risk["status"], 0)
        if rank > worst_rank:
            worst_rank   = rank
            worst_status = risk["status"]

    # Sort by severity (worst first)
    stage_risks.sort(key=lambda x: STATUS_RANK.get(x["status"], 0), reverse=True)

    # Humidity note
    hum_note = None
    if humidity_pct >= HUMIDITY_CRITICAL:
        hum_note = f"Humidity at {humidity_pct}% is critically high — dramatically amplifying heat stress."
    elif humidity_pct >= HUMIDITY_HIGH:
        hum_note = f"Humidity at {humidity_pct}% is amplifying heat stress risk."
    elif humidity_pct >= HUMIDITY_WARN:
        hum_note = f"Humidity at {humidity_pct}% may increase discomfort in hot conditions."

    # Pig comfort summary sentence
    if worst_status == "comfortable":
        summary = "All pigs are within their optimal temperature range."
    elif worst_status == "mild_warning":
        summary = "Conditions are slightly outside optimal range for some pigs."
    else:
        affected = [r["label"] for r in stage_risks if STATUS_RANK.get(r["status"], 0) >= STATUS_RANK.get("warning", 2)]
        summary  = f"Temperature risk detected for: {', '.join(affected)}."
        if hum_note:
            summary += f" {hum_note}"

    # Build notifications to create
    notifications = _build_weather_notifications(stage_risks, temp_c, humidity_pct, effective_temp)

    return {
        "overall_status":       worst_status,
        "overall_label":        STATUS_LABEL.get(worst_status, "Unknown"),
        "overall_color":        STATUS_COLOR.get(worst_status, "warning"),
        "temperature_c":        temp_c,
        "effective_temp":       effective_temp,
        "humidity_pct":         humidity_pct,
        "humidity_note":        hum_note,
        "stage_risks":          stage_risks,
        "pig_comfort_summary":  summary,
        "notifications":        notifications,
    }


def _build_weather_notifications(stage_risks, temp_c, humidity_pct, eff_temp):
    """
    Build notification dicts for creation when weather becomes unsafe.
    Only generates notifications for warning-level and above.
    """
    notifs = []
    for risk in stage_risks:
        if STATUS_RANK.get(risk["status"], 0) < STATUS_RANK["warning"]:
            continue
        prefix = {
            "critical":  "CRITICAL: ",
            "high_risk": "HIGH RISK: ",
            "warning":   "WARNING: ",
        }.get(risk["status"], "")

        if risk["type"] == "heat":
            title = f"{prefix}Heat stress — {risk['label']}"
            msg   = (
                f"Temperature is {temp_c}°C"
                + (f" (feels like {eff_temp}°C with humidity)" if eff_temp > temp_c else "")
                + f". {risk['recommendation']}"
            )
        else:
            title = f"{prefix}Cold stress — {risk['label']}"
            msg   = f"Temperature is {temp_c}°C. {risk['recommendation']}"

        notifs.append({
            "title":   title,
            "message": msg,
            "status":  risk["status"],
        })
    return notifs


# ─────────────────────────────────────────────────────────────────────────────
# Weather-to-analytics adjustments
# ─────────────────────────────────────────────────────────────────────────────

def weather_adg_adjustment(stage, temp_c, humidity_pct):
    """
    Returns an ADG multiplier for growth forecasting.
    Heat/cold stress reduces projected growth performance.

    Multipliers:
      comfortable:  1.0  (no adjustment)
      mild_warning: 0.97 (−3%)
      warning:      0.92 (−8%)
      high_risk:    0.85 (−15%)
      critical:     0.70 (−30%)
    """
    risk = evaluate_stage_risk(stage, temp_c, humidity_pct)
    return {
        "comfortable":  1.0,
        "mild_warning": 0.97,
        "warning":      0.92,
        "high_risk":    0.85,
        "critical":     0.70,
    }.get(risk["status"], 1.0)


def weather_health_risk_boost(temp_c, humidity_pct):
    """
    Returns additional points for farm_health_risk_score() when weather is adverse.
    Integrates into health_intelligence.farm_health_risk_score().

    Heat critical + high humidity:  +20 pts
    Heat high_risk:                 +12 pts
    Heat warning:                   +6 pts
    Cold critical (piglets):        +15 pts
    Cold warning:                   +5 pts
    Comfortable:                    0 pts
    """
    eff = _humidity_correction(temp_c, humidity_pct)
    pts = 0
    reasons = []

    if eff >= 35:
        pts += 20
        reasons.append(f"Dangerous heat detected ({temp_c}°C, {humidity_pct}% humidity) — critical risk (+20 pts)")
    elif eff >= 27:
        if humidity_pct >= HUMIDITY_HIGH:
            pts += 12
            reasons.append(f"Heat stress with high humidity ({temp_c}°C / {humidity_pct}%) (+12 pts)")
        else:
            pts += 6
            reasons.append(f"Heat stress warning ({temp_c}°C) (+6 pts)")

    if temp_c < 22:
        pts += 15
        reasons.append(f"Temperature {temp_c}°C — piglets at cold stress risk (+15 pts)")
    elif temp_c < 26:
        pts += 5
        reasons.append(f"Temperature {temp_c}°C — cold warning for piglets (+5 pts)")

    return {"extra_points": pts, "reasons": reasons}


def weather_breeding_confidence(temp_c, humidity_pct):
    """
    Returns a confidence note for breeding forecasts when conditions are poor.
    """
    eff = _humidity_correction(temp_c, humidity_pct)
    if eff >= 35:
        return "Low — extreme heat severely reduces reproductive performance. Conception rates reduced."
    elif eff >= 27:
        return "Reduced — heat stress may lower conception rates. Schedule breeding during cooler hours."
    elif temp_c < 10:
        return "Reduced — cold stress may affect reproductive performance."
    return None