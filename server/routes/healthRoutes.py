"""Process liveness only; no database writes, inference, or provider requests."""

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class LivenessResponse(BaseModel):
    status: str
    service: str


@router.get(
    "/live",
    response_model=LivenessResponse,
    summary="API process liveness",
    description="Confirms HTTP reachability only. Does not check MongoDB, model readiness, or environmental providers.",
)
def liveness():
    return {"status": "ok", "service": "HealthPH+ API"}
