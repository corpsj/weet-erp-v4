"""Content API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class ContentOut(BaseModel):
    """Content response model."""

    id: str
    channel: str
    title: str | None = None
    body: str
    status: str
    engagement_metrics: dict[str, object] | None = None
    persona_target: str | None = None
    created_at: str | None = None
    published_at: str | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ContentOut])
async def list_content(
    channel: str | None = None,
    status: str | None = None,
) -> list[ContentOut]:
    """List content with optional filters."""
    sb = get_supabase()
    query = sb.table("marketing_contents").select("*").order("created_at", desc=True)
    if channel:
        query = query.eq("channel", channel)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return [ContentOut(**row) for row in (result.data or [])]


@router.get("/{content_id}", response_model=ContentOut)
async def get_content(
    content_id: str,
) -> ContentOut:
    """Get content detail by ID."""
    sb = get_supabase()
    result = (
        sb.table("marketing_contents")
        .select("*")
        .eq("id", content_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Content not found")
    return ContentOut(**result.data[0])


@router.post("/{content_id}/publish", response_model=ContentOut)
async def publish_content(
    content_id: str,
) -> ContentOut:
    """Publish a draft content item."""
    sb = get_supabase()
    result = (
        sb.table("marketing_contents")
        .update(
            {
                "status": "published",
                "published_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", content_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Content not found")
    return ContentOut(**result.data[0])
