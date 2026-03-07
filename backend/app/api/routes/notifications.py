from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class MarkReadRequest(BaseModel):
    notification_ids: list[str] | None = None


@router.get("")
async def list_notifications(
    category: str | None = None,
    unread_only: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    sb = get_supabase()
    query = (
        sb.table("marketing_notifications")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if category:
        query = query.eq("category", category)
    if unread_only:
        query = query.is_("read_at", "null")
    result = query.execute()
    return result.data or []


@router.get("/unread-count")
async def unread_count() -> dict[str, int]:
    sb = get_supabase()
    result = (
        sb.table("marketing_notifications")
        .select("id", count="exact")
        .is_("read_at", "null")
        .execute()
    )
    return {"count": result.count or 0}


@router.patch("/mark-read")
async def mark_read(body: MarkReadRequest) -> dict[str, Any]:
    sb = get_supabase()
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()

    if body.notification_ids:
        for nid in body.notification_ids:
            sb.table("marketing_notifications").update({"read_at": now}).eq(
                "id", nid
            ).is_("read_at", "null").execute()
        return {"marked": len(body.notification_ids)}

    result = (
        sb.table("marketing_notifications")
        .update({"read_at": now})
        .is_("read_at", "null")
        .execute()
    )
    return {"marked": len(result.data or [])}
