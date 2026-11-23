from datetime import datetime

from pydantic import BaseModel, Field

from helpers.dateTimeHelpers import get_ph_datetime


class ActivityLog(BaseModel):
    user_id: str
    entry: str
    module: str
    created_at: datetime = Field(default_factory=get_ph_datetime)