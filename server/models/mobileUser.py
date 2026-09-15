import re
from datetime import datetime

from pydantic import BaseModel, field_validator


MOBILE_ROLE_ID = "user"
MOBILE_ROLE_LABEL = "User"
MOBILE_REGISTRATION_SOURCE = "mobile_registration"


def normalize_mobile_email(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if (
        not normalized
        or len(normalized) > 254
        or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized)
    ):
        raise ValueError("A valid email address is required")
    return normalized


def validate_mobile_password(value: str) -> str:
    if not isinstance(value, str) or not 12 <= len(value) <= 128:
        raise ValueError("Password must be between 12 and 128 characters")
    if not re.search(r"[a-z]", value) or not re.search(r"[A-Z]", value):
        raise ValueError("Password must include upper- and lower-case letters")
    if not re.search(r"\d", value):
        raise ValueError("Password must include a number")
    return value


class MobileRegistrationRequest(BaseModel):
    fullName: str
    email: str
    password: str
    roleId: str
    roleLabel: str
    regionCode: str
    regionLabel: str
    province: str
    city: str
    barangay: str
    source: str

    @field_validator("fullName", "regionLabel", "province", "city", "barangay")
    @classmethod
    def required_text(cls, value, info):
        normalized = str(value or "").strip()
        if not normalized:
            raise ValueError(f"{info.field_name} is required")
        if len(normalized) > 120:
            raise ValueError(f"{info.field_name} must be at most 120 characters")
        return normalized

    @field_validator("regionCode")
    @classmethod
    def region_code(cls, value):
        normalized = str(value or "").strip().upper()
        if not normalized or len(normalized) > 24:
            raise ValueError("regionCode is required and must be at most 24 characters")
        return normalized

    @field_validator("email")
    @classmethod
    def email(cls, value):
        return normalize_mobile_email(value)

    @field_validator("password")
    @classmethod
    def password(cls, value):
        return validate_mobile_password(value)

    @field_validator("roleId")
    @classmethod
    def role_id(cls, value):
        if value != MOBILE_ROLE_ID:
            raise ValueError("roleId must be user")
        return MOBILE_ROLE_ID

    @field_validator("roleLabel")
    @classmethod
    def role_label(cls, value):
        if value != MOBILE_ROLE_LABEL:
            raise ValueError("roleLabel must be User")
        return MOBILE_ROLE_LABEL

    @field_validator("source")
    @classmethod
    def source(cls, value):
        if value != MOBILE_REGISTRATION_SOURCE:
            raise ValueError("source must be mobile_registration")
        return MOBILE_REGISTRATION_SOURCE


class MobileLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email(cls, value):
        return normalize_mobile_email(value)

    @field_validator("password")
    @classmethod
    def password(cls, value):
        if not isinstance(value, str) or not value or len(value) > 128:
            raise ValueError("A password is required")
        return value


class MobileUserDocument(BaseModel):
    id: str
    fullName: str
    email: str
    passwordHash: str
    roleId: str = MOBILE_ROLE_ID
    roleLabel: str = MOBILE_ROLE_LABEL
    regionCode: str
    regionLabel: str
    province: str
    city: str
    barangay: str
    source: str = MOBILE_REGISTRATION_SOURCE
    createdAt: datetime
    updatedAt: datetime
