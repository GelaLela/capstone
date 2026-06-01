"""
piggery/analytics/breeding.py
==============================
Breeding KPI calculations for Piglytics.

All formulas are documented with their source so they are auditable
and replaceable as the data matures.

CRITICAL FORMULA FIX (Phase 1):
  Old (wrong):  farrowed / total_records
  Correct:      farrowed / (farrowed + failed + open)

  The old formula deflated the success rate when there were many
  in-progress records (bred, pregnant) that had not yet concluded.
"""
from datetime import date, timedelta


# ─── Breed benchmark reference values ────────────────────────────────────────
# Source: Philippine Swine Industry benchmarks (PSA / BAI)
BREED_BENCHMARKS = {
    "landrace":      {"avg_litter_size": 10.5, "avg_weaned": 9.0},
    "large white":   {"avg_litter_size": 11.0, "avg_weaned": 9.5},
    "duroc":         {"avg_litter_size": 9.5,  "avg_weaned": 8.5},
    "crossbred":     {"avg_litter_size": 10.0, "avg_weaned": 8.8},
    "default":       {"avg_litter_size": 10.0, "avg_weaned": 8.5},
}

# Minimum records needed before live data is trusted over baseline
MIN_RECORDS_FOR_LIVE_ANALYTICS = 3


def get_pregnancy_success_rate(farm, use_baseline_fallback=True):
    """
    CORRECTED formula:
      success_rate = farrowed / (farrowed + failed + open)

    Only concluded outcomes are counted. In-progress records
    (bred, pregnant) are excluded — they haven't concluded yet.

    Returns dict:
      {
        "rate": float (0.0–1.0),
        "farrowed": int,
        "failed": int,
        "open": int,
        "total_concluded": int,
        "data_source": "live" | "baseline",
        "confidence": "high" | "low",
      }
    """
    from ..models import BreedingRecord, FarmBaseline

    concluded = BreedingRecord.objects.filter(
        sow__farm=farm,
        pregnancy_status__in=["farrowed", "failed", "open"],
    )
    farrowed = concluded.filter(pregnancy_status="farrowed").count()
    failed   = concluded.filter(pregnancy_status="failed").count()
    open_    = concluded.filter(pregnancy_status="open").count()
    total    = farrowed + failed + open_

    if total >= MIN_RECORDS_FOR_LIVE_ANALYTICS:
        rate = farrowed / total if total > 0 else 0.0
        return {
            "rate": round(rate, 4),
            "farrowed": farrowed,
            "failed": failed,
            "open": open_,
            "total_concluded": total,
            "data_source": "live",
            "confidence": "high" if total >= 10 else "low",
        }

    # Fallback to baseline if live data is insufficient
    if use_baseline_fallback:
        try:
            baseline = farm.baseline
            if baseline.onboarding_completed and baseline.historical_farrowings_12m > 0:
                total_b   = baseline.historical_farrowings_12m + baseline.historical_failed_breedings_12m
                rate_b    = baseline.historical_farrowings_12m / total_b if total_b > 0 else 0.0
                return {
                    "rate": round(rate_b, 4),
                    "farrowed": baseline.historical_farrowings_12m,
                    "failed": baseline.historical_failed_breedings_12m,
                    "open": 0,
                    "total_concluded": total_b,
                    "data_source": "baseline",
                    "confidence": "low",
                }
        except Exception:
            pass

    return {
        "rate": None,
        "farrowed": farrowed,
        "failed": failed,
        "open": open_,
        "total_concluded": total,
        "data_source": "insufficient",
        "confidence": "none",
    }


def get_avg_litter_size(farm, use_baseline_fallback=True):
    """
    Average piglets born alive across all farrowed records.

    Returns dict:
      {
        "avg_litter_size": float | None,
        "avg_weaned": float | None,
        "piglet_survival_rate": float | None,   # weaned / born_alive
        "sample_size": int,
        "data_source": "live" | "baseline",
        "confidence": "high" | "low" | "none",
      }
    """
    from ..models import BreedingRecord
    from django.db.models import Avg

    farrowed_qs = BreedingRecord.objects.filter(
        sow__farm=farm,
        pregnancy_status="farrowed",
        piglets_born_alive__isnull=False,
    )
    count = farrowed_qs.count()

    if count >= MIN_RECORDS_FOR_LIVE_ANALYTICS:
        agg = farrowed_qs.aggregate(
            avg_born=Avg("piglets_born_alive"),
            avg_weaned=Avg("piglets_weaned"),
        )
        avg_born   = round(float(agg["avg_born"]), 2) if agg["avg_born"] else None
        avg_weaned = round(float(agg["avg_weaned"]), 2) if agg["avg_weaned"] else None
        survival   = round(avg_weaned / avg_born, 4) if avg_born and avg_weaned and avg_born > 0 else None
        return {
            "avg_litter_size": avg_born,
            "avg_weaned": avg_weaned,
            "piglet_survival_rate": survival,
            "sample_size": count,
            "data_source": "live",
            "confidence": "high" if count >= 10 else "low",
        }

    if use_baseline_fallback:
        try:
            baseline = farm.baseline
            if baseline.onboarding_completed and baseline.historical_avg_litter_size:
                avg_born   = float(baseline.historical_avg_litter_size)
                avg_weaned = float(baseline.historical_avg_weaned) if baseline.historical_avg_weaned else None
                survival   = round(avg_weaned / avg_born, 4) if avg_weaned and avg_born > 0 else None
                return {
                    "avg_litter_size": avg_born,
                    "avg_weaned": avg_weaned,
                    "piglet_survival_rate": survival,
                    "sample_size": count,
                    "data_source": "baseline",
                    "confidence": "low",
                }
        except Exception:
            pass

    return {
        "avg_litter_size": None,
        "avg_weaned": None,
        "piglet_survival_rate": None,
        "sample_size": count,
        "data_source": "insufficient",
        "confidence": "none",
    }


def get_sow_performance_ranking(farm, top_n=5):
    """
    Ranks sows by composite performance score:
      score = (avg_litter_size * 0.4) + (avg_weaned * 0.4) + (success_rate * 10 * 0.2)

    Returns a list of dicts ordered best → worst.
    """
    from ..models import Pig, BreedingRecord
    from django.db.models import Avg, Count, Q

    sows = Pig.objects.filter(farm=farm, gender="female", is_active=True, growth_stage="breeder")
    ranking = []

    for sow in sows:
        records = BreedingRecord.objects.filter(sow=sow)
        concluded = records.filter(pregnancy_status__in=["farrowed", "failed", "open"])
        farrowed_qs = records.filter(pregnancy_status="farrowed", piglets_born_alive__isnull=False)

        concluded_count = concluded.count()
        farrowed_count  = farrowed_qs.count()

        if concluded_count == 0:
            continue

        success_rate = farrowed_count / concluded_count
        agg = farrowed_qs.aggregate(
            avg_born=Avg("piglets_born_alive"),
            avg_weaned=Avg("piglets_weaned"),
        )
        avg_born   = float(agg["avg_born"]) if agg["avg_born"] else 0
        avg_weaned = float(agg["avg_weaned"]) if agg["avg_weaned"] else 0
        score      = (avg_born * 0.4) + (avg_weaned * 0.4) + (success_rate * 10 * 0.2)

        ranking.append({
            "sow_id":       sow.id,
            "sow_pig_id":   sow.pig_id,
            "sow_name":     sow.name,
            "litters":      farrowed_count,
            "avg_born":     round(avg_born, 1),
            "avg_weaned":   round(avg_weaned, 1),
            "success_rate": round(success_rate * 100, 1),
            "score":        round(score, 2),
        })

    ranking.sort(key=lambda x: x["score"], reverse=True)
    return ranking[:top_n]


def get_upcoming_farrowings(farm, days_ahead=14):
    """
    Returns breeding records where farrowing is expected within `days_ahead` days.
    Used for the dashboard Forecast Alert section.
    """
    from ..models import BreedingRecord
    today = date.today()
    cutoff = today + timedelta(days=days_ahead)

    records = BreedingRecord.objects.filter(
        sow__farm=farm,
        pregnancy_status="pregnant",
        expected_farrowing_date__lte=cutoff,
        expected_farrowing_date__gte=today,
    ).select_related("sow").order_by("expected_farrowing_date")

    return [
        {
            "sow_name":              r.sow.name,
            "sow_pig_id":            r.sow.pig_id,
            "expected_farrowing":    str(r.expected_farrowing_date),
            "days_until_farrowing":  (r.expected_farrowing_date - today).days,
            "breeding_date":         str(r.breeding_date),
            "litter_number":         r.litter_number,
        }
        for r in records
    ]


def get_breeding_score(farm):
    """
    Composite breeding performance score (0–100).

    Weighted from 3 sub-scores:
      - Pregnancy success rate (0–100): weight 40%
      - Avg litter size vs benchmark (0–100): weight 40%
      - Piglet survival rate (0–100): weight 20%

    Returns: float | None
    """
    success_data = get_pregnancy_success_rate(farm)
    litter_data  = get_avg_litter_size(farm)
    benchmark    = BREED_BENCHMARKS["default"]

    if success_data["rate"] is None:
        return None

    # Sub-score 1: success rate (already 0–1, scale to 0–100)
    s1 = success_data["rate"] * 100

    # Sub-score 2: litter size vs benchmark (cap at 100)
    if litter_data["avg_litter_size"]:
        s2 = min((litter_data["avg_litter_size"] / benchmark["avg_litter_size"]) * 100, 100)
    else:
        s2 = None

    # Sub-score 3: survival rate (already 0–1, scale to 0–100)
    s3 = litter_data["piglet_survival_rate"] * 100 if litter_data["piglet_survival_rate"] else None

    # Weighted composite — skip sub-scores with no data
    numerator   = s1 * 0.4
    denominator = 0.4
    if s2 is not None:
        numerator   += s2 * 0.4
        denominator += 0.4
    if s3 is not None:
        numerator   += s3 * 0.2
        denominator += 0.2

    score = numerator / denominator if denominator > 0 else None
    return round(score, 2) if score is not None else None
