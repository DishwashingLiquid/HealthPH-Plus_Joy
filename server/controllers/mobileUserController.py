import os
import secrets
from datetime import timedelta

import bcrypt
from fastapi import HTTPException, status
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
)


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


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (TypeError, ValueError):
        return False


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
    if not user or not _verify_password(payload.password, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "access_token": create_mobile_access_token(user["id"]),
            "token_type": "bearer",
            "user": serialize_mobile_user(user),
        },
    )
