"""Dashboard API routes."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class DashboardOverview(BaseModel):
    """Dashboard overview response."""

    total_leads: int
    pending_proposals: int
    published_content: int
    channel_stats: dict[str, int]


class MetricsResponse(BaseModel):
    """Metrics response."""

    period: str
    data: list[dict[str, object]]


@router.get("/overview", response_model=DashboardOverview)
async def get_overview() -> DashboardOverview:
    """Get dashboard overview with key counts."""
    sb = get_supabase()

    total_leads_result = (
        sb.table("marketing_leads").select("id", count="exact").execute()
    )
    pending_result = (
        sb.table("marketing_proposals")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )
    published_result = (
        sb.table("marketing_contents")
        .select("id", count="exact")
        .eq("status", "published")
        .execute()
    )

    return DashboardOverview(
        total_leads=total_leads_result.count or 0,
        pending_proposals=pending_result.count or 0,
        published_content=published_result.count or 0,
        channel_stats={},
    )


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(period: str = "daily") -> MetricsResponse:
    """Get metrics for given period."""
    sb = get_supabase()
    rows = (
        sb.table("marketing_daily_metrics")
        .select(
            "date, leads_collected, proposals_made, proposals_approved, contents_published"
        )
        .order("date", desc=False)
        .execute()
    )
    data = rows.data or []
    return MetricsResponse(period=period, data=data)
