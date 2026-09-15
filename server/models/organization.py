from datetime import datetime
from pydantic import BaseModel

from helpers.miscHelpers import get_ph_datetime


class Organization(BaseModel):
    name: str
    description: str | None = ""
    main_region: str
    region_coverage: str
    partnership_status: str | None = "ACTIVE"
    create_by: str | None = ""
    created_at: datetime = get_ph_datetime()
    updated_at: datetime = get_ph_datetime()


class OrganizationRequest(BaseModel):
    name: str
    description: str | None = ""
    main_region: str
    region_coverage: str
    partnership_status: str | None = "ACTIVE"