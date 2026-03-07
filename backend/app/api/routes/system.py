"""System API routes."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class SystemStatus(BaseModel):
    """System status response."""

    scheduler: str
    lmstudio: str
    naver_quota: int
    youtube_quota: int


class TriggerResponse(BaseModel):
    """Trigger action response."""

    status: str
    message: str


@router.get("/status", response_model=SystemStatus)
async def get_status() -> SystemStatus:
    """Get system component status."""
    return SystemStatus(
        scheduler="running",
        lmstudio="unknown",
        naver_quota=0,
        youtube_quota=0,
    )


@router.post("/radar/run", response_model=TriggerResponse)
async def run_radar() -> TriggerResponse:
    """Trigger a market radar scan."""
    return TriggerResponse(
        status="triggered",
        message="Market radar scan initiated",
    )


@router.post("/suggestions/generate", response_model=TriggerResponse)
async def generate_suggestions() -> TriggerResponse:
    """Trigger suggestion generation."""
    return TriggerResponse(
        status="triggered",
        message="Suggestion generation initiated",
    )
