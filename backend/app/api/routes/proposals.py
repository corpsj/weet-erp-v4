"""Proposals API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.session import get_supabase

router = APIRouter()


class ProposalOut(BaseModel):
    """Proposal response model."""

    id: str
    title: str
    action_type: str | None = None
    content_draft: str | None = None
    status: str
    approved_at: str | None = None
    rejection_reason: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class RejectBody(BaseModel):
    """Rejection request body."""

    reason: str


class ModifyBody(BaseModel):
    """Modify content draft request body."""

    content_draft: str


@router.get("", response_model=list[ProposalOut])
async def list_proposals(
    status: str | None = None,
    action_type: str | None = None,
) -> list[ProposalOut]:
    """List proposals with optional filters."""
    sb = get_supabase()
    query = sb.table("marketing_proposals").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if action_type:
        query = query.eq("action_type", action_type)
    result = query.execute()
    return [ProposalOut(**row) for row in (result.data or [])]


@router.post("/{proposal_id}/approve", response_model=ProposalOut)
async def approve_proposal(
    proposal_id: str,
) -> ProposalOut:
    """Approve a pending proposal."""
    sb = get_supabase()
    result = (
        sb.table("marketing_proposals")
        .update(
            {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", proposal_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return ProposalOut(**result.data[0])


@router.post("/{proposal_id}/reject", response_model=ProposalOut)
async def reject_proposal(
    proposal_id: str,
    body: RejectBody,
) -> ProposalOut:
    """Reject a proposal with reason."""
    sb = get_supabase()
    result = (
        sb.table("marketing_proposals")
        .update({"status": "rejected", "rejection_reason": body.reason})
        .eq("id", proposal_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return ProposalOut(**result.data[0])


@router.post("/{proposal_id}/modify", response_model=ProposalOut)
async def modify_proposal(
    proposal_id: str,
    body: ModifyBody,
) -> ProposalOut:
    """Modify proposal content draft."""
    sb = get_supabase()
    result = (
        sb.table("marketing_proposals")
        .update({"content_draft": body.content_draft})
        .eq("id", proposal_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return ProposalOut(**result.data[0])
