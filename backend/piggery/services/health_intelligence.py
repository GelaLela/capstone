"""
backend/piggery/services/health_intelligence.py

Structured swine health intelligence engine.

Disease categories and conditions are based on:
  - OIE (World Organisation for Animal Health) swine disease list
  - Philippine Bureau of Animal Industry (BAI) disease surveillance
  - Standard swine veterinary references

Every function feeds into:
  - health_analytics() → Analytics Health tab
  - prediction_engine() → Forecast tab
  - Dashboard health score and alerts
"""

from datetime import date, timedelta


# ─────────────────────────────────────────────────────────────────────────────
# STRUCTURED DISEASE CATALOGUE
# ─────────────────────────────────────────────────────────────────────────────
# This is the single source of truth for all disease categories and names.
# Frontend uses this to build the structured picker.
# Backend uses this to categorize DiseaseRecord entries for analytics.

DISEASE_CATEGORIES = {
    "respiratory": {
        "label": "Respiratory",
        "color": "#E24B4A",   # red
        "diseases": [
            "Swine Influenza",
            "Mycoplasma Pneumonia",
            "PRRS (Porcine Reproductive & Respiratory Syndrome)",
            "Actinobacillus Pleuropneumonia (APP)",
            "Enzootic Pneumonia",
            "Pasteurellosis",
            "Bordetellosis (Atrophic Rhinitis)",
        ],
    },
    "digestive": {
        "label": "Digestive",
        "color": "#EF9F27",   # amber
        "diseases": [
            "Colibacillosis (E. coli Infection)",
            "Salmonellosis",
            "Swine Dysentery",
            "Ileitis (Porcine Proliferative Enteropathy)",
            "Transmissible Gastroenteritis (TGE)",
            "Porcine Epidemic Diarrhea (PED)",
            "Rotavirus Infection",
        ],
    },
    "skin": {
        "label": "Skin & External",
        "color": "#BA7517",   # dark amber
        "diseases": [
            "Mange (Sarcoptic)",
            "Ringworm (Dermatophytosis)",
            "Greasy Pig Disease (Exudative Epidermitis)",
            "Swine Pox",
            "Foot-and-Mouth Disease (FMD)",
        ],
    },
    "reproductive": {
        "label": "Reproductive",
        "color": "#D4537E",   # pink
        "diseases": [
            "Mastitis",
            "Metritis",
            "Agalactia (MMA Syndrome)",
            "PRRS Reproductive Form",
            "Brucellosis",
            "Leptospirosis",
            "Parvovirus Infection",
            "Stillbirths / Mummified Fetuses",
        ],
    },
    "parasitic": {
        "label": "Parasitic",
        "color": "#7F77DD",   # purple
        "diseases": [
            "Internal Worms (Ascariasis)",
            "Roundworms",
            "Lungworms",
            "Lice (Pediculosis)",
            "Mites",
            "Coccidiosis",
            "Toxoplasmosis",
        ],
    },
    "nutritional": {
        "label": "Nutritional",
        "color": "#639922",   # green
        "diseases": [
            "Vitamin A Deficiency",
            "Vitamin E / Selenium Deficiency",
            "Iron Deficiency Anemia",
            "Calcium / Phosphorus Imbalance",
            "Zinc Deficiency (Parakeratosis)",
            "Salt Poisoning (Water Deprivation)",
        ],
    },
    "systemic": {
        "label": "Systemic / Other",
        "color": "#5F5E5A",   # gray
        "diseases": [
            "African Swine Fever (ASF)",
            "Hog Cholera (Classical Swine Fever)",
            "Erysipelas",
            "Meningitis (Streptococcal)",
            "Septicemia",
            "Fever (Unknown Origin)",
            "Lameness (Unknown Cause)",
            "Injury / Trauma",
            "Heat Stress",
            "Dehydration",
        ],
    },
}

# Reverse lookup: disease_name → category_key
DISEASE_TO_CATEGORY = {}
for _cat_key, _cat_data in DISEASE_CATEGORIES.items():
    for _disease in _cat_data["diseases"]:
        DISEASE_TO_CATEGORY[_disease.lower()] = _cat_key


def get_disease_category(disease_name):
    """Return category key for a disease name, or 'systemic' as default."""
    return DISEASE_TO_CATEGORY.get(disease_name.lower().strip(), "systemic")


def get_disease_catalog():
    """Return the full catalogue for frontend use."""
    return {
        cat_key: {
            "label":    cat["label"],
            "color":    cat["color"],
            "diseases": cat["diseases"],
        }
        for cat_key, cat in DISEASE_CATEGORIES.items()
    }


# ─────────────────────────────────────────────────────────────────────────────
# VACCINATION COMPLIANCE
# ─────────────────────────────────────────────────────────────────────────────

# Core vaccines expected for Philippine commercial swine
CORE_VACCINES = [
    "Hog Cholera",
    "Foot-and-Mouth Disease",
    "Erysipelas",
]

def vaccination_compliance(farm):
    """
    Computes:
      - vaccinated_pigs: count of pigs with at least 1 vaccination record
      - overdue_vaccinations: count of VaccinationRecord.next_due_date <= today
      - compliance_pct: vaccinated_pigs / total_pigs × 100
      - coverage_by_vaccine: {vaccine_name → count}
      - unvaccinated_pigs: list of pig names without any vaccination record
    """
    from ..models import VaccinationRecord

    today = date.today()
    pigs  = list(farm.pigs.exclude(health_status="deceased"))
    total = len(pigs)

    vaccinated_ids = set(
        VaccinationRecord.objects.filter(pig__farm=farm)
        .values_list("pig_id", flat=True)
        .distinct()
    )

    overdue = VaccinationRecord.objects.filter(
        pig__farm=farm,
        next_due_date__lt=today,
    ).count()

    due_7d = VaccinationRecord.objects.filter(
        pig__farm=farm,
        next_due_date__gte=today,
        next_due_date__lte=today + timedelta(days=7),
    ).count()

    due_30d = VaccinationRecord.objects.filter(
        pig__farm=farm,
        next_due_date__gte=today,
        next_due_date__lte=today + timedelta(days=30),
    ).count()

    # Coverage by vaccine name
    vax_records = VaccinationRecord.objects.filter(pig__farm=farm)
    coverage = {}
    for vr in vax_records:
        n = vr.vaccine_name
        coverage[n] = coverage.get(n, 0) + 1

    unvaccinated = [
        p.name for p in pigs if p.id not in vaccinated_ids
    ]

    compliance_pct = round(len(vaccinated_ids) / total * 100, 1) if total > 0 else 0

    return {
        "total_pigs":           total,
        "vaccinated_pigs":      len(vaccinated_ids),
        "unvaccinated_count":   total - len(vaccinated_ids),
        "unvaccinated_pigs":    unvaccinated[:10],
        "compliance_pct":       compliance_pct,
        "overdue_vaccinations": overdue,
        "due_in_7d":            due_7d,
        "due_in_30d":           due_30d,
        "coverage_by_vaccine":  coverage,
    }


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH RISK SCORING
# ─────────────────────────────────────────────────────────────────────────────

def farm_health_risk_score(farm):
    """
    Rules-based risk model.

    Points are added for each risk factor. Final score is mapped to a level.
    Risk factors:
      +30: any ASF or Hog Cholera in last 30 days
      +20: mortality in last 30 days
      +15: critical health log in last 14 days
      +10: 3+ pigs with respiratory symptoms in last 7 days
      +10: outbreak defined as same disease in 3+ pigs in last 14 days
      +8:  overdue vaccinations > 20% of herd
       -5: vaccination compliance > 90% (protective factor)
       -5: recovery rate > 85% (protective factor)

    Levels:
      0–15   → Low
      16–30  → Moderate
      31–50  → High
      51+    → Critical

    Returns:
      {
        risk_score:   int
        risk_level:   "Low" | "Moderate" | "High" | "Critical"
        risk_factors: list[str]  (human-readable explanations)
        high_risk_pigs: list[{pig_name, reason}]
      }
    """
    from ..models import DiseaseRecord, HealthLog, VaccinationRecord

    today     = date.today()
    score     = 0
    factors   = []
    hr_pigs   = []

    # ASF / Hog Cholera
    critical_diseases = ["african swine fever", "hog cholera", "classical swine fever", "asf"]
    thirty_ago = today - timedelta(days=30)
    for dr in DiseaseRecord.objects.filter(pig__farm=farm, diagnosed_date__gte=thirty_ago):
        if any(cd in dr.disease_name.lower() for cd in critical_diseases):
            score += 30
            factors.append(f"Critical notifiable disease reported: {dr.disease_name} on {dr.diagnosed_date}")
            break

    # Mortality events last 30 days
    deceased_30 = farm.pigs.filter(health_status="deceased", deceased_date__gte=thirty_ago).count()
    if deceased_30 > 0:
        pts = min(20, deceased_30 * 5)
        score += pts
        factors.append(f"{deceased_30} pig(s) deceased in the last 30 days (+{pts} pts)")

    # Critical health logs last 14 days
    fourteen_ago = today - timedelta(days=14)
    crit_logs = HealthLog.objects.filter(
        pig__farm=farm, severity="critical", date_logged__gte=fourteen_ago
    ).count()
    if crit_logs > 0:
        pts = min(30, crit_logs * 5)
        score += pts
        factors.append(f"{crit_logs} critical health logs in the last 14 days (+{pts} pts)")

    # Respiratory cluster last 7 days
    seven_ago = today - timedelta(days=7)
    resp_pigs = HealthLog.objects.filter(
        pig__farm=farm, has_cough=True, date_logged__gte=seven_ago
    ).values("pig").distinct().count()
    if resp_pigs >= 3:
        score += 10
        factors.append(f"{resp_pigs} pigs with cough in last 7 days — potential respiratory cluster (+10 pts)")

    # Disease outbreak (same disease, 3+ pigs, 14 days)
    from collections import Counter
    recent_diseases = list(
        DiseaseRecord.objects.filter(
            pig__farm=farm, diagnosed_date__gte=fourteen_ago
        ).values_list("disease_name", flat=True)
    )
    freq = Counter(recent_diseases)
    outbreak = [(d, c) for d, c in freq.items() if c >= 3]
    for disease, count in outbreak:
        score += 10
        factors.append(f"Potential outbreak: {disease} in {count} pigs in last 14 days (+10 pts)")

    # Vaccination overdue
    total_pigs = farm.pigs.exclude(health_status="deceased").count()
    vax_comp   = vaccination_compliance(farm)
    overdue    = vax_comp["overdue_vaccinations"]
    if total_pigs > 0 and overdue / max(total_pigs, 1) > 0.20:
        score += 8
        factors.append(f"{overdue} overdue vaccinations (>20% of herd) (+8 pts)")

    # Protective factor: high vaccination compliance
    if vax_comp["compliance_pct"] >= 90:
        score = max(0, score - 5)
        factors.append("Vaccination compliance ≥ 90% (−5 pts protective)")

    # Protective factor: high recovery rate
    from ..models import DiseaseRecord as DR2
    recovered = DR2.objects.filter(pig__farm=farm, outcome="recovered").count()
    closed    = DR2.objects.filter(pig__farm=farm, outcome__in=["recovered", "deceased"]).count()
    rec_rate  = round(recovered / closed * 100, 1) if closed > 0 else 0
    if rec_rate >= 85:
        score = max(0, score - 5)
        factors.append(f"Recovery rate {rec_rate}% ≥ 85% (−5 pts protective)")

    # Identify individual high-risk pigs
    for pig in farm.pigs.filter(health_status__in=["critical", "under_treatment"]):
        recent = HealthLog.objects.filter(pig=pig, date_logged__gte=fourteen_ago)
        crit   = recent.filter(severity="critical").count()
        reason = (
            f"Health status: {pig.health_status}"
            + (f", {crit} critical logs in 14 days" if crit > 0 else "")
        )
        hr_pigs.append({"pig_name": pig.name, "pig_id": pig.pig_id, "reason": reason})

    # Classify level
    if score >= 51:
        level = "Critical"
    elif score >= 31:
        level = "High"
    elif score >= 16:
        level = "Moderate"
    else:
        level = "Low"

    return {
        "risk_score":      score,
        "risk_level":      level,
        "risk_factors":    factors,
        "high_risk_pigs":  hr_pigs[:10],
        "recovery_rate":   rec_rate,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DISEASE ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

def disease_analytics(farm):
    """
    Disease distribution, frequency, and outbreak detection using structured
    DiseaseRecord data (disease_category field + disease_name).

    Compatible with both old (no disease_category) and new records.
    """
    from ..models import DiseaseRecord
    from collections import Counter

    today = date.today()

    # All-time disease distribution
    all_records = DiseaseRecord.objects.filter(pig__farm=farm)
    total_cases = all_records.count()

    # Frequency by category
    cat_freq = Counter()
    name_freq = Counter()
    for dr in all_records:
        cat = getattr(dr, "disease_category", None) or get_disease_category(dr.disease_name)
        cat_freq[cat] += 1
        name_freq[dr.disease_name] += 1

    # Distribution by category (for chart)
    cat_distribution = []
    for cat_key, count in cat_freq.most_common():
        cat_info = DISEASE_CATEGORIES.get(cat_key, {"label": cat_key, "color": "#888780"})
        cat_distribution.append({
            "category":     cat_key,
            "label":        cat_info["label"],
            "color":        cat_info["color"],
            "count":        count,
            "pct":          round(count / max(total_cases, 1) * 100, 1),
        })

    # Top 5 most common diseases
    top_diseases = [{"disease": d, "count": c} for d, c in name_freq.most_common(5)]

    # Recent 30 days
    thirty_ago    = today - timedelta(days=30)
    recent_cases  = all_records.filter(diagnosed_date__gte=thirty_ago).count()
    recent_names  = Counter(
        all_records.filter(diagnosed_date__gte=thirty_ago).values_list("disease_name", flat=True)
    )

    # Outbreak detection (same disease, 3+ pigs, 14 days)
    fourteen_ago = today - timedelta(days=14)
    fourteen_names = Counter(
        all_records.filter(diagnosed_date__gte=fourteen_ago).values_list("disease_name", flat=True)
    )
    outbreaks = [
        {"disease": d, "count": c, "alert": f"{d}: {c} cases in 14 days"}
        for d, c in fourteen_names.items() if c >= 3
    ]

    # Treatment success
    resolved = all_records.filter(outcome="recovered").count()
    deceased = all_records.filter(outcome="deceased").count()
    ongoing  = all_records.filter(outcome="ongoing").count()
    closed   = resolved + deceased
    treatment_success = round(resolved / closed * 100, 1) if closed > 0 else 0

    return {
        "total_cases":          total_cases,
        "recent_cases_30d":     recent_cases,
        "category_distribution":cat_distribution,
        "top_diseases":         top_diseases,
        "treatment_success_pct":treatment_success,
        "resolved_cases":       resolved,
        "deceased_cases":       deceased,
        "ongoing_cases":        ongoing,
        "outbreaks_14d":        outbreaks,
    }


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH FORECASTING — rule-based, no AI
# ─────────────────────────────────────────────────────────────────────────────

def health_forecasting(farm):
    """
    Rule-based health risk forecasts using only historical farm data.

    Rules:
      1. Seasonal respiratory risk: if cough cases increased week-over-week, flag rising trend
      2. Recurring disease risk: if a disease appeared 2+ times in 30 days, flag recurrence
      3. High-risk pig list: pigs with 2+ critical logs in last 14 days
      4. Vaccination due in 7 days: from VaccinationRecord.next_due_date
      5. Disease spread risk: if 3+ pigs in same stage have same disease in 14 days

    Each forecast item is labelled with confidence and is traceable to data.
    """
    from ..models import DiseaseRecord, HealthLog, VaccinationRecord
    from collections import Counter

    today         = date.today()
    forecasts     = []

    # ── Rule 1: Rising respiratory trend ─────────────────────────────────────
    this_week = HealthLog.objects.filter(
        pig__farm=farm, has_cough=True,
        date_logged__gte=today - timedelta(days=7)
    ).count()
    last_week = HealthLog.objects.filter(
        pig__farm=farm, has_cough=True,
        date_logged__range=[today - timedelta(days=14), today - timedelta(days=7)]
    ).count()
    if this_week >= 2 and this_week > last_week:
        forecasts.append({
            "type":       "disease_trend",
            "risk_level": "High" if this_week >= 5 else "Moderate",
            "title":      "Rising respiratory cases",
            "detail":     f"{this_week} cough cases this week vs {last_week} last week. "
                          "Respiratory disease cluster developing.",
            "recommendation": "Isolate affected pigs. Test for PRRS or Swine Influenza. "
                              "Review ventilation and stocking density.",
            "confidence": "High",
            "data_basis": f"HealthLog: {this_week} cough records (7 days)",
        })

    # ── Rule 2: Recurring disease ─────────────────────────────────────────────
    thirty_ago = today - timedelta(days=30)
    recent_diseases = Counter(
        DiseaseRecord.objects.filter(
            pig__farm=farm, diagnosed_date__gte=thirty_ago
        ).values_list("disease_name", flat=True)
    )
    for disease, count in recent_diseases.most_common():
        if count >= 2:
            forecasts.append({
                "type":       "recurrence_risk",
                "risk_level": "Moderate",
                "title":      f"Recurring condition: {disease}",
                "detail":     f"{disease} has occurred {count} times in the last 30 days.",
                "recommendation": "Review treatment protocol. Check if pigs have re-exposure to source.",
                "confidence": "Medium",
                "data_basis": f"DiseaseRecord: {count} occurrences in 30 days",
            })

    # ── Rule 3: High-risk individual pigs ─────────────────────────────────────
    fourteen_ago = today - timedelta(days=14)
    pig_log_counts = {}
    for hl in HealthLog.objects.filter(
        pig__farm=farm, severity__in=["critical", "warning"], date_logged__gte=fourteen_ago
    ):
        pig_log_counts[hl.pig_id] = pig_log_counts.get(hl.pig_id, 0) + 1

    for pig_id, cnt in pig_log_counts.items():
        if cnt >= 2:
            try:
                from ..models import Pig
                pig = farm.pigs.get(id=pig_id)
                forecasts.append({
                    "type":       "individual_risk",
                    "risk_level": "High",
                    "title":      f"{pig.name} — health deterioration risk",
                    "detail":     f"{cnt} severe/critical health logs in 14 days.",
                    "recommendation": "Schedule veterinary examination for this pig.",
                    "confidence": "High",
                    "data_basis": f"HealthLog: {cnt} events (14 days)",
                })
            except Exception:
                pass

    # ── Rule 4: Vaccination due ───────────────────────────────────────────────
    due_7d = VaccinationRecord.objects.filter(
        pig__farm=farm,
        next_due_date__gte=today,
        next_due_date__lte=today + timedelta(days=7)
    ).select_related("pig")
    for vr in due_7d[:5]:
        forecasts.append({
            "type":       "vaccination_due",
            "risk_level": "Low",
            "title":      f"{vr.pig.name} — {vr.vaccine_name} due",
            "detail":     f"Due: {vr.next_due_date}",
            "recommendation": f"Administer {vr.vaccine_name} on or before {vr.next_due_date}.",
            "confidence": "High",
            "data_basis": "VaccinationRecord",
        })

    # ── Rule 5: Stage-group disease spread ───────────────────────────────────
    stage_disease = {}
    for dr in DiseaseRecord.objects.filter(
        pig__farm=farm, diagnosed_date__gte=fourteen_ago
    ).select_related("pig"):
        key = (dr.pig.growth_stage, dr.disease_name)
        stage_disease[key] = stage_disease.get(key, 0) + 1

    for (stage, disease), count in stage_disease.items():
        if count >= 3:
            forecasts.append({
                "type":       "spread_risk",
                "risk_level": "High",
                "title":      f"Disease spread risk: {disease} in {stage}s",
                "detail":     f"{count} {stage} pigs diagnosed with {disease} in 14 days.",
                "recommendation": "Segregate affected stage group. Review shared water/feed. "
                                  "Treat all pigs in stage group if disease is contagious.",
                "confidence": "High",
                "data_basis": f"DiseaseRecord: {count} same-stage-same-disease cases",
            })

    return forecasts