"""Email service: sends verification codes via SMTP.
Configure with environment variables:
  SMTP_HOST  (default: smtp.gmail.com)
  SMTP_PORT  (default: 587)
  SMTP_USER  - sender email address
  SMTP_PASS  - sender password / app password
  SMTP_FROM  - display from address (defaults to SMTP_USER)

If SMTP_USER is not set, the code is only printed to the console (dev mode).
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=_env_path)
except ImportError:
    pass

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def send_verification_code(to_email: str, code: str) -> bool:
    """Send a 6-digit verification code. Returns True on success."""
    subject = "Ваш код подтверждения — bemqel panel"
    body_html = f"""
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1117;color:#e5e7eb;padding:32px;border-radius:12px;border:1px solid #1c2333;">
  <h2 style="color:#06b6d4;margin-top:0;">bemqel panel</h2>
  <p style="margin-bottom:8px;">Ваш код подтверждения email:</p>
  <div style="font-size:36px;font-weight:bold;letter-spacing:0.3em;color:#ffffff;background:#151b27;padding:16px 24px;border-radius:8px;display:inline-block;border:1px solid #1c2333;">
    {code}
  </div>
  <p style="color:#6b7280;font-size:13px;margin-top:24px;">Код действителен 15 минут. Если вы не запрашивали его — просто проигнорируйте это письмо.</p>
</div>
"""
    body_text = f"Ваш код подтверждения: {code}\n\nКод действителен 15 минут."

    if not SMTP_USER:
        # Dev mode — just log to console
        logger.warning(
            "\n" + "=" * 50 +
            f"\n[DEV] Email verification code for {to_email}: {code}" +
            "\n" + "=" * 50
        )
        print(f"\n{'='*50}\n[DEV] Verification code for {to_email}: {code}\n{'='*50}\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM or SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email}: {exc}")
        return False
