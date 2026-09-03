from datetime import datetime
from pydantic import BaseModel

from helpers.miscHelpers import get_ph_datetime


class RoleLabel(BaseModel):
    name: str
    description: str | None = ""
    is_active: bool | None = True
    is_system: bool | None = False
    created_at: datetime = get_ph_datetime()
    updated_at: datetime = get_ph_datetime()


class RoleLabelRequest(BaseModel):
    name: str
    description: str | None = ""
    is_active: bool | None = True
