from pydantic import BaseModel

class OrganizationRequest(BaseModel):
    name: str
    description: str | None = ""
    main_region: str
    region_coverage: str
    partnership_status: str | None = "ACTIVE"