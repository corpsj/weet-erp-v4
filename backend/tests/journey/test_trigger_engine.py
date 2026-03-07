from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.journey.manager import Action, JourneyManager
from app.journey.trigger_engine import TriggerEngine


@pytest.fixture
def engine() -> TriggerEngine:
    llm_service = MagicMock()
    llm_service.generate = MagicMock(return_value="안녕하세요, 위트입니다.")
    discord_bot = MagicMock()
    discord_bot.send_alert = MagicMock(return_value=True)
    manager = JourneyManager(
        llm_service=llm_service, discord_bot=discord_bot, db_session=None
    )
    return TriggerEngine(journey_manager=manager)


def test_default_triggers_registered(engine: TriggerEngine) -> None:
    names = [trigger.name for trigger in engine.triggers]
    assert len(engine.triggers) == 5
    assert set(names) == {
        "follow_event",
        "profile_visit",
        "silence_3day",
        "silence_7day",
        "handoff_signal",
    }


@pytest.mark.asyncio
async def test_handoff_signal_blocks_dms(engine: TriggerEngine) -> None:
    lead = {
        "id": 1,
        "username": "test_user",
        "journey_stage": "interest",
        "last_action_at": datetime.now(timezone.utc) - timedelta(days=5),
        "last_message": "전화로 상담 받고 싶어요",
        "latest_event": "follow",
    }

    actions: list[Action] = await engine.evaluate(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_alert"
    assert actions[0].requires_human is True


@pytest.mark.asyncio
async def test_silence_3day_trigger(engine: TriggerEngine) -> None:
    lead = {
        "id": 2,
        "username": "quiet_user",
        "journey_stage": "compare",
        "last_action_at": datetime.now(timezone.utc) - timedelta(days=4),
        "last_message": "",
    }

    actions: list[Action] = await engine.evaluate(lead)

    assert len(actions) == 1
    assert actions[0].action_type == "send_dm"
    assert "리마인드" in actions[0].message


def test_priority_ordering(engine: TriggerEngine) -> None:
    sorted_names = [trigger.name for trigger in engine.triggers]
    assert sorted_names[0] == "handoff_signal"
    assert sorted_names.index("follow_event") < sorted_names.index("silence_3day")


@pytest.mark.asyncio
async def test_evaluate_returns_empty_for_fresh_lead(engine: TriggerEngine) -> None:
    lead = {
        "id": 3,
        "username": "fresh_user",
        "journey_stage": "awareness",
        "last_action_at": None,
        "last_message": "",
    }

    actions: list[Action] = await engine.evaluate(lead)

    assert actions == []
