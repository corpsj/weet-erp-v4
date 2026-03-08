from unittest.mock import AsyncMock, MagicMock

import pytest

from app.workflows.executor import ActionExecutor


@pytest.fixture
def notifier():
    return MagicMock()


@pytest.mark.asyncio
async def test_execute_content_proposal(notifier):
    executor = ActionExecutor(notifier=notifier)
    proposal = {
        "id": 1,
        "action_type": "content",
        "content_draft": "이동식주택 콘텐츠 초안",
        "title": "콘텐츠 실행",
    }

    result = await executor.execute(proposal)

    assert result.success is True
    assert result.action_type == "content"
    assert "콘텐츠 생성 완료" in result.output


@pytest.mark.asyncio
async def test_execute_outreach_proposal(notifier):
    executor = ActionExecutor(notifier=notifier)
    proposal = {"id": 2, "action_type": "outreach", "title": "아웃리치 실행"}

    result = await executor.execute(proposal)

    assert result.success is True
    assert result.action_type == "outreach"
    assert "아웃리치 메시지 생성" in result.output


@pytest.mark.asyncio
async def test_execute_duplicate_prevention(notifier):
    executor = ActionExecutor(notifier=notifier)
    proposal = {"id": 3, "action_type": "strategy", "title": "중복 테스트"}

    first = await executor.execute(proposal)
    second = await executor.execute(proposal)

    assert first.success is True
    assert second.success is False
    assert second.error == "Already executed"


@pytest.mark.asyncio
async def test_execute_sends_notifier_report(notifier):
    executor = ActionExecutor(notifier=notifier)
    proposal = {"id": 4, "action_type": "urgent", "title": "리포트 테스트"}

    result = await executor.execute(proposal)

    assert result.success is True
    assert notifier.send_alert.call_count >= 1
    last_args = notifier.send_alert.call_args_list[-1][0]
    assert last_args[0] == "market_change"


@pytest.mark.asyncio
async def test_execute_failure_sends_notifier_alert(notifier):
    executor = ActionExecutor(notifier=notifier)
    executor._execute_content = AsyncMock(side_effect=RuntimeError("boom"))
    proposal = {"id": 5, "action_type": "content", "title": "실패 테스트"}

    result = await executor.execute(proposal)

    assert result.success is False
    assert result.error == "boom"
    alert_args = notifier.send_alert.call_args[0]
    assert alert_args[0] == "error"
