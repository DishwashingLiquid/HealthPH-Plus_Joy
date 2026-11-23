from pydantic import BaseModel


class RoleLabelRequest(BaseModel):
    name: str
    description: str | None = ""
    is_active: bool | None = True
    accessible_pages: list[str] | None = None
