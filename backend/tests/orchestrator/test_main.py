from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.orchestrator.main import run_once


@pytest.mark.asyncio
async def test_run_once_includes_dm_monitor_step() -> None:
    mock_runner = MagicMock()
    mock_runner.run = AsyncMock(return_value=MagicMock(success=True, error=None))
    mock_runner.get_log.return_value = []

    mock_scheduler = MagicMock()
    mock_scheduler._run_daily_reset_job = AsyncMock()
    mock_scheduler._run_market_scan_job = AsyncMock()
    mock_scheduler._run_suggestion_job = AsyncMock()
    mock_scheduler._run_daily_report_job = AsyncMock()
    mock_scheduler._run_journey_check_job = AsyncMock()
    mock_scheduler._run_content_generate_job = AsyncMock()
    mock_scheduler._run_content_publish_job = AsyncMock()
    mock_scheduler._run_lead_hunt_job = AsyncMock()
    mock_scheduler._run_dm_monitor_job = AsyncMock()
    mock_scheduler._run_evening_followup_job = AsyncMock()
    mock_scheduler._run_content_engagement_job = AsyncMock()
    mock_scheduler._run_content_feedback_job = AsyncMock()

    with (
        patch("app.orchestrator.main.TaskRunner", return_value=mock_runner),
        patch("app.orchestrator.main.WeetScheduler", return_value=mock_scheduler),
    ):
        await run_once(dry_run=True)

    task_names = [call.args[0] for call in mock_runner.run.call_args_list]
    assert "dm_monitor" in task_names
    assert task_names.index("dm_monitor") < task_names.index("evening_followup")
    assert task_names.index("evening_followup") < task_names.index("content_engagement")
    assert task_names.index("content_engagement") < task_names.index("content_feedback")
