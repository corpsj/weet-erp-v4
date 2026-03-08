from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.workflows.approval import ApprovalWorkflow


@pytest.fixture
def notifier():
    return MagicMock()


@pytest.mark.asyncio
async def test_on_proposal_created_sends_notifier(notifier):
    notifier.send_proposal.return_value = True
    workflow = ApprovalWorkflow(notifier=notifier)

    result = await workflow.on_proposal_created(
        {
            "id": 1,
            "title": "블로그 제안",
            "action_type": "content",
            "content_draft": "초안",
            "urgency": "high",
        }
    )

    assert result is True
    notifier.send_proposal.assert_called_once()


@pytest.mark.asyncio
async def test_on_reaction_approve(notifier):
    executor = MagicMock()
    executor.execute = AsyncMock(return_value=SimpleNamespace(success=True))
    workflow = ApprovalWorkflow(notifier=notifier, executor=executor)

    result = await workflow.on_reaction(10, "approve")

    assert result.action == "approved"
    assert result.success is True
    assert result.executed is True
    executor.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_on_reaction_reject(notifier):
    workflow = ApprovalWorkflow(notifier=notifier)

    result = await workflow.on_reaction(20, "reject")

    assert result.action == "rejected"
    assert result.success is True


@pytest.mark.asyncio
async def test_on_reaction_modify(notifier):
    workflow = ApprovalWorkflow(notifier=notifier)

    result = await workflow.on_reaction(30, "modify")

    assert result.action == "modified"
    assert result.success is True
    notifier.send_alert.assert_called_once()


@pytest.mark.asyncio
async def test_on_dashboard_action_approve_notifies(notifier):
    executor = MagicMock()
    executor.execute = AsyncMock(return_value=SimpleNamespace(success=True))
    workflow = ApprovalWorkflow(notifier=notifier, executor=executor)

    result = await workflow.on_dashboard_action(40, "approve")

    assert result.action == "approved"
    assert result.success is True
    notifier.send_alert.assert_called_once()


@pytest.mark.asyncio
async def test_on_dashboard_action_reject_with_reason(notifier):
    workflow = ApprovalWorkflow(notifier=notifier)

    result = await workflow.on_dashboard_action(
        50,
        "reject",
        data={"reason": "우선순위 낮음"},
    )

    assert result.action == "rejected"
    assert result.success is True
    notifier.send_alert.assert_called_once()
