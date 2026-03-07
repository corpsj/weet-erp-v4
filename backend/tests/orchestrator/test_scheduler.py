from unittest.mock import MagicMock

from app.orchestrator.scheduler import WeetScheduler


def create_scheduler(dry_run: bool = False) -> WeetScheduler:
    runner = MagicMock()
    return WeetScheduler(runner=runner, dry_run=dry_run)


def test_setup_jobs_registers_jobs() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert len(scheduler.get_job_ids()) >= 12


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
    """_run_evening_followup_job queries warm/hot/super_hot leads and engages."""
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.engage_instagram_like = AsyncMock(
        return_value={"success": True, "content": ""}
    )
    mock_bridge.engage_instagram_follow = AsyncMock(
        return_value={"success": True, "content": ""}
    )
    mock_bridge.engage_instagram_dm = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    mock_execute_result = MagicMock()

    warm_result = MagicMock()
    warm_result.data = [
        {"id": 101, "username": "웜유저", "score": 12, "metadata": {}},
    ]
    hot_result = MagicMock()
    hot_result.data = [
        {
            "id": 201,
            "username": "핫유저",
            "score": 25,
            "journey_stage": "explore",
            "persona_type": "귀촌",
        },
    ]
    super_result = MagicMock()
    super_result.data = [
        {
            "id": 301,
            "username": "슈퍼핫",
            "score": 35,
            "journey_stage": "compare",
            "persona_type": "세컨드",
        },
    ]

    mock_sb = MagicMock()
    call_count = {"n": 0}
    original_table = mock_sb.table

    def table_side_effect(name):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain

        call_count["n"] += 1
        if call_count["n"] == 1:
            chain.execute.return_value = warm_result
        elif call_count["n"] == 2:
            chain.execute.return_value = hot_result
        else:
            chain.execute.return_value = super_result
        return chain

    mock_sb.table.side_effect = table_side_effect

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

    mock_metric.assert_called_with("proposals_made", 3)


def test_manual_collect_job_registered():
    scheduler = create_scheduler()
    scheduler.setup_jobs()
    assert "manual_lead_collect" in scheduler.get_job_ids()


@pytest.mark.asyncio
async def test_manual_collect_skips_when_no_flag(scheduler):
    with patch.object(scheduler, "_check_manual_collect_flag", return_value=False):
        await scheduler._job_manual_lead_collect()


@pytest.mark.asyncio
async def test_manual_collect_runs_when_flag_set():
    runner = AsyncMock()
    scheduler = WeetScheduler(runner=runner, dry_run=False)

    mock_channel = AsyncMock()
    mock_channel.get_competitor_commenters.return_value = []
    mock_channel.get_competitor_likers.return_value = []

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    with (
        patch.object(scheduler, "_check_manual_collect_flag", return_value=True),
        patch.object(scheduler, "_clear_manual_collect_flag") as mock_clear,
        patch("app.channels.instagram.InstagramChannel", return_value=mock_channel),
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
    ):
        await scheduler._job_manual_lead_collect()

    mock_clear.assert_called_once()


def test_pick_content_topic_uses_signal_keywords(scheduler):
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"keywords": ["이동식주택", "모듈러"], "title": "A"},
        {"keywords": ["이동식주택", "전원생활"], "title": "B"},
    ]

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        topic, keywords = scheduler._pick_content_topic(mock_sb)

    assert topic == "이동식주택"
    assert keywords[0] == "이동식주택"
    assert len(keywords) <= 3


def test_pick_content_topic_falls_back_to_evergreen(scheduler):
    evergreen = [
        ("이동식주택 실거주 후기", ["이동식주택", "전원생활", "모듈러주택"]),
        ("모듈러주택 비용 비교", ["모듈러주택", "건축비용", "이동식주택"]),
        ("귀촌 준비 체크리스트", ["귀촌", "전원주택", "세컨하우스"]),
        ("농막 vs 이동식주택 차이", ["농막", "이동식주택", "컨테이너하우스"]),
        ("소형주택 트렌드", ["소형주택", "미니멀하우스", "1인가구"]),
    ]

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        picked = scheduler._pick_content_topic(mock_sb)

    assert picked in evergreen


def test_pick_content_topic_handles_db_error(scheduler):
    evergreen = [
        ("이동식주택 실거주 후기", ["이동식주택", "전원생활", "모듈러주택"]),
        ("모듈러주택 비용 비교", ["모듈러주택", "건축비용", "이동식주택"]),
        ("귀촌 준비 체크리스트", ["귀촌", "전원주택", "세컨하우스"]),
        ("농막 vs 이동식주택 차이", ["농막", "이동식주택", "컨테이너하우스"]),
        ("소형주택 트렌드", ["소형주택", "미니멀하우스", "1인가구"]),
    ]

    mock_sb = MagicMock()
    mock_sb.table.side_effect = Exception("db unavailable")

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        picked = scheduler._pick_content_topic(mock_sb)

    assert picked in evergreen


@pytest.mark.asyncio
async def test_journey_awareness_to_interest(scheduler):
    lead_data = {
        "id": 1,
        "username": "lead1",
        "score": 8,
        "status": "new",
        "journey_stage": "awareness",
        "metadata": {"encounters": 1, "sources": []},
        "last_action_at": None,
    }

    mock_sb = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[lead_data]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_journey_check_job()

    changes = update_chain.update.call_args[0][0]
    assert changes["journey_stage"] == "interest"
    assert changes["status"] == "contacted"


@pytest.mark.asyncio
async def test_journey_interest_to_explore(scheduler):
    lead_data = {
        "id": 2,
        "username": "lead2",
        "score": 15,
        "status": "contacted",
        "journey_stage": "interest",
        "metadata": {"encounters": 1, "sources": ["competitor_comment"]},
        "last_action_at": None,
    }

    mock_sb = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[lead_data]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_journey_check_job()

    changes = update_chain.update.call_args[0][0]
    assert changes["journey_stage"] == "explore"


@pytest.mark.asyncio
async def test_journey_explore_to_compare(scheduler):
    lead_data = {
        "id": 3,
        "username": "lead3",
        "score": 22,
        "status": "contacted",
        "journey_stage": "explore",
        "metadata": {
            "encounters": 2,
            "sources": ["competitor_comment"],
            "by_competitor": {"comp_a": {"count": 1}, "comp_b": {"count": 1}},
        },
        "last_action_at": None,
    }

    mock_sb = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[lead_data]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_journey_check_job()

    changes = update_chain.update.call_args[0][0]
    assert changes["journey_stage"] == "compare"
    assert changes["status"] == "hot"


@pytest.mark.asyncio
async def test_journey_compare_to_hesitate(scheduler):
    lead_data = {
        "id": 4,
        "username": "lead4",
        "score": 30,
        "status": "hot",
        "journey_stage": "compare",
        "metadata": {"encounters": 1, "sources": ["competitor_comment"]},
        "last_action_at": None,
    }

    mock_sb = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[lead_data]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_journey_check_job()

    changes = update_chain.update.call_args[0][0]
    assert changes["journey_stage"] == "hesitate"
    assert changes["status"] == "super_hot"


@pytest.mark.asyncio
async def test_journey_hesitate_to_decide(scheduler):
    lead_data = {
        "id": 5,
        "username": "lead5",
        "score": 35,
        "status": "super_hot",
        "journey_stage": "hesitate",
        "metadata": {"encounters": 1, "sources": ["competitor_comment"]},
        "last_action_at": None,
    }

    mock_sb = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[lead_data]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_journey_check_job()

    changes = update_chain.update.call_args[0][0]
    assert changes["journey_stage"] == "decide"


@pytest.mark.asyncio
async def test_proposal_execute_content_with_draft(scheduler):
    proposal = {
        "id": 11,
        "title": "제안 제목",
        "action_type": "content",
        "content_draft": "초안 텍스트",
        "status": "approved",
    }

    mock_sb = MagicMock()

    proposals_chain = MagicMock()
    proposals_chain.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[proposal]
    )

    contents_chain = MagicMock()
    contents_chain.insert.return_value.execute.return_value = MagicMock()

    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return proposals_chain
        if call_count["n"] == 2:
            return contents_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_proposal_execute_job()

    content_payload = contents_chain.insert.call_args[0][0]
    assert content_payload["body"] == "초안 텍스트"
    proposal_payload = update_chain.update.call_args[0][0]
    assert proposal_payload["status"] == "executed"


@pytest.mark.asyncio
async def test_proposal_execute_outreach(scheduler):
    proposal = {
        "id": 12,
        "title": "아웃리치 제안",
        "action_type": "outreach",
        "content_draft": "",
        "status": "approved",
    }
    hot_lead = {"id": 777, "username": "hot_user"}

    mock_sb = MagicMock()

    proposals_chain = MagicMock()
    proposals_chain.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[proposal]
    )

    leads_chain = MagicMock()
    leads_chain.select.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[hot_lead]
    )

    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return proposals_chain
        if call_count["n"] == 2:
            return leads_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.engage_instagram_follow = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_proposal_execute_job()

    mock_bridge.engage_instagram_follow.assert_called_once_with("777")
    proposal_payload = update_chain.update.call_args[0][0]
    assert proposal_payload["status"] == "executed"


@pytest.mark.asyncio
async def test_proposal_execute_handles_failure(scheduler):
    proposal = {
        "id": 13,
        "title": "실패 제안",
        "action_type": "content",
        "content_draft": "",
        "status": "approved",
    }

    mock_sb = MagicMock()

    proposals_chain = MagicMock()
    proposals_chain.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[proposal]
    )

    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return proposals_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()
    mock_gen.generate_instagram_caption = AsyncMock(side_effect=Exception("gen fail"))

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_proposal_execute_job()

    proposal_payload = update_chain.update.call_args[0][0]
    assert proposal_payload["status"] == "execution_failed"
