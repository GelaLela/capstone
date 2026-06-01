"""
backend/piggery/services/analytics_services.py

COMPLETE analytics engine. Every KPI incorporates:
  - Live BreedingRecord rows
  - PigBaseline historical data (from onboarded existing sows)
  - FarmBaseline historical summary (from farm onboarding)

No data is discarded. Historical onboarding data affects every metric
immediately on the same call that the data is saved.
"""
from datetime import date, timedelta
from django.db.models import Sum, Count


# ─────────────────────────────────────────────────────────────────────────────
# Internal baseline helpers
# ─────────────────────────────────────────────────────────────────────────────

def _pig_baseline(pig):
    """Return (total_litters, total_piglets_born, total_piglets_weaned) from PigBaseline."""
    from ..models import PigBaseline
    try:
        b = PigBaseline.objects.get(pig=pig)
        return int(b.total_litters or 0), int(b.total_piglets_born or 0), int(b.total_piglets_weaned or 0)
    except PigBaseline.DoesNotExist:
        return 0, 0, 0


def _farm_baseline(farm):
    """Return FarmBaseline object or None."""
    from ..models import FarmBaseline
    try:
        return FarmBaseline.objects.get(farm=farm)
    except FarmBaseline.DoesNotExist:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Breeding analytics — fully baseline-aware
# ─────────────────────────────────────────────────────────────────────────────

def breeding_analytics(farm):
    """
    Every KPI combines live BreedingRecord rows + PigBaseline historical data.

    Formulas:
      pregnancy_success_rate = (pregnant_events + farrowed_events) / total_events × 100
      farrowing_success_rate = farrowed_events / (farrowed + failed) × 100
      avg_litter_size        = Σ(all alive births inc baseline) / Σ(all litters inc baseline)
      survival_rate          = alive / (alive + dead) × 100
      weaning_rate           = weaned / alive × 100

    Sow Productivity Score (0–100):
      score = (avg_litter_size / 10) × (survival_rate / 100) × 100

    Baseline integration:
      - total_events adds 1 "virtual farrowed" event per historical litter so that
        a sow with 5 historical litters contributes 5 successful outcomes to
        the farm-level success rates.
      - avg_litter_size uses weighted mean across both sources.
      - Sow ranking uses combined historic + live data per sow.
    """
    from ..models import BreedingRecord, Pig, PigBaseline

    today = date.today()

    # ── Live breeding records ─────────────────────────────────────────────────
    all_br      = BreedingRecord.objects.filter(sow__farm=farm)
    farrowed_br = all_br.filter(pregnancy_status="farrowed")
    pregnant_br = all_br.filter(pregnancy_status="pregnant")
    failed_br   = all_br.filter(pregnancy_status="failed")

    live_events   = all_br.count()
    live_litters  = farrowed_br.count()
    live_pregnant = pregnant_br.count()
    live_failed   = failed_br.count()

    live_alive  = sum(r.piglets_born_alive or 0 for r in farrowed_br)
    live_dead   = sum(r.piglets_born_dead  or 0 for r in farrowed_br)
    live_weaned = sum(r.piglets_weaned     or 0 for r in farrowed_br)

    # ── Aggregate PigBaseline across all sows on this farm ────────────────────
    bl_litters  = 0
    bl_alive    = 0
    bl_weaned   = 0
    sows = farm.pigs.filter(gender="female")
    for sow in sows:
        h_l, h_b, h_w = _pig_baseline(sow)
        bl_litters += h_l
        bl_alive   += h_b
        bl_weaned  += h_w

    # ── Farm-level baseline supplement ───────────────────────────────────────
    fb = _farm_baseline(farm)
    if fb and bl_litters == 0 and live_litters == 0:
        # Use farm-level baseline as last resort when no per-pig data exists
        bl_litters = int(fb.litters_last_12_months or 0)
        bl_alive   = round(float(fb.avg_litter_size_historical or 0) * bl_litters)

    # ── Combined totals ───────────────────────────────────────────────────────
    # For success rates: each baseline litter counts as 1 "farrowed" event
    total_events   = live_events + bl_litters
    total_litters  = live_litters + bl_litters
    total_pregnant = live_pregnant
    total_failed   = live_failed
    total_alive    = live_alive + bl_alive
    total_dead     = live_dead
    total_weaned   = live_weaned + bl_weaned
    total_born     = total_alive + total_dead

    pregnancy_success = round(
        (total_litters + total_pregnant) / total_events * 100, 1
    ) if total_events > 0 else 0

    farrowing_success = round(
        total_litters / (total_litters + total_failed) * 100, 1
    ) if (total_litters + total_failed) > 0 else 0

    avg_litter = round(total_alive / total_litters, 1) if total_litters > 0 else 0
    survival   = round(total_alive / total_born  * 100, 1) if total_born  > 0 else 0
    weaning    = round(total_weaned / total_alive * 100, 1) if total_alive > 0 else 0

    # ── Monthly litter trend (last 12 months, live records only) ─────────────
    twelve_ago = today - timedelta(days=365)
    monthly = {}
    for r in farrowed_br.filter(actual_farrowing_date__gte=twelve_ago):
        k = r.actual_farrowing_date.strftime("%b %Y")
        monthly[k] = monthly.get(k, 0) + 1

    # ── Sow ranking — each sow's score = live + baseline combined ────────────
    sow_ranking = []
    for sow in sows.filter(growth_stage="breeder"):
        sow_records  = farrowed_br.filter(sow=sow)
        rec_litters  = sow_records.count()
        h_l, h_b, h_w = _pig_baseline(sow)
        total_l = rec_litters + h_l
        if total_l == 0:
            continue

        rec_alive  = sum(r.piglets_born_alive or 0 for r in sow_records)
        rec_dead   = sum(r.piglets_born_dead  or 0 for r in sow_records)
        rec_weaned = sum(r.piglets_weaned     or 0 for r in sow_records)

        comb_alive  = rec_alive  + h_b
        comb_weaned = rec_weaned + h_w
        comb_born   = rec_alive  + rec_dead

        avg_al = round(comb_alive / total_l, 1)
        surv   = round(rec_alive / comb_born * 100, 1) if comb_born > 0 else 0
        score  = round((avg_al / 10) * (surv / 100) * 100, 1)

        last_farrow = None
        last_rec = sow_records.order_by("-actual_farrowing_date").first()
        if last_rec and last_rec.actual_farrowing_date:
            last_farrow = str(last_rec.actual_farrowing_date)
        elif h_l > 0:
            try:
                from ..models import PigBaseline
                pb = PigBaseline.objects.get(pig=sow)
                if pb.last_farrowing_date:
                    last_farrow = str(pb.last_farrowing_date)
            except Exception:
                pass

        sow_ranking.append({
            "sow_name": sow.name, "sow_id": sow.pig_id,
            "total_litters": total_l,
            "live_litters":  rec_litters,
            "historical_litters": h_l,
            "avg_litter_size": avg_al,
            "survival_rate":   surv,
            "productivity_score": score,
            "last_farrowed": last_farrow or "—",
        })
    sow_ranking.sort(key=lambda x: x["productivity_score"], reverse=True)

    return {
        "pregnancy_success_rate_pct":  pregnancy_success,
        "farrowing_success_rate_pct":  farrowing_success,
        "avg_litter_size":             avg_litter,
        "survival_rate_pct":           survival,
        "weaning_rate_pct":            weaning,
        "total_litters":               total_litters,
        "live_litters":                live_litters,
        "baseline_litters":            bl_litters,
        "total_alive_born":            total_alive,
        "total_weaned":                total_weaned,
        "currently_pregnant":          total_pregnant,
        "monthly_litter_trend":        [{"month": k, "litters": v} for k, v in monthly.items()],
        "sow_ranking":                 sow_ranking[:10],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Health analytics
# ─────────────────────────────────────────────────────────────────────────────

def health_analytics(farm):
    """
    Farm Health Score: (healthy + 0.5×under_treatment) / total × 100
    Green ≥ 80, Amber 60-79, Red < 60

    Baseline integration:
      - PigBaseline.major_diseases_history contributes to historical disease awareness
      - PigBaseline.vaccination_status_summary contributes to vaccination coverage note
    """
    from ..models import Pig, DiseaseRecord, HealthLog, VaccinationRecord, PigBaseline

    today = date.today()
    pigs  = farm.pigs.exclude(health_status="deceased")
    total = pigs.count()

    healthy         = pigs.filter(health_status="healthy").count()
    under_treatment = pigs.filter(health_status="under_treatment").count()
    critical        = pigs.filter(health_status="critical").count()

    farm_health_score = round(
        ((healthy + 0.5 * under_treatment) / total) * 100, 1
    ) if total > 0 else 100.0

    health_grade = (
        "Excellent" if farm_health_score >= 80 else
        "Good"      if farm_health_score >= 60 else
        "Fair"      if farm_health_score >= 40 else "Poor"
    )

    # Disease frequency last 90 days
    ninety_ago   = today - timedelta(days=90)
    disease_recs = DiseaseRecord.objects.filter(pig__farm=farm, diagnosed_date__gte=ninety_ago)
    freq = {}
    for dr in disease_recs:
        freq[dr.disease_name] = freq.get(dr.disease_name, 0) + 1

    # Also tally baseline historical diseases
    for pig in pigs:
        try:
            pb = PigBaseline.objects.get(pig=pig)
            if pb.major_diseases_history:
                for d in pb.major_diseases_history.split(","):
                    d = d.strip().split("(")[0].strip()  # remove parenthetical notes
                    if d:
                        freq[d + " (historical)"] = freq.get(d + " (historical)", 0) + 1
        except PigBaseline.DoesNotExist:
            pass

    top_diseases = sorted(
        [{"disease": k, "count": v} for k, v in freq.items()],
        key=lambda x: x["count"], reverse=True
    )[:5]

    # Recovery rate
    resolved    = DiseaseRecord.objects.filter(pig__farm=farm, outcome="recovered").count()
    total_closed = DiseaseRecord.objects.filter(
        pig__farm=farm, outcome__in=["recovered", "deceased"]
    ).count()
    recovery_rate = round(resolved / total_closed * 100, 1) if total_closed > 0 else 0

    # Mortality rate (last 90 days)
    deceased_90 = farm.pigs.filter(health_status="deceased", deceased_date__gte=ninety_ago).count()
    mortality_rate = round(deceased_90 / max(total, 1) * 100, 1)

    # Weekly health log trend (last 12 weeks)
    twelve_weeks_ago = today - timedelta(weeks=12)
    hlogs  = HealthLog.objects.filter(pig__farm=farm, date_logged__gte=twelve_weeks_ago)
    wtrend = {}
    for hl in hlogs:
        iso = hl.date_logged.isocalendar()
        k   = f"{iso[0]}-W{iso[1]:02d}"
        if k not in wtrend:
            wtrend[k] = {"week": k, "normal": 0, "warning": 0, "critical": 0}
        wtrend[k][hl.severity] += 1

    # Health Risk Index = (critical×3 + warning×1) / total pigs, capped 0–10
    recent = HealthLog.objects.filter(pig__farm=farm, date_logged__gte=today - timedelta(days=30))
    crit_n = recent.filter(severity="critical").count()
    warn_n = recent.filter(severity="warning").count()
    risk_index = min(10, round((crit_n * 3 + warn_n) / max(total, 1), 1))

    vax_due = VaccinationRecord.objects.filter(
        pig__farm=farm, next_due_date__lte=today + timedelta(days=7)
    ).count()

    # Count pigs with vaccination baseline summaries (coverage indicator)
    vaccinated_baseline = PigBaseline.objects.filter(
        pig__farm=farm
    ).exclude(vaccination_status_summary="").count()

    return {
        "farm_health_score":         farm_health_score,
        "health_grade":              health_grade,
        "health_risk_index":         risk_index,
        "pig_status": {
            "total": total, "healthy": healthy,
            "under_treatment": under_treatment, "critical": critical,
        },
        "disease_frequency":         top_diseases,
        "recovery_rate_pct":         recovery_rate,
        "mortality_rate_pct":        mortality_rate,
        "health_log_trend":          list(wtrend.values()),
        "vaccinations_due_7d":       vax_due,
        "vaccinated_from_baseline":  vaccinated_baseline,
        "avg_recovery_days":         _avg_recovery_days(farm),
        "expiring_medicines":        _expiring_medicines(farm),
        # ── New: structured disease intelligence ──────────────────────────────
        "disease_analytics":         _get_disease_analytics(farm),
        "vaccination_compliance":    _get_vaccination_compliance(farm),
        "health_risk_detail":        _get_health_risk_detail(farm),
    }


def _get_disease_analytics(farm):
    """Structured disease analytics via health_intelligence."""
    try:
        from .health_intelligence import disease_analytics
        return disease_analytics(farm)
    except Exception:
        return {}


def _get_vaccination_compliance(farm):
    """Vaccination compliance via health_intelligence."""
    try:
        from .health_intelligence import vaccination_compliance
        return vaccination_compliance(farm)
    except Exception:
        return {}


def _get_health_risk_detail(farm):
    """Detailed health risk scoring via health_intelligence."""
    try:
        from .health_intelligence import farm_health_risk_score
        return farm_health_risk_score(farm)
    except Exception:
        return {}


def _avg_recovery_days(farm):
    """
    Average days to recover from disease.
    Uses DiseaseRecord.resolved_date - diagnosed_date for 'recovered' outcomes.
    Previously: resolved_date was collected but never used.
    """
    from ..models import DiseaseRecord
    recovered = DiseaseRecord.objects.filter(
        pig__farm=farm, outcome="recovered",
        resolved_date__isnull=False
    )
    durations = []
    for dr in recovered:
        days = (dr.resolved_date - dr.diagnosed_date).days
        if days >= 0:
            durations.append(days)
    return round(sum(durations) / len(durations), 1) if durations else None


def _expiring_medicines(farm):
    """
    Medicines expiring within 30 days.
    Previously: expiry_date was collected but never checked for alerts.
    """
    from ..models import MedicineInventory
    thirty_days = date.today() + timedelta(days=30)
    results = []
    for m in MedicineInventory.objects.filter(farm=farm, expiry_date__isnull=False):
        if m.expiry_date <= thirty_days:
            days_left = (m.expiry_date - date.today()).days
            results.append({
                "name":       m.name,
                "quantity":   m.quantity,
                "unit":       m.unit,
                "expiry_date": str(m.expiry_date),
                "days_until_expiry": days_left,
                "expired":    days_left < 0,
            })
    results.sort(key=lambda x: x["days_until_expiry"])
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Growth analytics — baseline weight milestones used in ADG
# ─────────────────────────────────────────────────────────────────────────────

def growth_analytics(farm):
    """
    Full growth analytics using the growth_intelligence engine.

    Incorporates:
      - Industry-standard weight ranges per stage (growth_intelligence.STAGE_WEIGHT_RANGES)
      - Breed benchmark comparison for adult pigs
      - Weight compliance % (% of pigs within expected range)
      - ADG with slow/rapid growth detection
      - 30-day and 60-day weight forecasts per pig
      - PigBaseline historical milestones for onboarded pigs

    Every weight record logged contributes to all metrics below.
    """
    from ..models import PigBaseline
    from .growth_intelligence import (
        STAGE_WEIGHT_RANGES, MARKET_WEIGHT_KG,
        compute_pig_adg, forecast_weight,
        farm_growth_compliance, breed_benchmark_comparison,
    )

    today = date.today()

    stage_stats      = {s: {"adg_sum": 0.0, "count": 0} for s in STAGE_WEIGHT_RANGES}
    underperformers  = []
    projections      = []
    adg_all          = []
    adg_alerts       = []
    weight_forecasts = []

    for pig in farm.pigs.exclude(health_status="deceased"):
        records = list(pig.weight_records.order_by("recorded_at"))

        # Extend with PigBaseline historical milestones
        try:
            pb = PigBaseline.objects.get(pig=pig)
            if pb.weight_at_6_months and pb.weight_at_12_months:
                dob    = pig.date_of_birth
                date_6m  = dob + timedelta(days=182)
                date_12m = dob + timedelta(days=365)
                if not records or records[0].recorded_at > date_12m:
                    from types import SimpleNamespace
                    r6  = SimpleNamespace(recorded_at=date_6m,  weight_kg=float(pb.weight_at_6_months))
                    r12 = SimpleNamespace(recorded_at=date_12m, weight_kg=float(pb.weight_at_12_months))
                    records = [r6, r12] + records
        except PigBaseline.DoesNotExist:
            pass

        # ADG analysis
        adg_result = compute_pig_adg(pig, records)
        if adg_result:
            adg = adg_result["adg_kg_per_day"]
            stage = pig.growth_stage
            if stage in stage_stats:
                stage_stats[stage]["adg_sum"] += adg
                stage_stats[stage]["count"]   += 1
            adg_all.append(adg)

            eff = adg_result["efficiency_pct"]
            if eff < 80:
                underperformers.append({
                    "pig_name":          pig.name,
                    "pig_id":            pig.pig_id,
                    "stage":             stage,
                    "current_weight_kg": adg_result["last_weight_kg"],
                    "adg_kg_per_day":    adg,
                    "benchmark":         adg_result["benchmark_kg_per_day"],
                    "efficiency_score":  eff,
                })

            # ADG alert (slow or rapid)
            if adg_result["adg_alert"]:
                adg_alerts.append({
                    "pig_name": pig.name,
                    "pig_id":   pig.pig_id,
                    "alert":    adg_result["adg_alert"],
                    "severity": adg_result["adg_severity"],
                    "status":   adg_result["adg_status"],
                })

            # Market projection
            current_wt = adg_result["last_weight_kg"]
            if adg > 0 and current_wt < MARKET_WEIGHT_KG:
                d2m = round((MARKET_WEIGHT_KG - current_wt) / adg)
                projections.append({
                    "pig_name":          pig.name,
                    "pig_id":            pig.pig_id,
                    "current_weight_kg": current_wt,
                    "adg_kg_per_day":    adg,
                    "days_to_market":    d2m,
                    "market_date":       str(today + timedelta(days=d2m)),
                    "efficiency_score":  eff,
                })

        # Weight forecast per pig
        forecast = forecast_weight(pig, records)
        if forecast["method"] != "insufficient_data":
            weight_forecasts.append({
                "pig_name":            pig.name,
                "pig_id":              pig.pig_id,
                "current_weight_kg":   forecast["current_weight_kg"],
                "forecast_30d_kg":     forecast["forecast_30d_kg"],
                "forecast_60d_kg":     forecast["forecast_60d_kg"],
                "market_ready_date":   forecast["market_ready_date"],
                "breeding_ready_date": forecast["breeding_ready_date"],
                "confidence":          forecast["confidence"],
                "adg_kg_per_day":      forecast["adg_kg_per_day"],
                "expected_range_min":  forecast["expected_range_min"],
                "expected_range_max":  forecast["expected_range_max"],
            })

    # Stage summary
    stage_summary = []
    for stage, data in stage_stats.items():
        avg = round(data["adg_sum"] / data["count"], 3) if data["count"] > 0 else 0
        bm  = STAGE_WEIGHT_RANGES[stage]["ideal_adg"]
        eff = round(min(120, avg / bm * 100), 1) if bm > 0 and avg > 0 else 0
        stage_summary.append({
            "stage":            stage,
            "label":            STAGE_WEIGHT_RANGES[stage]["label"],
            "pig_count":        data["count"],
            "avg_adg":          avg,
            "benchmark":        bm,
            "efficiency_score": eff,
            "status":  "Above" if avg >= bm else "Near" if avg >= bm * 0.85 else "Below",
            "weight_range_min": STAGE_WEIGHT_RANGES[stage]["min_wt"],
            "weight_range_max": STAGE_WEIGHT_RANGES[stage]["max_wt"],
        })

    # Farm-level weight compliance
    compliance = farm_growth_compliance(farm)

    # Breed benchmark comparison
    breed_comparison = breed_benchmark_comparison(farm)

    farm_avg_adg = round(sum(adg_all) / len(adg_all), 3) if adg_all else 0
    underperformers.sort(key=lambda x: x["efficiency_score"])
    projections.sort(key=lambda x: x["days_to_market"])
    weight_forecasts.sort(key=lambda x: x.get("market_ready_date") or "9999-99-99")

    return {
        "farm_avg_adg":         farm_avg_adg,
        "market_weight_kg":     MARKET_WEIGHT_KG,
        "stage_adg_summary":    stage_summary,
        "underperformers":      underperformers[:10],
        "growth_projections":   projections[:10],
        "adg_alerts":           adg_alerts[:10],
        "weight_forecasts":     weight_forecasts[:15],
        "weight_compliance":    compliance,
        "breed_benchmark":      breed_comparison,
    }



# ─────────────────────────────────────────────────────────────────────────────
# Feed analytics — baseline daily consumption used when logs are sparse
# ─────────────────────────────────────────────────────────────────────────────

def feed_analytics(farm):
    """
    Effective daily usage uses last-14-day logs if ≥7 days available,
    otherwise falls back to FeedInventory.daily_usage_kg, and if that
    is zero, falls back to FarmBaseline.avg_daily_feed_kg_per_pig × pig_count.
    """
    from ..models import FeedInventory, FeedUsageLog, FarmBaseline

    today = date.today()
    pigs  = farm.pigs.exclude(health_status="deceased").count()
    fb    = _farm_baseline(farm)

    feed_items = list(farm.feed_inventory.all())
    stock_summary     = []
    shortage_alerts   = []
    total_monthly_cost = 0.0

    for fi in feed_items:
        effective = fi.effective_daily_usage
        # Last-resort fallback: use farm baseline per-pig rate
        if effective == 0 and fb and float(fb.avg_daily_feed_kg_per_pig or 0) > 0:
            effective = float(fb.avg_daily_feed_kg_per_pig) * pigs

        days_rem = int(float(fi.stock_kg) / effective) if effective > 0 else None
        monthly_cost = float(fi.price_per_kg) * effective * 30 if fi.price_per_kg else 0
        total_monthly_cost += monthly_cost

        status = (
            "critical" if days_rem is not None and days_rem < 7
            else "warning" if days_rem is not None and days_rem < 14
            else "good"
        )

        stock_summary.append({
            "id":                  fi.id,
            "feed_type":           fi.feed_type,
            "feed_type_display":   fi.get_feed_type_display(),
            "stock_kg":            float(fi.stock_kg),
            "effective_daily_kg":  round(effective, 2),
            "days_remaining":      days_rem,
            "price_per_kg":        float(fi.price_per_kg),
            "monthly_cost":        round(monthly_cost, 2),
            "status":              status,
            "used_baseline_rate":  effective == float(fb.avg_daily_feed_kg_per_pig or 0) * pigs if fb else False,
        })
        if status in ("critical", "warning"):
            shortage_alerts.append({
                "feed_type":      fi.get_feed_type_display(),
                "days_remaining": days_rem,
                "restock_by":     str(today + timedelta(days=max(0, (days_rem or 0) - 3))),
                "urgency":        status,
            })

    # Weekly usage trend (last 12 weeks)
    twelve_weeks_ago = today - timedelta(weeks=12)
    usage_logs = FeedUsageLog.objects.filter(farm=farm, date_used__gte=twelve_weeks_ago).order_by("date_used")
    weekly = {}
    for fu in usage_logs:
        iso = fu.date_used.isocalendar()
        k   = f"{iso[0]}-W{iso[1]:02d}"
        if k not in weekly:
            weekly[k] = {"week": k, "kg_used": 0.0}
        weekly[k]["kg_used"] = round(weekly[k]["kg_used"] + float(fu.amount_used_kg), 1)

    # Feed Conversion Ratio (last 30 days)
    total_feed_consumed = FeedUsageLog.objects.filter(
        farm=farm, date_used__gte=today - timedelta(days=30)
    ).aggregate(total=Sum("amount_used_kg"))["total"] or 0

    total_weight_gained = 0.0
    for pig in farm.pigs.exclude(health_status="deceased"):
        recs = pig.weight_records.filter(recorded_at__gte=today - timedelta(days=30)).order_by("recorded_at")
        if recs.count() >= 2:
            total_weight_gained += float(recs.last().weight_kg - recs.first().weight_kg)

    fcr = round(float(total_feed_consumed) / total_weight_gained, 2) if total_weight_gained > 0 else None

    return {
        "stock_summary":           stock_summary,
        "weekly_usage_trend":      list(weekly.values()),
        "total_monthly_cost":      round(total_monthly_cost, 2),
        "shortage_alerts":         shortage_alerts,
        "feed_conversion_ratio":   fcr,
        "fcr_benchmark":           2.75,
        "baseline_pig_count":      pigs,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Prediction engine
# ─────────────────────────────────────────────────────────────────────────────

def prediction_engine(farm):
    """
    Rules-based predictions. Baseline data is used in litter size predictions.
    """
    from ..models import BreedingRecord, HealthLog

    today = date.today()
    predictions = []

    # ── Farrowing schedule ────────────────────────────────────────────────────
    pregnant = BreedingRecord.objects.filter(
        sow__farm=farm,
        pregnancy_status__in=["pregnant", "bred"]
    ).select_related("sow").order_by("expected_farrowing_date")

    for r in pregnant:
        days_rem  = (r.expected_farrowing_date - today).days if r.expected_farrowing_date else None
        is_alert  = days_rem is not None and days_rem <= 7
        predictions.append({
            "type":       "farrowing",
            "title":      f"{r.sow.name} — Expected farrowing",
            "detail":     f"Due {r.expected_farrowing_date}",
            "days_away":  days_rem,
            "confidence": "High",
            "alert":      is_alert,
            "data": {
                "sow_name":         r.sow.name,
                "sow_id":           r.sow.pig_id,
                "expected_date":    str(r.expected_farrowing_date) if r.expected_farrowing_date else None,
                "days_remaining":   days_rem,
                "predicted_litter": _predict_litter_for_sow(r.sow, farm),
            },
        })

    # ── Feed shortages ────────────────────────────────────────────────────────
    for fi in farm.feed_inventory.all():
        effective = fi.effective_daily_usage
        if effective == 0:
            fb = _farm_baseline(farm)
            pigs_count = farm.pigs.exclude(health_status="deceased").count()
            if fb and float(fb.avg_daily_feed_kg_per_pig or 0) > 0:
                effective = float(fb.avg_daily_feed_kg_per_pig) * pigs_count
        days_rem = int(float(fi.stock_kg) / effective) if effective > 0 else None
        if days_rem is not None and days_rem < 14:
            predictions.append({
                "type":       "feed_shortage",
                "title":      f"{fi.get_feed_type_display()} — Low stock",
                "detail":     f"~{days_rem} days remaining at current usage",
                "days_away":  days_rem,
                "confidence": "High" if days_rem < 7 else "Medium",
                "alert":      days_rem < 7,
                "data": {
                    "feed_type":        fi.get_feed_type_display(),
                    "stock_kg":         float(fi.stock_kg),
                    "effective_daily":  round(effective, 2),
                    "days_remaining":   days_rem,
                    "restock_urgency":  "Immediate" if days_rem < 7 else "Soon",
                },
            })

    # ── Growth milestones ─────────────────────────────────────────────────────
    MARKET_WEIGHT = 90.0
    for pig in farm.pigs.exclude(health_status="deceased"):
        records = pig.weight_records.order_by("recorded_at")
        if records.count() < 2:
            continue
        first = records.first()
        last  = records.last()
        days  = (last.recorded_at - first.recorded_at).days
        if days == 0:
            continue
        adg     = float(last.weight_kg - first.weight_kg) / days
        current = float(last.weight_kg)
        if adg > 0 and current < MARKET_WEIGHT:
            d2m = round((MARKET_WEIGHT - current) / adg)
            if d2m <= 30:
                predictions.append({
                    "type":       "market_ready",
                    "title":      f"{pig.name} — Approaching market weight",
                    "detail":     f"Estimated in {d2m} days",
                    "days_away":  d2m,
                    "confidence": "Medium-High",
                    "alert":      d2m <= 14,
                    "data": {
                        "pig_name":          pig.name,
                        "pig_id":            pig.pig_id,
                        "current_weight_kg": current,
                        "adg_kg_per_day":    round(adg, 3),
                        "days_to_market":    d2m,
                        "market_date":       str(today + timedelta(days=d2m)),
                    },
                })

    # ── Medicine expiry alerts ────────────────────────────────────────────────
    for exp_med in _expiring_medicines(farm):
        predictions.append({
            "type":       "medicine_expiry",
            "title":      f"{exp_med['name']} — {'EXPIRED' if exp_med['expired'] else 'Expiring soon'}",
            "detail":     f"Expires {exp_med['expiry_date']} ({abs(exp_med['days_until_expiry'])} days {'ago' if exp_med['expired'] else 'from now'})",
            "days_away":  exp_med["days_until_expiry"],
            "confidence": "High",
            "alert":      exp_med["expired"] or exp_med["days_until_expiry"] <= 7,
            "data":       exp_med,
        })

    # ── Health risk rules ─────────────────────────────────────────────────────
    seven_ago    = today - timedelta(days=7)
    recent_cough = HealthLog.objects.filter(
        pig__farm=farm, date_logged__gte=seven_ago, has_cough=True
    ).values("pig").distinct().count()
    recent_crit  = HealthLog.objects.filter(
        pig__farm=farm, date_logged__gte=seven_ago, severity="critical"
    ).count()

    if recent_cough >= 3:
        predictions.append({
            "type": "health_risk",
            "title": "Potential respiratory outbreak",
            "detail": f"{recent_cough} pigs with coughing in last 7 days",
            "days_away": 0, "confidence": "High", "alert": True,
            "data": {"affected_pigs": recent_cough, "symptom": "coughing",
                     "recommendation": "Isolate affected pigs and consult a veterinarian"},
        })
    if recent_crit >= 2:
        predictions.append({
            "type": "health_risk",
            "title": "Multiple critical health cases",
            "detail": f"{recent_crit} critical cases in last 7 days",
            "days_away": 0, "confidence": "High", "alert": True,
            "data": {"critical_cases": recent_crit, "recommendation": "Review critical pigs immediately"},
        })

    # ── Health risk forecasts from health_intelligence ────────────────────────
    try:
        from .health_intelligence import health_forecasting
        for hf in health_forecasting(farm):
            hf["alert"] = hf.get("risk_level") in ("High", "Critical")
            predictions.append(hf)
    except Exception:
        pass

    alerts     = [p for p in predictions if p.get("alert")]
    non_alerts = sorted([p for p in predictions if not p.get("alert")],
                        key=lambda x: x.get("days_away") or 999)
    return alerts + non_alerts


def _predict_litter_for_sow(sow, farm):
    """
    Priority: sow personal avg (≥3 live records) → sow baseline avg →
              farm avg (live records) → farm baseline → 0
    """
    from ..models import BreedingRecord
    live = BreedingRecord.objects.filter(sow=sow, pregnancy_status="farrowed")
    if live.count() >= 3:
        return round(sum(r.piglets_born_alive or 0 for r in live) / live.count(), 1)

    h_l, h_b, _ = _pig_baseline(sow)
    if h_l > 0 and h_b > 0:
        return round(h_b / h_l, 1)

    # Farm-wide average
    all_farm_litters = BreedingRecord.objects.filter(sow__farm=farm, pregnancy_status="farrowed")
    if all_farm_litters.count() > 0:
        return round(
            sum(r.piglets_born_alive or 0 for r in all_farm_litters) / all_farm_litters.count(), 1
        )

    fb = _farm_baseline(farm)
    if fb and float(fb.avg_litter_size_historical or 0) > 0:
        return float(fb.avg_litter_size_historical)

    return 0