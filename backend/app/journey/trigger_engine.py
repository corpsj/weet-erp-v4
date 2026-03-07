from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from app.journey.manager import Action, JourneyManager, JourneyStage


@dataclass
class Trigger:
    name: str
    condition: Callable[[object], bool]
    action_type: str
    priority: int = 0


class TriggerEngine:
    def __init__(self, journey_manager: JourneyManager):
        self.journey_manager: JourneyManager = journey_manager
        self._triggers: list[Trigger] = []
        self._register_default_triggers()

    def register_trigger(self, trigger: Trigger) -> None:
        self._triggers.append(trigger)
        self._triggers.sort(key=lambda item: item.priority, reverse=True)

    @property
    def triggers(self) -> list[Trigger]:
        return list(self._triggers)

    def _register_default_triggers(self) -> None:
        self.register_trigger(
            Trigger(
                name="follow_event",
                condition=lambda lead: self.journey_manager.has_event(lead, "follow"),
                action_type="welcome_dm",
                priority=10,
            )
        )
        self.register_trigger(
            Trigger(
                name="profile_visit",
                condition=lambda lead: self.journey_manager.has_event(
                    lead, "profile_visit"
                ),
                action_type="info_dm",
                priority=9,
            )
        )
        self.register_trigger(
            Trigger(
                name="silence_3day",
                condition=lambda lead: (
                    self.days_since_last_action(lead) >= 3
                    and str(self.journey_manager.value(lead, "journey_stage", ""))
                    in {JourneyStage.EXPLORE.value, JourneyStage.COMPARE.value}
                ),
                action_type="reminder_dm",
                priority=5,
            )
        )
        self.register_trigger(
            Trigger(
                name="silence_7day",
                condition=lambda lead: (
                    self.days_since_last_action(lead) >= 7
                    and str(self.journey_manager.value(lead, "journey_stage", ""))
                    == JourneyStage.HESITATE.value
                ),
                action_type="case_study_dm",
                priority=5,
            )
        )
        self.register_trigger(
            Trigger(
                name="handoff_signal",
                condition=lambda lead: any(
                    keyword
                    in str(self.journey_manager.value(lead, "last_message", "") or "")
                    for keyword in self.journey_manager.HANDOFF_KEYWORDS
                ),
                action_type="human_alert",
                priority=20,
            )
        )

    async def evaluate(self, lead: object) -> list[Action]:
        actions: list[Action] = []

        for trigger in self._triggers:
            if not trigger.condition(lead):
                continue

            if trigger.name == "handoff_signal":
                username = self.journey_manager.value(lead, "username", "unknown")
                message = str(
                    self.journey_manager.value(lead, "last_message", "") or ""
                )
                alert_message = f"@{username} 리드에서 상담 요청 신호 감지: {message}"
                _ = self.journey_manager.notifier.send_alert("urgent", alert_message)
                return [
                    Action(
                        action_type="send_alert",
                        message=alert_message,
                        urgency="urgent",
                        requires_human=True,
                    )
                ]

            if trigger.name == "follow_event":
                dm = await self.journey_manager.generate_nurture_message(
                    lead, JourneyStage.AWARENESS
                )
                return [Action(action_type="send_dm", message=dm)]

            if trigger.name == "profile_visit":
                dm = await self.journey_manager.generate_nurture_message(
                    lead, JourneyStage.INTEREST
                )
                return [Action(action_type="send_dm", message=dm)]

            if trigger.name == "silence_3day":
                return [
                    Action(
                        action_type="send_dm",
                        message="리마인드: 위트 이동식주택 도입 사례와 정보가 필요하시면 도와드릴게요.",
                    )
                ]

            if trigger.name == "silence_7day":
                return [
                    Action(
                        action_type="send_dm",
                        message="사례 공유: 실제 설치 사례와 계약 전 체크리스트를 안내해드릴게요.",
                    )
                ]

        return actions

    def days_since_last_action(self, lead: object) -> float:
        last_action_at = self.journey_manager.value(lead, "last_action_at", None)
        if not isinstance(last_action_at, datetime):
            return 0.0
        now = self._now_like(last_action_at)
        return (now - last_action_at).total_seconds() / 86400.0

    def _now_like(self, sample: datetime) -> datetime:
        if sample.tzinfo:
            return datetime.now(sample.tzinfo)
        return datetime.now(timezone.utc).replace(tzinfo=None)
