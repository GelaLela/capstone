"""
SMS service using PhilSMS — cheapest Philippine SMS API.
Price: ₱0.35 per SMS | Free: 5 test credits on signup
Sign up at: https://philsms.com

After signing up, add this to backend/backend/settings.py:
    PHILSMS_TOKEN     = "your_api_token_here"
    PHILSMS_SENDER_ID = "PIGLYTCS"   (max 11 chars, optional while pending approval)
"""

import requests
from django.conf import settings

PHILSMS_URL = "https://app.philsms.com/api/v3/sms/send"


def send_sms(phone: str, message: str) -> dict:
    """
    Send SMS via PhilSMS.
    phone: Philippine number e.g. '09171234567' or '639171234567'
    message: Text body (keep under 160 chars for 1 credit)
    """
    token     = getattr(settings, "PHILSMS_TOKEN",     None)
    sender_id = getattr(settings, "PHILSMS_SENDER_ID", "PIGLYTCS")

    if not token:
        # Silently skip if not configured — won't crash the app
        print(f"[SMS skipped — PhilSMS not configured] To: {phone} | Msg: {message}")
        return {"status": "skipped", "reason": "PHILSMS_TOKEN not set in settings.py"}

    # Normalize number — PhilSMS accepts 09XXXXXXXXX format
    if phone.startswith("63"):
        phone = "0" + phone[2:]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }
    payload = {
        "recipient": phone,
        "type":      "plain",
        "message":   message[:160],  # 1 SMS credit = 160 chars
    }

    try:
        res = requests.post(PHILSMS_URL, json=payload, headers=headers, timeout=15)
        res.raise_for_status()
        return {"status": "sent", "response": res.json()}
    except requests.RequestException as e:
        return {"status": "failed", "error": str(e)}


# ── Shortcut helpers used by tasks.py ─────────────────────────────────────

def send_health_alert(phone: str, pig_name: str, condition: str):
    message = f"[Piglytics] HEALTH ALERT: {pig_name} shows signs of {condition}. Please check immediately."
    return send_sms(phone, message[:160])

def send_farrowing_reminder(phone: str, sow_name: str, days_left: int):
    message = f"[Piglytics] REMINDER: {sow_name} is expected to farrow in {days_left} day(s). Prepare the pen."
    return send_sms(phone, message[:160])

def send_low_stock_alert(phone: str, item_name: str, quantity: str):
    message = f"[Piglytics] LOW STOCK: {item_name} is running low ({quantity} remaining). Restock soon."
    return send_sms(phone, message[:160])

def send_vaccination_reminder(phone: str, pig_name: str, vaccine: str):
    message = f"[Piglytics] VACCINE DUE: {pig_name} needs {vaccine}. Schedule with your vet."
    return send_sms(phone, message[:160])