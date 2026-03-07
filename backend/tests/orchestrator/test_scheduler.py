from unittest.mock import MagicMock

from app.orchestrator.scheduler import WeetScheduler


def create_scheduler(dry_run: bool = False) -> WeetScheduler:
    runner = MagicMock()
    return WeetScheduler(runner=runner, dry_run=dry_run)


def test_setup_jobs_registers_jobs() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert len(scheduler.get_job_ids()) >= 11


def test_scheduler_has_daily_reset_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "daily_reset" in scheduler.get_job_ids()


def test_scheduler_has_weekly_report_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "weekly_report" in scheduler.get_job_ids()


def test_scheduler_has_monthly_analysis_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "monthly_analysis" in scheduler.get_job_ids()


def test_dry_run_flag_stored() -> None:
    scheduler = create_scheduler(dry_run=True)

    assert scheduler.dry_run is True


# ── Wave 3: Scheduler Rewiring Tests ───────────────────────────────────────

import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture
def scheduler() -> WeetScheduler:
    runner = MagicMock()
    return WeetScheduler(runner=runner, dry_run=False)


@pytest.mark.asyncio
async def test_lead_hunt_calls_instagram_channel(scheduler):
    """_run_lead_hunt_job calls InstagramChannel lead collection methods."""
    mock_channel = AsyncMock()
    mock_channel.get_competitor_commenters.return_value = []
    mock_channel.get_competitor_likers.return_value = []

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    with (
        patch("app.channels.instagram.InstagramChannel", return_value=mock_channel),
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
    ):
        await scheduler._run_lead_hunt_job()

    mock_channel.get_competitor_commenters.assert_called_once()
    mock_channel.get_competitor_likers.assert_called_once()


@pytest.mark.asyncio
async def test_lead_hunt_records_metrics(scheduler):
    """_run_lead_hunt_job records collected lead count in daily_metrics."""
    from app.channels.instagram import LeadCandidate

    mock_lead = LeadCandidate(username="귀촌유저", source="competitor_comment")

    mock_channel = AsyncMock()
    mock_channel.get_competitor_commenters.return_value = [mock_lead]
    mock_channel.get_competitor_likers.return_value = []

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.engage_instagram_follow = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    with (
        patch("app.channels.instagram.InstagramChannel", return_value=mock_channel),
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
        patch.object(
            scheduler,
            "_execute_openclaw_call",
            new_callable=AsyncMock,
            return_value={"success": True, "content": ""},
        ),
    ):
        await scheduler._run_lead_hunt_job()

    mock_metric.assert_called_with("leads_collected", 1)


@pytest.mark.asyncio
async def test_content_publish_instagram_feed_format(scheduler):
    """_run_content_publish_job calls publish_instagram_feed for feed format."""
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.publish_instagram_feed = AsyncMock(
        return_value={"success": True, "content": ""}
    )
    mock_bridge.publish_content = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"metadata": {"format_type": "feed"}, "caption": "테스트 캡션"}
    ]

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric"),
        patch.object(
            scheduler,
            "_execute_openclaw_call",
            new_callable=AsyncMock,
            return_value={"success": True, "content": ""},
        ),
    ):
        await scheduler._run_content_publish_job()


@pytest.mark.asyncio
async def test_content_publish_default_feed_fallback(scheduler):
    """_run_content_publish_job defaults to feed when no format_type in metadata."""
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"metadata": {}, "caption": ""}  # no format_type
    ]

    execute_calls = []

    async def capture_call(job, op_name, operation):
        execute_calls.append(op_name)
        return {"success": True, "content": ""}

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric"),
        patch.object(scheduler, "_execute_openclaw_call", side_effect=capture_call),
    ):
        await scheduler._run_content_publish_job()

    # Instagram channel should use feed format (default)
    instagram_calls = [c for c in execute_calls if "instagram" in c]
    assert any("feed" in c for c in instagram_calls)


@pytest.mark.asyncio
async def test_evening_followup_uses_engagement(scheduler):
    """_run_evening_followup_job queries DB and calls engage_instagram_follow."""
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.engage_instagram_follow = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": 101, "username": "귀촌유저1", "source": "competitor_comment"},
        {"id": 102, "username": "귀촌유저2", "source": "hashtag"},
    ]

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
        patch.object(
            scheduler,
            "_execute_openclaw_call",
            new_callable=AsyncMock,
            return_value={"success": True, "content": ""},
        ),
    ):
        await scheduler._run_evening_followup_job()

    mock_metric.assert_called_with("proposals_made", 2)
