"""
backend/piggery/services/growth_intelligence.py

Complete swine growth intelligence engine.

Weight ranges are based on industry-standard Philippine swine production references:
  - Bureau of Animal Industry (BAI) Philippine Swine Industry Guidelines
  - Livestock Development Council (LDC) Swine Production Manual
  - NRC Nutrient Requirements of Swine

Every function here produces output that feeds directly into:
  - growth_analytics()  → Analytics tab
  - prediction_engine() → Forecast tab
  - Dashboard KPIs
  - Alerts and notifications
"""

from datetime import date, timedelta


# ─────────────────────────────────────────────────────────────────────────────
# WEIGHT REFERENCE TABLE
# ─────────────────────────────────────────────────────────────────────────────

# Stage-level weight ranges (kg).
# min_wt / max_wt define the healthy compliance band.
# ideal_adg = Average Daily Gain benchmark in kg/day.
STAGE_WEIGHT_RANGES = {
    "piglet": {
        "label":       "Newborn / Piglet",
        "min_wt":      1.0,
        "max_wt":      25.0,
        "ideal_adg":   0.25,
        "age_min_days": 0,
        "age_max_days": 56,    # 0–8 weeks
    },
    "weaner": {
        "label":       "Weaner",
        "min_wt":      6.0,
        "max_wt":      25.0,
        "ideal_adg":   0.40,
        "age_min_days": 21,    # 3 weeks
        "age_max_days": 84,    # 12 weeks
    },
    "grower": {
        "label":       "Grower",
        "min_wt":      25.0,
        "max_wt":      65.0,
        "ideal_adg":   0.65,
        "age_min_days": 60,    # 2 months
        "age_max_days": 120,   # 4 months
    },
    "finisher": {
        "label":       "Finisher / Market",
        "min_wt":      65.0,
        "max_wt":      130.0,
        "ideal_adg":   0.85,
        "age_min_days": 120,   # 5 months
        "age_max_days": 200,   # ~6.5 months
    },
    "breeder": {
        "label":       "Breeder",
        "min_wt":      90.0,   # gilt at first service
        "max_wt":      320.0,  # mature sow/boar upper limit
        "ideal_adg":   0.20,
        "age_min_days": 180,
        "age_max_days": 9999,
    },
}

# Pregnant sow weight overlay (overrides stage when pregnancy_status=pregnant)
PREGNANT_SOW_RANGE = {"min_wt": 140.0, "max_wt": 260.0}

# Mature boar weight range
MATURE_BOAR_RANGE = {"min_wt": 200.0, "max_wt": 320.0}

# Market target
MARKET_WEIGHT_KG = 90.0
MARKET_OVERWEIGHT = 130.0


# ─────────────────────────────────────────────────────────────────────────────
# BREED WEIGHT BENCHMARKS (mature adult weight, by sex)
# ─────────────────────────────────────────────────────────────────────────────

BREED_BENCHMARKS = {
    "Large White": {
        "male":   {"min": 300, "max": 350, "label": "Large White / Yorkshire Male"},
        "female": {"min": 250, "max": 300, "label": "Large White / Yorkshire Female"},
    },
    "Landrace": {
        "male":   {"min": 300, "max": 400, "label": "Landrace Male"},
        "female": {"min": 250, "max": 320, "label": "Landrace Female"},
    },
    "Duroc": {
        "male":   {"min": 250, "max": 300, "label": "Duroc Male"},
        "female": {"min": 180, "max": 250, "label": "Duroc Female"},
    },
    "Philippine Native": {
        "male":   {"min": 70,  "max": 120, "label": "Philippine Native Male"},
        "female": {"min": 60,  "max": 100, "label": "Philippine Native Female"},
    },
    "Crossbreed": {
        "male":   {"min": 200, "max": 300, "label": "Crossbreed Male"},
        "female": {"min": 160, "max": 260, "label": "Crossbreed Female"},
    },
}

# Default when breed not recognized
BREED_BENCHMARKS_DEFAULT = {
    "male":   {"min": 200, "max": 320},
    "female": {"min": 150, "max": 280},
}


# ─────────────────────────────────────────────────────────────────────────────
# ADG ALERT THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────

ADG_SLOW_THRESHOLD_PCT    = 60   # below 60% of benchmark = slow growth alert
ADG_FAST_THRESHOLD_PCT    = 140  # above 140% of benchmark = unusually rapid growth
WEIGHT_COMPLIANCE_LOW_PCT = 80   # below 80% of min_wt for stage = underweight alert
WEIGHT_COMPLIANCE_HIGH_PCT= 130  # above 130% of max_wt for stage = overweight alert


# ─────────────────────────────────────────────────────────────────────────────
# Core evaluation functions
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_weight(pig, weight_kg):
    """
    Evaluate a single weight reading against:
      1. Stage-level expected range
      2. Breed adult benchmark (for breeders)
      3. Pregnant sow overlay
      4. Mature boar overlay

    Returns a dict:
      {
        status:          "normal" | "underweight" | "overweight"
        severity:        "none" | "mild" | "moderate" | "severe"
        expected_min_kg: float
        expected_max_kg: float
        compliance_pct:  float   (0–100+)
        alert_message:   str | None
        recommendation:  str | None
        breed_note:      str | None
      }
    """
    stage   = pig.growth_stage
    gender  = pig.gender
    breed   = pig.breed
    age_d   = (date.today() - pig.date_of_birth).days
    w       = float(weight_kg)

    # Determine expected range for this pig right now
    exp_min, exp_max = _expected_range(pig, age_d, w)

    # Compliance calculation
    if w < exp_min:
        compliance_pct = round((w / exp_min) * 100, 1)
        deficit_pct    = round((1 - w / exp_min) * 100, 1)
        if deficit_pct >= 30:
            status, severity = "underweight", "severe"
        elif deficit_pct >= 15:
            status, severity = "underweight", "moderate"
        else:
            status, severity = "underweight", "mild"
        alert = (
            f"UNDERWEIGHT: {pig.name} weighs {w} kg. "
            f"Expected {exp_min}–{exp_max} kg for a {stage} {gender}. "
            f"Deficit: {deficit_pct}%."
        )
        rec = _underweight_recommendation(stage, gender, breed)
    elif w > exp_max * (WEIGHT_COMPLIANCE_HIGH_PCT / 100):
        compliance_pct = round((w / exp_max) * 100, 1)
        excess_pct     = round((w / exp_max - 1) * 100, 1)
        if excess_pct >= 40:
            status, severity = "overweight", "severe"
        elif excess_pct >= 20:
            status, severity = "overweight", "moderate"
        else:
            status, severity = "overweight", "mild"
        alert = (
            f"OVERWEIGHT: {pig.name} weighs {w} kg. "
            f"Expected {exp_min}–{exp_max} kg for a {stage} {gender}. "
            f"Excess: {excess_pct}%."
        )
        rec = _overweight_recommendation(stage, gender)
    else:
        compliance_pct = round(
            min(100, ((w - exp_min) / max(1, exp_max - exp_min)) * 100 + 50), 1
        )
        status, severity, alert, rec = "normal", "none", None, None

    # Breed benchmark note (for breeders only)
    breed_note = None
    if stage == "breeder":
        bb = BREED_BENCHMARKS.get(breed, BREED_BENCHMARKS_DEFAULT)
        bm = bb.get(gender, {})
        bm_min = bm.get("min", 0)
        bm_max = bm.get("max", 999)
        if w < bm_min:
            breed_note = (
                f"Below {breed} mature weight benchmark "
                f"({bm_min}–{bm_max} kg for {gender})."
            )
        elif w > bm_max:
            breed_note = (
                f"Above {breed} mature weight benchmark "
                f"({bm_min}–{bm_max} kg for {gender})."
            )

    return {
        "status":           status,
        "severity":         severity,
        "expected_min_kg":  exp_min,
        "expected_max_kg":  exp_max,
        "compliance_pct":   compliance_pct,
        "alert_message":    alert,
        "recommendation":   rec,
        "breed_note":       breed_note,
    }


def _expected_range(pig, age_days, weight_kg):
    """Return (min_kg, max_kg) for the pig given its stage, gender, and pregnancy status."""
    stage  = pig.growth_stage
    gender = pig.gender

    # Pregnant sow override
    is_pregnant = _is_pig_currently_pregnant(pig)
    if is_pregnant and gender == "female" and stage == "breeder":
        return PREGNANT_SOW_RANGE["min_wt"], PREGNANT_SOW_RANGE["max_wt"]

    # Mature boar override
    if gender == "male" and stage == "breeder":
        if age_days > 365:
            return MATURE_BOAR_RANGE["min_wt"], MATURE_BOAR_RANGE["max_wt"]

    r = STAGE_WEIGHT_RANGES.get(stage, STAGE_WEIGHT_RANGES["grower"])
    return r["min_wt"], r["max_wt"]


def _is_pig_currently_pregnant(pig):
    """Check if pig has an active pregnancy record."""
    try:
        return pig.breeding_records.filter(pregnancy_status="pregnant").exists()
    except Exception:
        return False


def _underweight_recommendation(stage, gender, breed):
    recs = {
        "piglet":   "Check nursing status and sow milk supply. Consider supplemental creep feeding.",
        "weaner":   "Increase starter feed quality. Check for internal parasites and disease.",
        "grower":   "Review feeding program. Ensure adequate protein (16–18% CP). Check for disease.",
        "finisher": "Increase energy density in feed. Check feed conversion ratio.",
        "breeder":  "Increase feed allowance. Assess body condition score (target BCS 3.0–3.5).",
    }
    return recs.get(stage, "Review feeding program and health status.")


def _overweight_recommendation(stage, gender):
    recs = {
        "breeder":  "Reduce feed allowance. Monitor body condition score (target BCS 3.0–3.5). "
                    "Excess weight in sows reduces fertility.",
        "finisher": "Check if market-ready. If above 125 kg, consider immediate sale.",
        "grower":   "Overweight growers may indicate excess energy feeding. Adjust ration.",
    }
    return recs.get(stage, "Review feeding rate. Check for unusual weight gain.")


# ─────────────────────────────────────────────────────────────────────────────
# ADG analysis for a single pig
# ─────────────────────────────────────────────────────────────────────────────

def compute_pig_adg(pig, weight_records):
    """
    Compute ADG from a list of weight records (SimpleNamespace or WeightRecord).
    Also evaluates whether growth is slow, normal, or unusually rapid.

    Returns dict or None if insufficient data.
    """
    if len(weight_records) < 2:
        return None

    first = weight_records[0]
    last  = weight_records[-1]
    days  = (last.recorded_at - first.recorded_at).days
    if days == 0:
        return None

    adg       = round(float(last.weight_kg - first.weight_kg) / days, 4)
    stage     = pig.growth_stage
    benchmark = STAGE_WEIGHT_RANGES.get(stage, {}).get("ideal_adg", 0.5)
    eff_pct   = round(min(180, (adg / benchmark) * 100), 1) if benchmark > 0 else 0

    # Determine ADG status
    if eff_pct < ADG_SLOW_THRESHOLD_PCT:
        adg_status   = "slow"
        adg_severity = "warning" if eff_pct < 40 else "notice"
        adg_alert    = (
            f"SLOW GROWTH: {pig.name} ADG {adg} kg/day is "
            f"{round(100 - eff_pct)}% below the {stage} benchmark ({benchmark} kg/day)."
        )
    elif eff_pct > ADG_FAST_THRESHOLD_PCT:
        adg_status   = "rapid"
        adg_severity = "notice"
        adg_alert    = (
            f"RAPID GROWTH: {pig.name} ADG {adg} kg/day is "
            f"{round(eff_pct - 100)}% above benchmark. "
            "Verify weight records and feeding rate."
        )
    else:
        adg_status, adg_severity, adg_alert = "normal", "none", None

    return {
        "adg_kg_per_day":      adg,
        "benchmark_kg_per_day":benchmark,
        "efficiency_pct":      eff_pct,
        "adg_status":          adg_status,
        "adg_severity":        adg_severity,
        "adg_alert":           adg_alert,
        "days_tracked":        days,
        "first_weight_kg":     float(first.weight_kg),
        "last_weight_kg":      float(last.weight_kg),
        "total_gain_kg":       round(float(last.weight_kg - first.weight_kg), 2),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Weight forecasting
# ─────────────────────────────────────────────────────────────────────────────

def forecast_weight(pig, weight_records):
    """
    Statistical weight forecast using linear regression over all available records.
    Falls back to benchmark ADG if insufficient data.

    Returns:
      {
        method:              "linear_regression" | "benchmark_adg" | "insufficient_data"
        current_weight_kg:   float
        adg_kg_per_day:      float
        forecast_30d_kg:     float
        forecast_60d_kg:     float
        market_ready_date:   str | None
        market_ready_days:   int | None
        breeding_ready_date: str | None  (gilts only)
        confidence:          "High" | "Medium" | "Low"
        stage:               str
        breed:               str
        expected_range_min:  float
        expected_range_max:  float
      }
    """
    today = date.today()
    stage = pig.growth_stage
    breed = pig.breed
    gender= pig.gender

    # Current weight — use most recent record
    current_wt = None
    if weight_records:
        current_wt = float(weight_records[-1].weight_kg)

    age_days = (today - pig.date_of_birth).days
    exp_min, exp_max = _expected_range(pig, age_days, current_wt or 0)

    # Determine ADG to use
    adg     = None
    method  = "insufficient_data"
    confidence = "Low"

    if len(weight_records) >= 3:
        # Linear regression over all weight records
        xs = [(r.recorded_at - weight_records[0].recorded_at).days for r in weight_records]
        ys = [float(r.weight_kg) for r in weight_records]
        n  = len(xs)
        sx = sum(xs);  sy = sum(ys)
        sx2= sum(x**2 for x in xs); sxy = sum(x*y for x, y in zip(xs, ys))
        denom = n * sx2 - sx**2
        if denom != 0:
            adg    = (n * sxy - sx * sy) / denom  # slope = kg/day
            method = "linear_regression"
            confidence = "High" if n >= 5 else "Medium"

    elif len(weight_records) >= 2:
        first = weight_records[0]
        last  = weight_records[-1]
        days  = (last.recorded_at - first.recorded_at).days
        if days > 0:
            adg    = float(last.weight_kg - first.weight_kg) / days
            method = "two_point"
            confidence = "Medium"

    if adg is None or adg <= 0:
        # Fall back to stage benchmark ADG
        adg    = STAGE_WEIGHT_RANGES.get(stage, {}).get("ideal_adg", 0.5)
        method = "benchmark_adg"
        confidence = "Low"

    adg = round(adg, 4)
    cw  = current_wt or (exp_min + exp_max) / 2

    f30 = round(cw + adg * 30,  2)
    f60 = round(cw + adg * 60,  2)

    # Market ready (finisher: target 90–95 kg)
    market_ready_date = None
    market_ready_days = None
    if stage in ("grower", "finisher") and cw < MARKET_WEIGHT_KG and adg > 0:
        d2m = round((MARKET_WEIGHT_KG - cw) / adg)
        market_ready_days = d2m
        market_ready_date = str(today + timedelta(days=d2m))

    # Breeding ready (gilt: target 110–135 kg at first service, 7–8 months age)
    breeding_ready_date = None
    GILT_BREEDING_WEIGHT = 110.0
    if gender == "female" and stage in ("grower", "finisher") and cw < GILT_BREEDING_WEIGHT and adg > 0:
        d2b = round((GILT_BREEDING_WEIGHT - cw) / adg)
        breeding_ready_date = str(today + timedelta(days=d2b))

    return {
        "method":              method,
        "current_weight_kg":   round(cw, 2),
        "adg_kg_per_day":      adg,
        "forecast_30d_kg":     f30,
        "forecast_60d_kg":     f60,
        "market_ready_date":   market_ready_date,
        "market_ready_days":   market_ready_days,
        "breeding_ready_date": breeding_ready_date,
        "confidence":          confidence,
        "stage":               stage,
        "breed":               breed,
        "expected_range_min":  exp_min,
        "expected_range_max":  exp_max,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Farm-level growth compliance report
# ─────────────────────────────────────────────────────────────────────────────

def farm_growth_compliance(farm):
    """
    Evaluate all pigs on the farm against weight standards.
    Returns:
      {
        total_evaluated: int
        compliant:       int
        underweight:     int
        overweight:      int
        compliance_pct:  float
        weight_alerts:   list[dict]
        breed_outliers:  list[dict]
        by_stage:        dict  (stage → {compliant, underweight, overweight, count})
      }
    """
    total  = 0
    ok     = 0
    under  = 0
    over   = 0
    alerts = []
    by_stage = {}

    for pig in farm.pigs.exclude(health_status="deceased"):
        records = list(pig.weight_records.order_by("-recorded_at"))
        if not records:
            continue

        latest_wt = float(records[0].weight_kg)
        result    = evaluate_weight(pig, latest_wt)
        total    += 1

        stage = pig.growth_stage
        if stage not in by_stage:
            by_stage[stage] = {"compliant": 0, "underweight": 0, "overweight": 0, "count": 0}
        by_stage[stage]["count"] += 1

        if result["status"] == "normal":
            ok += 1
            by_stage[stage]["compliant"] += 1
        elif result["status"] == "underweight":
            under += 1
            by_stage[stage]["underweight"] += 1
            if result["severity"] in ("moderate", "severe"):
                alerts.append({
                    "pig_name":       pig.name,
                    "pig_id":         pig.pig_id,
                    "stage":          stage,
                    "status":         "underweight",
                    "severity":       result["severity"],
                    "weight_kg":      latest_wt,
                    "expected_min":   result["expected_min_kg"],
                    "expected_max":   result["expected_max_kg"],
                    "message":        result["alert_message"],
                    "recommendation": result["recommendation"],
                })
        elif result["status"] == "overweight":
            over += 1
            by_stage[stage]["overweight"] += 1
            if result["severity"] in ("moderate", "severe"):
                alerts.append({
                    "pig_name":       pig.name,
                    "pig_id":         pig.pig_id,
                    "stage":          stage,
                    "status":         "overweight",
                    "severity":       result["severity"],
                    "weight_kg":      latest_wt,
                    "expected_min":   result["expected_min_kg"],
                    "expected_max":   result["expected_max_kg"],
                    "message":        result["alert_message"],
                    "recommendation": result["recommendation"],
                })

    compliance_pct = round(ok / total * 100, 1) if total > 0 else 0
    alerts.sort(key=lambda x: {"severe": 0, "moderate": 1, "mild": 2}.get(x["severity"], 3))

    return {
        "total_evaluated": total,
        "compliant":       ok,
        "underweight":     under,
        "overweight":      over,
        "compliance_pct":  compliance_pct,
        "weight_alerts":   alerts[:20],
        "by_stage":        by_stage,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Breed benchmark comparison (for the Growth tab)
# ─────────────────────────────────────────────────────────────────────────────

def breed_benchmark_comparison(farm):
    """
    For each breed on the farm, compare average current weight of adult pigs
    against breed standards.
    """
    from collections import defaultdict
    breed_data = defaultdict(lambda: {"weights": [], "breed": ""})

    for pig in farm.pigs.filter(growth_stage="breeder").exclude(health_status="deceased"):
        records = pig.weight_records.order_by("-recorded_at")
        if not records.exists():
            continue
        latest = float(records.first().weight_kg)
        key    = (pig.breed, pig.gender)
        breed_data[key]["weights"].append(latest)
        breed_data[key]["breed"]  = pig.breed
        breed_data[key]["gender"] = pig.gender

    results = []
    for (breed, gender), data in breed_data.items():
        if not data["weights"]:
            continue
        avg_wt = round(sum(data["weights"]) / len(data["weights"]), 1)
        bb     = BREED_BENCHMARKS.get(breed, BREED_BENCHMARKS_DEFAULT)
        bm     = bb.get(gender, {"min": 150, "max": 280})
        status = (
            "below_benchmark" if avg_wt < bm["min"]
            else "above_benchmark" if avg_wt > bm["max"]
            else "on_track"
        )
        results.append({
            "breed":          breed,
            "gender":         gender,
            "avg_weight_kg":  avg_wt,
            "count":          len(data["weights"]),
            "benchmark_min":  bm["min"],
            "benchmark_max":  bm["max"],
            "status":         status,
        })

    results.sort(key=lambda x: x["breed"])
    return results