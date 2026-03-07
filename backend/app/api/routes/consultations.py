from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.conversion.consultation import ConsultationService

router = APIRouter()


class ConsultationCreate(BaseModel):
    lead_id: str
    request_channel: str = "dm_response"
    persona_type: str | None = None
    notes: str | None = None


class ConsultationUpdate(BaseModel):
    status: str
    notes: str | None = None


@router.get("")
async def list_consultations(
    status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    svc = ConsultationService()
    return svc.list_consultations(status=status, limit=limit)


@router.get("/{consultation_id}")
async def get_consultation(consultation_id: str) -> dict[str, Any]:
    svc = ConsultationService()
    result = svc.get_consultation(consultation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return result


@router.post("")
async def create_consultation(body: ConsultationCreate) -> dict[str, Any]:
    svc = ConsultationService()
    consultation_id = svc.create_consultation(
        lead_id=body.lead_id,
        request_channel=body.request_channel,
        persona_type=body.persona_type,
        notes=body.notes,
    )
    if not consultation_id:
        raise HTTPException(status_code=500, detail="Failed to create consultation")
    return {"id": consultation_id, "status": "requested"}


@router.patch("/{consultation_id}")
async def update_consultation(
    consultation_id: str,
    body: ConsultationUpdate,
) -> dict[str, Any]:
    svc = ConsultationService()
    success = svc.update_consultation_status(
        consultation_id=consultation_id,
        new_status=body.status,
        notes=body.notes,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Invalid status or not found")
    return {"id": consultation_id, "status": body.status}
