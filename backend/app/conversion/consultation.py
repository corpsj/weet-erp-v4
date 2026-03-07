import logging
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.core.discord_bot import DiscordBot
from app.db.session import get_supabase

logger = logging.getLogger(__name__)

VALID_STATUSES = ("requested", "scheduled", "completed", "contracted", "lost")
VALID_CHANNELS = ("dm_response", "phone", "kakao", "form", "handoff_keyword")

PERSONA_DM_TEMPLATES: dict[str, str] = {
    "price_sensitive": (
        "안녕하세요 @{username}님! 이동식주택 비용이 궁금하시죠? "
        "평형별 견적과 실제 시공 비용을 안내해드릴 수 있어요. "
        "편하게 DM 주시거나 전화(010-9645-2348) 주세요 :)"
    ),
    "lifestyle": (
        "안녕하세요 @{username}님! 전원생활의 꿈, 위트가 함께할게요. "
        "실제 입주자 후기와 생활 모습을 보여드릴 수 있어요. "
        "궁금한 점 있으시면 편하게 DM 주세요 :)"
    ),
    "practical": (
        "안녕하세요 @{username}님! 농막·작업실·세컨하우스 용도로 "
        "이동식주택을 고려하고 계신다면, 허가 절차와 설치 사례를 "
        "안내해드릴게요. DM 주시면 상세 자료 보내드려요!"
    ),
    "design": (
        "안녕하세요 @{username}님! 감성적인 이동식주택 디자인에 관심이 있으시군요. "
        "커스텀 인테리어 포트폴리오와 3D 시안을 보여드릴 수 있어요. "
        "DM으로 원하시는 스타일 알려주세요 :)"
    ),
}

DEFAULT_DM_TEMPLATE = (
    "안녕하세요 @{username}님! 이동식주택에 관심 가져주셔서 감사해요. "
    "맞춤 상담을 도와드릴 수 있어요. 편하게 DM 주시거나 "
    "전화(010-9645-2348) 주세요 :)"
)


class ConsultationService:
    def __init__(self) -> None:
        self.discord = DiscordBot()
        self._kst = ZoneInfo("Asia/Seoul")

    def create_consultation(
        self,
        lead_id: str,
        request_channel: str = "dm_response",
        persona_type: Optional[str] = None,
        notes: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        if request_channel not in VALID_CHANNELS:
            request_channel = "dm_response"

        sb = get_supabase()
        result = (
            sb.table("marketing_consultations")
            .insert(
                {
                    "lead_id": lead_id,
                    "persona_type": persona_type,
                    "request_channel": request_channel,
                    "status": "requested",
                    "notes": notes,
                    "metadata": metadata or {},
                }
            )
            .execute()
        )
        if result.data:
            return str(result.data[0].get("id", ""))
        return None

    def update_consultation_status(
        self,
        consultation_id: str,
        new_status: str,
        notes: Optional[str] = None,
    ) -> bool:
        if new_status not in VALID_STATUSES:
            return False

        sb = get_supabase()
        update_data: dict[str, Any] = {"status": new_status}
        if notes:
            update_data["notes"] = notes

        now = datetime.now(self._kst).isoformat()
        if new_status == "scheduled":
            update_data["scheduled_at"] = now
        elif new_status in ("completed", "contracted", "lost"):
            update_data["completed_at"] = now

        result = (
            sb.table("marketing_consultations")
            .update(update_data)
            .eq("id", consultation_id)
            .execute()
        )
        return bool(result.data)

    def list_consultations(
        self,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        sb = get_supabase()
        query = (
            sb.table("marketing_consultations")
            .select("*")
            .order("requested_at", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data or []

    def get_consultation(self, consultation_id: str) -> Optional[dict[str, Any]]:
        sb = get_supabase()
        result = (
            sb.table("marketing_consultations")
            .select("*")
            .eq("id", consultation_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    def get_persona_dm(self, username: str, persona_type: Optional[str] = None) -> str:
        template = PERSONA_DM_TEMPLATES.get(persona_type or "", DEFAULT_DM_TEMPLATE)
        return template.format(username=username)

    def send_conversion_discord_alert(
        self, lead: dict[str, Any], consultation_id: str
    ) -> None:
        username = lead.get("username", "unknown")
        score = lead.get("score", 0)
        persona = lead.get("persona_type") or "미분류"
        stage = lead.get("journey_stage", "unknown")
        meta = lead.get("metadata") or {}
        encounters = meta.get("encounters", 0)
        sources = meta.get("sources", [])
        by_comp = meta.get("by_competitor", {})
        comp_names = list(by_comp.keys()) if isinstance(by_comp, dict) else []

        msg = (
            f"🎯 **상담 요청 발생**\n"
            f"리드: @{username} | 스코어: {score} | 페르소나: {persona}\n"
            f"여정 단계: {stage} | 접촉 횟수: {encounters}\n"
            f"수집 경로: {', '.join(sources) if sources else 'N/A'}\n"
            f"경쟁사: {', '.join(comp_names) if comp_names else 'N/A'}\n"
            f"상담 ID: {consultation_id}"
        )
        self.discord.send_alert("hot_lead", msg)
