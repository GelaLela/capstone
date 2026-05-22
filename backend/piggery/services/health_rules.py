"""
Rule-based health evaluation engine.
Based on standard swine veterinary reference ranges.

References:
- Normal swine temperature: 38.0 – 39.5°C
- Normal respiratory rate:  15 – 25 breaths/min
- Normal heart rate:        60 – 80 BPM
"""

def evaluate_health_log(log) -> tuple:
    """
    Evaluates a HealthLog instance against veterinary rules.
    Returns: (severity, findings_text)
      severity: "normal" | "warning" | "critical"
      findings: human-readable summary of detected issues
    """
    findings = []
    severity  = "normal"

    # ── Temperature rules ────────────────────────────────────────────────
    if log.temperature_c is not None:
        temp = float(log.temperature_c)
        if temp > 41.0:
            findings.append(
                f"CRITICAL: Severe hyperthermia ({temp}°C). "
                f"Normal range is 38.0–39.5°C. Immediate veterinary attention required."
            )
            severity = "critical"
        elif temp > 40.0:
            findings.append(
                f"WARNING: Fever detected ({temp}°C). "
                f"Normal range is 38.0–39.5°C. Monitor closely and consider veterinary consultation."
            )
            severity = _escalate(severity, "warning")
        elif temp < 37.5:
            findings.append(
                f"WARNING: Hypothermia risk ({temp}°C). "
                f"Pig may be in shock or severely ill."
            )
            severity = _escalate(severity, "warning")

    # ── Respiratory rate rules ───────────────────────────────────────────
    if log.respiratory_rate is not None:
        rr = log.respiratory_rate
        if rr > 60:
            findings.append(
                f"CRITICAL: Severe respiratory distress ({rr} breaths/min). "
                f"Normal is 15–25. Could indicate pneumonia or heat stroke."
            )
            severity = "critical"
        elif rr > 40:
            findings.append(
                f"WARNING: Elevated respiratory rate ({rr} breaths/min). "
                f"Normal is 15–25. Check for respiratory infection or heat stress."
            )
            severity = _escalate(severity, "warning")
        elif rr < 10:
            findings.append(
                f"WARNING: Abnormally low respiratory rate ({rr} breaths/min). "
                f"May indicate sedation, toxicity, or severe illness."
            )
            severity = _escalate(severity, "warning")

    # ── Heart rate rules ─────────────────────────────────────────────────
    if log.heart_rate is not None:
        hr = log.heart_rate
        if hr > 120:
            findings.append(
                f"CRITICAL: Severe tachycardia ({hr} BPM). "
                f"Normal is 60–80 BPM. Indicates extreme stress or critical illness."
            )
            severity = "critical"
        elif hr > 100:
            findings.append(
                f"WARNING: Elevated heart rate ({hr} BPM). "
                f"Normal is 60–80 BPM. Monitor for pain, fever, or infection."
            )
            severity = _escalate(severity, "warning")

    # ── Appetite rules ───────────────────────────────────────────────────
    if log.appetite == "none":
        findings.append(
            "WARNING: Pig is not eating. "
            "Anorexia lasting more than 24 hours requires veterinary attention."
        )
        severity = _escalate(severity, "warning")
    elif log.appetite == "poor":
        findings.append(
            "NOTICE: Reduced appetite observed. Monitor feed intake over next 24 hours."
        )
        if severity == "normal":
            severity = "normal"  # notice only, not escalated

    # ── Behavior rules ───────────────────────────────────────────────────
    if log.behavior == "lethargic":
        findings.append(
            "WARNING: Lethargy observed. "
            "Combined with other symptoms this may indicate systemic illness."
        )
        severity = _escalate(severity, "warning")
    elif log.behavior == "isolating":
        findings.append(
            "WARNING: Pig is isolating from the group. "
            "This is a common early sign of illness in pigs."
        )
        severity = _escalate(severity, "warning")
    elif log.behavior == "aggressive":
        findings.append(
            "NOTICE: Aggressive behavior noted. "
            "Could indicate pain, competition for resources, or hormonal changes."
        )

    # ── Stool condition rules ────────────────────────────────────────────
    if log.stool_condition == "bloody":
        findings.append(
            "CRITICAL: Bloody stool detected. "
            "Could indicate swine dysentery, hemorrhagic enteritis, or internal bleeding. "
            "Immediate veterinary attention required."
        )
        severity = "critical"
    elif log.stool_condition == "diarrhea":
        findings.append(
            "WARNING: Diarrhea observed. "
            "Check for PED virus, E. coli, or dietary issues. "
            "Ensure adequate hydration."
        )
        severity = _escalate(severity, "warning")
    elif log.stool_condition == "constipated":
        findings.append(
            "NOTICE: Constipation observed. Increase water access and monitor."
        )

    # ── Physical signs ───────────────────────────────────────────────────
    if log.has_cough:
        findings.append(
            "WARNING: Coughing observed. "
            "May indicate PRRS, swine influenza, or Mycoplasma pneumonia."
        )
        severity = _escalate(severity, "warning")

    if log.has_nasal_discharge:
        findings.append(
            "WARNING: Nasal discharge present. "
            "Associated with respiratory infections. Monitor for spread to other pigs."
        )
        severity = _escalate(severity, "warning")

    if log.has_skin_lesions:
        findings.append(
            "WARNING: Skin lesions detected. "
            "Could be FMD, swine erysipelas, or mange. Isolate pig if possible."
        )
        severity = _escalate(severity, "warning")

    if log.has_lameness:
        findings.append(
            "WARNING: Lameness detected. "
            "Check hooves for foot-and-mouth disease, injury, or joint infection."
        )
        severity = _escalate(severity, "warning")

    if log.has_vomiting:
        findings.append(
            "WARNING: Vomiting observed. "
            "May indicate gastric ulcers, toxin ingestion, or TGE virus."
        )
        severity = _escalate(severity, "warning")

    # ── All clear ────────────────────────────────────────────────────────
    if not findings:
        findings.append(
            "All vitals and observations are within normal range. "
            "Pig appears healthy."
        )

    return severity, "\n".join(findings)


def _escalate(current: str, new: str) -> str:
    """Only escalate severity, never downgrade."""
    order = {"normal": 0, "warning": 1, "critical": 2}
    return new if order.get(new, 0) > order.get(current, 0) else current