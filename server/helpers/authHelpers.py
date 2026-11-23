from datetime import datetime, timedelta, timezone
import math
import os
import secrets

import bcrypt
from jose import jwt

from helpers.dateTimeHelpers import get_ph_datetime
from models.auth import OTPCode

# Checks if input password and hashed password matches
def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )

# For hashing password to be stored in database
def generate_hashed_password(password: str):
    salt = bcrypt.gensalt(10)
    return (bcrypt.hashpw(password.encode("utf-8"), (salt))).decode("utf-8")


# Web session duration, independent of OTP and password-reset expiry.
def get_web_session_duration():
    try:
        minutes = float(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
        if not math.isfinite(minutes) or minutes <= 0:
            raise ValueError()
        duration = timedelta(minutes=minutes)
        if duration <= timedelta(0):
            raise ValueError()
        return duration
    except (ValueError, OverflowError):
        raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be a finite positive number.") from None


# For authentication / authorization
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    duration = get_web_session_duration() if expires_delta is None else expires_delta
    if duration <= timedelta(0):
        raise ValueError("Access token lifetime must be greater than zero.")
    expire = datetime.now(timezone.utc) + duration

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        os.getenv("SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM"),
    )

    return encoded_jwt


# For resetting password
def create_reset_password_token(email: str):
    return jwt.encode(
        {"sub": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        key=os.getenv("FORGOT_PWD_SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM"),
    )

# For 2-step verification
def generate_otp_code():
    return OTPCode(
        otp_code=f"{secrets.randbelow(999999):06d}",
        otp_expiry=get_ph_datetime() + timedelta(minutes=10),
    )
