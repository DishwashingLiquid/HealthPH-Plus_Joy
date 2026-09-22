import os
import secrets
import hashlib
import hmac
from datetime import timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse
from jose import jwt
from pymongo.errors import DuplicateKeyError

from config.database import mobile_users_collection
from helpers.miscHelpers import get_ph_datetime
from models.mobileUser import (
    MOBILE_REGISTRATION_SOURCE,
    MOBILE_ROLE_ID,
    MOBILE_ROLE_LABEL,
    MobileLoginRequest,
    MobileRegistrationRequest,
    MobileUserPinUpdate,
    MobileUserPinVerify,
)
from middleware.requireMobileAuth import require_mobile_auth


PBKDF2_ITERATIONS = 100_000


def _bcrypt_rounds() -> int:
    try:
        configured_rounds = int(os.getenv("MOBILE_BCRYPT_ROUNDS", "12"))
    except ValueError:
        configured_rounds = 12
    return max(configured_rounds, 12)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=_bcrypt_rounds())
    ).decode("utf-8")


def _hash_pbkdf2_secret(secret: str) -> str:
    """Match the legacy FastAPI mobile-account `<salt>:<hash>` format."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", secret.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}:{digest}"


def _verify_pbkdf2_secret(secret: str, encoded_secret: str) -> bool:
    """Safely verify an existing `<salt>:<sha256-pbkdf2-hash>` value."""
    try:
        salt, expected = encoded_secret.split(":", 1)
        if not salt or not expected:
            return False
        calculated = hashlib.pbkdf2_hmac(
            "sha256", secret.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
        ).hex()
        return hmac.compare_digest(calculated, expected)
    except (AttributeError, TypeError, ValueError):
        return False


def _verify_password(password: str, password_hash: str) -> bool:
    """Accept bcrypt and the deployed legacy PBKDF2 mobile-account hashes."""
    if isinstance(password_hash, str) and ":" in password_hash:
        return _verify_pbkdf2_secret(password, password_hash)
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def _is_legacy_pbkdf2(password_hash: str | None) -> bool:
    return isinstance(password_hash, str) and ":" in password_hash


def _password_hash_field(user: dict) -> str:
    """Use the existing deployed field name during a no-reset migration."""
    return "passwordHash" if "passwordHash" in user else "password"


def _stored_password_hash(user: dict) -> str:
    return user.get("passwordHash") or user.get("password") or ""


def _should_migrate_pbkdf2_passwords() -> bool:
    return os.getenv("MOBILE_MIGRATE_PBKDF2_TO_BCRYPT", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }


def _stored_pin_hash(user: dict) -> str:
    """Read both the existing scalar `pins` value and a future object form."""
    pins = user.get("pins")
    if isinstance(pins, str):
        return pins
    if isinstance(pins, dict):
        return pins.get("hash") or pins.get("pinHash") or ""
    return ""


def _generate_public_id() -> str:
    return f"mu_{secrets.token_urlsafe(24)}"


def serialize_mobile_user(document: dict) -> dict:
    """Return the mobile account DTO. Password material is deliberately omitted."""
    return {
        "id": document.get("id"),
        "fullName": document.get("fullName"),
        "email": document.get("email"),
        "roleId": document.get("roleId"),
        "roleLabel": document.get("roleLabel"),
        "regionCode": document.get("regionCode"),
        "regionLabel": document.get("regionLabel"),
        "province": document.get("province"),
        "city": document.get("city"),
        "barangay": document.get("barangay"),
        "source": document.get("source"),
        "createdAt": document.get("createdAt").isoformat()
        if document.get("createdAt")
        else None,
        "updatedAt": document.get("updatedAt").isoformat()
        if document.get("updatedAt")
        else None,
    }


def create_mobile_access_token(mobile_user_id: str) -> str:
    expires_at = get_ph_datetime() + timedelta(
        minutes=float(os.getenv("MOBILE_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    )
    return jwt.encode(
        {
            "sub": mobile_user_id,
            "aud": "mobile",
            "typ": "mobile_access",
            "roleId": MOBILE_ROLE_ID,
            "roleLabel": MOBILE_ROLE_LABEL,
            "exp": expires_at,
        },
        os.getenv("SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM"),
    )


async def register_mobile_user(payload: MobileRegistrationRequest):
    # The canonical values are set here rather than copied from the client payload.
    if mobile_users_collection.find_one({"email": payload.email, "source": MOBILE_REGISTRATION_SOURCE}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )

    now = get_ph_datetime()
    document = {
        "id": _generate_public_id(),
        "fullName": payload.fullName,
        "email": payload.email,
        "passwordHash": _hash_password(payload.password),
        "roleId": MOBILE_ROLE_ID,
        "roleLabel": MOBILE_ROLE_LABEL,
        "regionCode": payload.regionCode,
        "regionLabel": payload.regionLabel,
        "province": payload.province,
        "city": payload.city,
        "barangay": payload.barangay,
        "source": MOBILE_REGISTRATION_SOURCE,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        mobile_users_collection.insert_one(document)
    except DuplicateKeyError as error:
        # A deployment index makes this the race-safe duplicate-email path.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        ) from error

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"user": serialize_mobile_user(document)},
    )


async def login_mobile_user(payload: MobileLoginRequest):
    user = mobile_users_collection.find_one(
        {
            "email": payload.email,
            "source": MOBILE_REGISTRATION_SOURCE,
            "roleId": MOBILE_ROLE_ID,
        }
    )
    password_hash = _stored_password_hash(user) if user else ""
    if not user or not _verify_password(payload.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # This is opt-in so an existing PBKDF2 deployment remains unchanged until
    # its maintainers explicitly approve rolling upgrades. A successful login
    # is the only time a legacy hash is replaced; users are never locked out.
    if _is_legacy_pbkdf2(password_hash) and _should_migrate_pbkdf2_passwords():
        mobile_users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {_password_hash_field(user): _hash_password(payload.password)}},
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "access_token": create_mobile_access_token(user["id"]),
            "token_type": "bearer",
            "user": serialize_mobile_user(user),
        },
    )


def _require_token_subject(user_id: str, mobile_claims: dict):
    if mobile_claims.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mobile user mismatch")
    user = mobile_users_collection.find_one({
        "id": user_id,
        "source": MOBILE_REGISTRATION_SOURCE,
        "roleId": MOBILE_ROLE_ID,
    })
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mobile user not found")
    return user


async def update_mobile_user_pin(
    user_id: str,
    payload: MobileUserPinUpdate,
    mobile_claims: dict = Depends(require_mobile_auth),
):
    _require_token_subject(user_id, mobile_claims)
    mobile_users_collection.update_one(
        {"id": user_id, "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID},
        {"$set": {"pins": _hash_pbkdf2_secret(payload.pin), "updatedAt": get_ph_datetime()}},
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "PIN updated"})


async def verify_mobile_user_pin(
    user_id: str,
    payload: MobileUserPinVerify,
    mobile_claims: dict = Depends(require_mobile_auth),
):
    user = _require_token_subject(user_id, mobile_claims)
    pin_hash = _stored_pin_hash(user)
    if not pin_hash or not _verify_pbkdf2_secret(payload.pin, pin_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN")
    return JSONResponse(status_code=status.HTTP_200_OK, content={"verified": True})
