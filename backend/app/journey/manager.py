from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Protocol, cast

from app.db.models import Lead


class JourneyStage(str, Enum):
    AWARENESS = "awareness"
    INTEREST = "interest"
    EXPLORE = "explore"
    COMPARE = "compare"
    HESITATE = "hesitate"
    DECIDE = "decide"
    CONTRACT = "contract"


@dataclass
class Action:
    action_type: str
    message: str
    urgency: str = "normal"
    requires_human: bool = False


class JourneyManager:
    HANDOFF_KEYWORDS: list[str] = [
        "가격",
        "견적",
        "계약",
        "전화",
        "상담",
        "방문",
        "구경",
        "실물",
        "모델하우스",
        "평수",
        "평형",
    ]
    DM_COOLDOWN_HOURS: int = 24

    def __init__(
        self,
        llm_service: "LLMClient",
        notifier: "NotifierClient",
        db_session: "DBSession | None" = None,
    ):
        self.llm_service: LLMClient = llm_service
        self.notifier: NotifierClient = notifier
        self.db_session: DBSession | None = db_session

    async def update_stage(self, lead_id: int, new_stage: JourneyStage) -> bool:
        if not self.db_session:
            return False

        lead = await self.db_session.get(Lead, lead_id)
        if not lead:
            return False

        setattr(lead, "journey_stage", new_stage.value)
        await self.db_session.commit()
        return True

    async def check_triggers(self, lead: object) -> list[Action]:
        last_message = str(self._value(lead, "last_message", "") or "")
        if any(keyword in last_message for keyword in self.HANDOFF_KEYWORDS):
            username = self._value(lead, "username", "unknown")
            msg = f"@{username} 리드에서 상담 요청 신호 감지: {last_message}"
            _ = self.notifier.send_alert("urgent", msg)
            return [
                Action(
                    action_type="send_alert",
                    message=msg,
                    urgency="urgent",
                    requires_human=True,
                )
            ]

        if self._is_dm_cooldown(lead):
            return []

        stage = self._stage(lead)
        actions: list[Action] = []

        if self._has_event(lead, "follow"):
            message = await self.generate_nurture_message(lead, JourneyStage.AWARENESS)
            actions.append(Action(action_type="send_dm", message=message))
            if stage == JourneyStage.AWARENESS:
                await self._update_lead_stage_if_possible(lead, JourneyStage.INTEREST)
            return actions

        if self._has_event(lead, "profile_visit"):
            message = await self.generate_nurture_message(lead, JourneyStage.INTEREST)
            actions.append(Action(action_type="send_dm", message=message))
            if stage == JourneyStage.INTEREST:
                await self._update_lead_stage_if_possible(lead, JourneyStage.EXPLORE)
            return actions

        days = self._days_since_last_action(lead)
        if days >= 3 and stage in {JourneyStage.EXPLORE, JourneyStage.COMPARE}:
            actions.append(
                Action(
                    action_type="send_dm",
                    message="리마인드: 위트 이동식주택 도입 사례와 정보가 필요하시면 도와드릴게요.",
                )
            )
            return actions

        if days >= 7 and stage == JourneyStage.HESITATE:
            actions.append(
                Action(
                    action_type="send_dm",
                    message="사례 공유: 실제 설치 사례와 계약 전 체크리스트를 안내해드릴게요.",
                )
            )
            return actions

        return actions

    async def generate_nurture_message(self, lead: object, stage: JourneyStage) -> str:
        username = self._value(lead, "username", "고객")
        persona = self._value(lead, "persona_type", "일반")
        prompt = (
            "당신은 (주)위트 이동식주택 마케팅 매니저입니다. "
            "한국어로만 2문장 이내의 따뜻하고 간결한 DM을 작성하세요. "
            f"리드: @{username}, 페르소나: {persona}, 현재 단계: {stage.value}. "
            "가격/견적/계약/전화 직접 제안은 하지 말고 자연스럽게 관심을 유도하세요."
        )
        message = self.llm_service.generate(prompt)
        return str(message)

    def _value(
        self, lead: object, key: str, default: object | None = None
    ) -> object | None:
        if isinstance(lead, dict):
            typed = cast(dict[str, object], lead)
            return typed.get(key, default)
        return getattr(lead, key, default)

    def value(
        self, lead: object, key: str, default: object | None = None
    ) -> object | None:
        return self._value(lead, key, default)

    def _stage(self, lead: object) -> JourneyStage:
        raw = str(self._value(lead, "journey_stage", JourneyStage.AWARENESS.value))
        try:
            return JourneyStage(raw)
        except ValueError:
            return JourneyStage.AWARENESS

    def _has_event(self, lead: object, event_name: str) -> bool:
        latest_event = self._value(lead, "latest_event", None)
        if latest_event == event_name:
            return True

        event = self._value(lead, "event", None)
        if event == event_name:
            return True

        metadata_obj = self._value(lead, "metadata_", {})
        metadata: dict[str, object]
        if isinstance(metadata_obj, dict):
            metadata = cast(dict[str, object], metadata_obj)
        else:
            metadata = {}
        if metadata.get("latest_event") == event_name:
            return True

        return False

    def has_event(self, lead: object, event_name: str) -> bool:
        return self._has_event(lead, event_name)

    def _days_since_last_action(self, lead: object) -> float:
        last_action_at = self._value(lead, "last_action_at", None)
        if not isinstance(last_action_at, datetime):
            return 0.0
        now = self._now_like(last_action_at)
        return (now - last_action_at).total_seconds() / 86400.0

    def _is_dm_cooldown(self, lead: object) -> bool:
        last_action_at = self._value(lead, "last_action_at", None)
        if not isinstance(last_action_at, datetime):
            return False
        now = self._now_like(last_action_at)
        return now - last_action_at < timedelta(hours=self.DM_COOLDOWN_HOURS)

    async def _update_lead_stage_if_possible(
        self,
        lead: object,
        target_stage: JourneyStage,
    ) -> None:
        lead_id = self._value(lead, "id", None)
        if lead_id is not None:
            if isinstance(lead_id, int):
                _ = await self.update_stage(lead_id, target_stage)

        if isinstance(lead, dict):
            lead["journey_stage"] = target_stage.value
            return

        if hasattr(lead, "journey_stage"):
            setattr(lead, "journey_stage", target_stage.value)

    def _now_like(self, sample: datetime) -> datetime:
        if sample.tzinfo:
            return datetime.now(sample.tzinfo)
        return datetime.now(timezone.utc).replace(tzinfo=None)


class LLMClient(Protocol):
    def generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> str: ...


class DiscordClient(Protocol):
    def send_alert(self, alert_type: str, message: str) -> bool: ...


class DBSession(Protocol):
    async def get(self, model: type[Lead], ident: int) -> object | None: ...

    async def commit(self) -> None: ...
