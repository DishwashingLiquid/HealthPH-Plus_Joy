import smtplib
from smtplib import SMTPException
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, formatdate
from dotenv import dotenv_values
import os
from datetime import datetime, timedelta, timezone
from helpers.emailTemplateHelpers import render_email
from region_normalization import REGION_NAMES

config = dotenv_values()

smtp_port = os.getenv("SMTP_PORT")
smtp_server = os.getenv("SMTP_SERVER")
smtp_username = os.getenv("SMTP_USERNAME")
smtp_password = os.getenv("SMTP_PASSWORD")
smtp_sender_email = os.getenv("SMTP_SENDER_EMAIL")


def mail_setup(receiver, subject):
    message = MIMEMultipart("alternative")
    message["From"] = formataddr(("HealthPH+", smtp_sender_email or ""))
    message["Subject"] = subject
    message["To"] = receiver
    message["Date"] = formatdate(localtime=True)

    return message


def mail_send(receiver, message):
    try:
        with smtplib.SMTP(
            smtp_server,
            int(smtp_port),
            timeout=10,
        ) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(
                smtp_sender_email,
                receiver,
                message.as_string(),
            )

        return True
    except (SMTPException, OSError, ValueError, TypeError) as error:
        print(f"Email delivery failed: {type(error).__name__}")
        return False


def _send_template(receiver, title, paragraphs, details=(), action_label=None, action_url=None,
                   *, verification_code=None, reply_to=None):
    plain, html = render_email(
        title, paragraphs, details, action_label, action_url,
        verification_code=verification_code,
    )
    message = mail_setup(receiver, f"HealthPH+ | {title}")
    if reply_to:
        message["Reply-To"] = reply_to
    message.attach(MIMEText(plain, "plain", "utf-8"))
    message.attach(MIMEText(html, "html", "utf-8"))
    return mail_send(receiver, message)


def _ph_time(value):
    if not value:
        return "See the instructions above"
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    # Existing OTP/reset timestamps are naive Philippine local time.
    if value.tzinfo is not None:
        value = value.astimezone(timezone(timedelta(hours=8)))
    return value.strftime("%B %d, %Y at %I:%M %p (Philippine Time)")


def _greeting(data=None):
    data = data or {}
    name = " ".join(
        str(data.get(field) or "").strip() for field in ("first_name", "last_name")
    ).strip()
    return f"Hello, {name}." if name else "Hello,"


def _sign_in_url():
    url = os.getenv("CLIENT_URL", "").strip().rstrip("/")
    return f"{url}/login" if url else None


def mail_contact_us(receiver, data: dict):
    return _send_template(receiver, "New contact-form message", [data.get("message_body", "")], [
        ("Name", data.get("name", "")), ("Email", data.get("email", "")),
        ("Subject", data.get("subject", "")),
    ], reply_to=data.get("email"))


def mail_verification_code(receiver, data: dict):
    return _send_template(receiver, "Your sign-in verification code", [
        _greeting(data),
        "Enter the verification code below to finish signing in to HealthPH+. It can be used once. If you requested a new code, use the latest email.",
        "Do not share this code. If you did not request it, you can ignore this email.",
    ], [("Valid Until", _ph_time(data["otp_expiry"]))], verification_code=data["otp_code"])


def mail_forgot_password(receiver, data: dict):
    return _send_template(receiver, "Reset your password", [
        _greeting(data),
        "Use the button below to create a new password. This link expires in 10 minutes.",
        "If you did not request a password reset, you can ignore this email.",
    ], action_label="Reset Password", action_url=data["reset_pwd_link"])


def mail_account_invitation(receiver, data: dict):
    regions = data.get("accessible_regions") or ""
    if isinstance(regions, str):
        regions = regions.split(",")
    is_superadmin = data.get("user_type") == "SUPERADMIN"
    region_text = "All Regions" if is_superadmin else ", ".join(REGION_NAMES.get(code.strip(), code.strip()) for code in regions)
    return _send_template(receiver, "Activate your HealthPH+ account", [
        _greeting(data),
        "Your administrator has invited you to HealthPH+. Set your own password to activate your account.",
        "Your available pages and data depend on your assigned permissions.",
        "This link can be used once. If it expires, ask your administrator to resend your invitation. Only the latest invitation link will work.",
    ], [
        ("Email", receiver), ("Account Type", data.get("user_type", "USER")),
        ("Role", "Superadmin" if is_superadmin else data.get("role_label", "")),
        ("Organization", data.get("organization", "")), ("Accessible Regions", region_text),
        ("Invitation Expires", _ph_time(data["expires_at"])),
    ], "Set Password & Activate", data["activation_url"])


# Preserve older import names while sharing the invitation template. Passwords are never emailed.
def mail_add_user(receiver, data: dict):
    return mail_account_invitation(receiver, data)


def mail_add_admin(receiver, data: dict):
    return mail_account_invitation(receiver, {**data, "role_label": "Admin"})


def mail_add_superadmin(receiver, data: dict):
    return mail_account_invitation(receiver, {**data, "user_type": "SUPERADMIN"})


def mail_enabled(receiver, data=None):
    data = data or {}
    pending = data.get("activation_pending", False)
    url = None if pending else _sign_in_url()
    return _send_template(receiver, "Your account has been enabled", [
        _greeting(data),
        "Your administrator has enabled your HealthPH+ account.",
        (
            "You still need to activate your account using your invitation email and create your password. If the link has expired, ask your administrator to resend your invitation."
            if pending else
            "You can now sign in using your email and existing password. Your access follows the permissions assigned to your account."
        ),
    ], [("Account Email", receiver)], action_label="Sign In" if url else None, action_url=url)


def mail_disabled(receiver, data=None):
    return _send_template(receiver, "Your account has been disabled", [
        _greeting(data),
        "Your administrator has disabled your HealthPH+ account. You cannot sign in while it is disabled.",
        "Contact your administrator if you need access restored or believe this was a mistake.",
    ], [("Account Email", receiver)])


def mail_delete_account(receiver, data=None):
    return _send_template(receiver, "Your account has been deleted", [
        _greeting(data),
        "Your HealthPH+ account has been deleted and can no longer be used to sign in.",
        "Contact your administrator if you have questions or believe this was a mistake.",
    ], [("Account Email", receiver)])
