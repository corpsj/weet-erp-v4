"""Signals API routes."""

from collections import Counter
from fastapi import APIRouter
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class SignalOut(BaseModel):
    """Signal response model."""

    id: str
    source: str
    signal_type: str | None = None
    title: str | None = None
    summary: str | None = None
    urgency: str
    sentiment: str | None = None
    keywords: list[str] | None = None
    url: str | None = None
    collected_at: str | None = None

    model_config = {"from_attributes": True}


class TrendItem(BaseModel):
    """Single trend keyword with frequency."""

    keyword: str
    count: int


class TrendsResponse(BaseModel):
    """Trends response."""

    trends: list[TrendItem]


@router.get("", response_model=list[SignalOut])
async def list_signals(
    limit: int = 20,
) -> list[SignalOut]:
    """List recent market signals."""
    sb = get_supabase()
    result = (
        sb.table("marketing_signals")
        .select("*")
        .order("collected_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [SignalOut(**row) for row in (result.data or [])]


@router.get("/trends", response_model=TrendsResponse)
async def get_trends() -> TrendsResponse:
    """Get keyword frequency trends from recent signals."""
    sb = get_supabase()
    result = (
        sb.table("marketing_signals")
        .select("keywords")
        .order("collected_at", desc=True)
        .limit(100)
        .execute()
    )
    counter: Counter[str] = Counter()
    for signal in result.data or []:
        keywords = signal.get("keywords")
        if isinstance(keywords, list):
            for kw in keywords:
                if isinstance(kw, str):
                    counter[kw] += 1
    trends = [TrendItem(keyword=kw, count=cnt) for kw, cnt in counter.most_common(20)]
    return TrendsResponse(trends=trends)
