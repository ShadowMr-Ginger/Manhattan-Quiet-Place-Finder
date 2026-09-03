"""Email delivery service.

Configure via environment variables:
    SMTP_HOST        e.g. smtp.gmail.com
    SMTP_PORT        e.g. 587  (STARTTLS) or 465 (SSL)
    SMTP_USER        your Gmail / SMTP account address
    SMTP_PASSWORD    App-password (Gmail) or SMTP password
    FROM_EMAIL       Sender address (defaults to SMTP_USER)
    FRONTEND_URL     Frontend origin (React app), e.g. http://127.0.0.1:5173
                     Do NOT set this to the API host (…:8000) or verify links will break.

If SMTP_HOST or SMTP_USER is not set, emails are printed to stdout instead
of sent (useful during local development).
"""

import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER) or "noreply@hushhub.app"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")


def _send(to: str, subject: str, body_html: str) -> None:
    """Send an HTML email. Falls back to stdout if SMTP is not configured."""
    if not SMTP_HOST or not SMTP_USER:
        print(f"[email – SMTP not configured]\nTo: {to}\nSubject: {subject}\n{body_html}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    context = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to, msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to, msg.as_string())


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}?verify={token}"
    body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1a1a1a">Verify your Hush-Hub email</h2>
      <p>Thanks for signing up! Click the button below to verify your email address.
         This link expires in <strong>24 hours</strong>.</p>
      <a href="{link}"
         style="display:inline-block;margin:24px 0;padding:12px 24px;
                background:#4f46e5;color:#fff;border-radius:6px;
                text-decoration:none;font-weight:600">
        Verify Email
      </a>
      <p style="color:#666;font-size:13px">
        If you didn't create a Hush-Hub account, you can ignore this email.
      </p>
    </div>
    """
    _send(to_email, "Verify your Hush-Hub email", body)


def send_reset_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}?reset={token}"
    body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#1a1a1a">Reset your Hush-Hub password</h2>
      <p>We received a request to reset your password. Click the button below.
         This link expires in <strong>1 hour</strong> and can only be used once.</p>
      <a href="{link}"
         style="display:inline-block;margin:24px 0;padding:12px 24px;
                background:#4f46e5;color:#fff;border-radius:6px;
                text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="color:#666;font-size:13px">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    """
    _send(to_email, "Reset your Hush-Hub password", body)
