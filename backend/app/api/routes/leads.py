"""Leads API routes."""

from typing import Any, cast

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class LeadSummary(BaseModel):
    """Lead list item (no PII beyond username)."""

    id: str
    platform: str
    username: str
    score: int
    persona_type: str | None = None
    journey_stage: str
    source: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class LeadDetail(LeadSummary):
    """Lead detail with metadata."""

    metadata_: dict[str, object] | None = None
    updated_at: str | None = None

    model_config = {"from_attributes": True}


class LeadUpdate(BaseModel):
    """Lead update request."""

    journey_stage: str | None = None
    score: int | None = None
    persona_type: str | None = None


def _normalize_lead(row: dict[str, Any]) -> dict[str, Any]:
    if "metadata" in row and "metadata_" not in row:
        row = {**row, "metadata_": row.get("metadata")}
    return row


@router.get("", response_model=list[LeadSummary])
async def list_leads(
    score_min: int | None = None,
    persona: str | None = None,
    stage: str | None = None,
    channel: str | None = None,
) -> list[LeadSummary]:
    """List leads with optional filters."""
    sb = get_supabase()
    query = sb.table("marketing_leads").select("*").order("score", desc=True)
    if score_min is not None:
        query = query.gte("score", score_min)
    if persona:
        query = query.eq("persona_type", persona)
    if stage:
        query = query.eq("journey_stage", stage)
    if channel:
        query = query.eq("platform", channel)
    result = query.execute()
    return [
        LeadSummary.model_validate(cast(dict[str, Any], _normalize_lead(row)))
        for row in (result.data or [])
    ]


@router.get("/{lead_id}", response_model=LeadDetail)
async def get_lead(
    lead_id: str,
) -> LeadDetail:
    """Get lead detail by ID."""
    sb = get_supabase()
    result = (
        sb.table("marketing_leads").select("*").eq("id", lead_id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadDetail.model_validate(
        cast(dict[str, Any], _normalize_lead(result.data[0]))
    )


@router.patch("/{lead_id}", response_model=LeadDetail)
async def update_lead(
    lead_id: str,
    body: LeadUpdate,
) -> LeadDetail:
    """Update lead stage, score, or persona."""
    sb = get_supabase()
    update_data: dict[str, str | int] = {}
    if body.journey_stage is not None:
        update_data["journey_stage"] = body.journey_stage
    if body.score is not None:
        update_data["score"] = body.score
    if body.persona_type is not None:
        update_data["persona_type"] = body.persona_type

    if update_data:
        result = (
            sb.table("marketing_leads").update(update_data).eq("id", lead_id).execute()
        )
    else:
        result = (
            sb.table("marketing_leads").select("*").eq("id", lead_id).limit(1).execute()
        )

    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    return LeadDetail.model_validate(
        cast(dict[str, Any], _normalize_lead(result.data[0]))
    )
