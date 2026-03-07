from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.journey.manager import Action, JourneyManager, JourneyStage


@dataclass
class DummyLead:
    journey_stage: str


@pytest.fixture
def manager() -> JourneyManager:
    llm_service = MagicMock()
    llm_service.generate = MagicMock(return_value="안녕하세요, 위트입니다.")
    notifier = MagicMock()
    notifier.send_alert = MagicMock(return_value=True)
    return JourneyManager(llm_service=llm_service, notifier=notifier, db_session=None)


@pytest.mark.asyncio
async def test_update_stage_changes_stage():
    lead = DummyLead(journey_stage="awareness")
    db_session = MagicMock()
    db_session.get = AsyncMock(return_value=lead)
    db_session.commit = AsyncMock(return_value=None)
    manager = JourneyManager(
        llm_service=MagicMock(),
        notifier=MagicMock(),
        db_session=db_session,
    )

    result = await manager.update_stage(lead_id=1, new_stage=JourneyStage.INTEREST)

    assert result is True
    assert lead.journey_stage == JourneyStage.INTEREST.value


@pytest.mark.asyncio
async def test_check_triggers_follow_event(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "awareness",
        "last_action_at": None,
        "latest_event": "follow",
    }

    actions: list[Action] = await manager.check_triggers(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_dm"


@pytest.mark.asyncio
async def test_check_triggers_handoff_keyword(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "explore",
        "last_action_at": datetime.now(timezone.utc) - timedelta(days=10),
        "last_message": "견적 문의 드립니다",
        "latest_event": "follow",
    }

    actions: list[Action] = await manager.check_triggers(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_alert"
    assert actions[0].requires_human is True
    assert all(action.action_type != "send_dm" for action in actions)


@pytest.mark.asyncio
async def test_check_triggers_3day_silence(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "explore",
        "last_action_at": datetime.now(timezone.utc) - timedelta(days=4),
    }

    actions: list[Action] = await manager.check_triggers(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_dm"
    assert "리마인드" in actions[0].message


@pytest.mark.asyncio
async def test_check_triggers_7day_silence(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "hesitate",
        "last_action_at": datetime.now(timezone.utc) - timedelta(days=8),
    }

    actions: list[Action] = await manager.check_triggers(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_dm"
    assert "사례" in actions[0].message


@pytest.mark.asyncio
async def test_dm_cooldown_enforced(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "interest",
        "last_action_at": datetime.now(timezone.utc) - timedelta(hours=5),
        "latest_event": "profile_visit",
    }

    actions: list[Action] = await manager.check_triggers(lead)

    assert actions == []


@pytest.mark.asyncio
async def test_generate_nurture_message_returns_korean(manager: JourneyManager) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "persona_type": "lifestyle",
    }

    message = await manager.generate_nurture_message(lead, JourneyStage.EXPLORE)

    assert isinstance(message, str)
    assert "안녕하세요" in message
    generate_mock = cast(MagicMock, manager.llm_service.generate)
    generate_mock.assert_called_once()


def test_expanded_handoff_keywords() -> None:
    for keyword in ["상담", "방문", "구경", "실물", "모델하우스", "평수", "평형"]:
        assert keyword in JourneyManager.HANDOFF_KEYWORDS
