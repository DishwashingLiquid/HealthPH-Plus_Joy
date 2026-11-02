import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import HTTPException
from pymongo import ReturnDocument

from helpers.authHelpers import generate_hashed_password
from helpers.miscHelpers import get_ph_datetime
from helpers.sendMail import mail_account_invitation


def web_client_url():
    url = os.getenv("CLIENT_URL", "").strip().rstrip("/")
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("CLIENT_URL must be the dashboard's HTTP or HTTPS base URL.")
    return url


def invitation_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def invitation_query(token):
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise invalid_invitation()
    return {
        "activation_pending": True,
        "is_disabled": {"$ne": True},
        "invitation_token_hash": invitation_digest(token),
        "invitation_expires_at": {"$gt": datetime.now(timezone.utc)},
    }


def invalid_invitation():
    return HTTPException(
        status_code=400,
        detail="This invitation is invalid or has expired. Ask your administrator to resend it.",
    )


def validate_account_password(password, confirmation):
    if password != confirmation:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    # Match the application's existing password requirements, including bcrypt's limit.
    if (
        len(password) < 8 or len(password.encode("utf-8")) > 72
        or not re.fullmatch(r"[A-Za-z0-9!@#$%^&*_-]+", password)
        or not all(re.search(pattern, password) for pattern in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[!@#$%^&*_-]"))
    ):
        raise HTTPException(
            status_code=400,
            detail="Use 8–72 characters with uppercase and lowercase letters, a number, and a special character (!@#$%^&*_-). Do not use spaces.",
        )


def send_account_invitation(collection, user):
    """Atomically rotate invitations and throttle resend attempts, including failures."""
    hours = int(os.getenv("ACCOUNT_INVITATION_EXPIRE_HOURS", "24"))
    if not 1 <= hours <= 168:
        raise ValueError("ACCOUNT_INVITATION_EXPIRE_HOURS must be between 1 and 168.")
    base_url = web_client_url()
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    digest = invitation_digest(token)
    expires_at = now + timedelta(hours=hours)
    updated = collection.find_one_and_update(
        {
            "_id": user["_id"], "email": user["email"],
            "activation_pending": True, "is_disabled": {"$ne": True},
            "$or": [
                {"invitation_requested_at": {"$exists": False}},
                {"invitation_requested_at": {"$lte": now - timedelta(seconds=60)}},
            ],
        },
        {"$set": {
            "invitation_token_hash": digest, "invitation_expires_at": expires_at,
            "invitation_requested_at": now, "invitation_email_sent": False,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=429, detail="Please wait one minute before requesting another invitation, and check that the account is still pending and enabled.")

    # Fragments are not sent to the web server in access logs or referrer headers.
    sent = mail_account_invitation(updated["email"], {
        **updated, "activation_url": f"{base_url}/activate-account#token={token}",
        "expires_at": expires_at,
    })
    collection.update_one(
        {"_id": updated["_id"], "invitation_token_hash": digest},
        {"$set": {"invitation_email_sent": bool(sent)}},
    )
    return bool(sent)


def activate_invited_account(collection, token, password, confirmation):
    validate_account_password(password, confirmation)
    query = invitation_query(token)
    if not collection.find_one(query, {"_id": 1}):
        raise invalid_invitation()
    # Single conditional write consumes the token; replay and concurrent requests fail.
    activated = collection.find_one_and_update(
        query,
        {
            "$set": {
                "password": generate_hashed_password(password),
                "activation_pending": False, "activated_at": get_ph_datetime(),
                "email_verified_at": datetime.now(timezone.utc), "updated_at": get_ph_datetime(),
            },
            "$unset": {key: "" for key in (
                "invitation_token_hash", "invitation_expires_at", "invitation_requested_at",
                "invitation_email_sent", "otp_code", "otp_expiry",
            )},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not activated:
        raise invalid_invitation()
    return activated
