from unittest.mock import MagicMock
from typing import Any

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


def test_scheduler_has_dm_monitor_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "dm_monitor" in scheduler.get_job_ids()


def test_dry_run_flag_stored() -> None:
    scheduler = create_scheduler(dry_run=True)

    assert scheduler.dry_run is True


# ── Wave 3: Scheduler Rewiring Tests ───────────────────────────────────────

import pytest
from unittest.mock import AsyncMock, call, patch


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
    mock_naver_channel = AsyncMock()
    mock_naver_channel.collect_leads.return_value = []
    mock_youtube_channel = AsyncMock()
    mock_youtube_channel.collect_leads.return_value = []

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    with (
        patch("app.channels.instagram.InstagramChannel", return_value=mock_channel),
        patch(
            "app.channels.naver_cafe.NaverCafeChannel", return_value=mock_naver_channel
        ),
        patch("app.channels.youtube.YouTubeChannel", return_value=mock_youtube_channel),
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
    ):
        await scheduler._run_lead_hunt_job()

    mock_channel.get_competitor_commenters.assert_called_once()
    mock_channel.get_competitor_likers.assert_called_once()
    mock_naver_channel.collect_leads.assert_called_once()
    mock_youtube_channel.collect_leads.assert_called_once()


@pytest.mark.asyncio
async def test_lead_hunt_records_metrics(scheduler):
    """_run_lead_hunt_job records collected lead count in daily_metrics."""
    from app.channels.instagram import LeadCandidate

    mock_lead = LeadCandidate(username="귀촌유저", source="competitor_comment")

    mock_channel = AsyncMock()
    mock_channel.get_competitor_commenters.return_value = [mock_lead]
    mock_channel.get_competitor_likers.return_value = []
    mock_naver_channel = AsyncMock()
    mock_naver_channel.collect_leads.return_value = []
    mock_youtube_channel = AsyncMock()
    mock_youtube_channel.collect_leads.return_value = []

    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()
    mock_bridge.engage_instagram_follow = AsyncMock(
        return_value={"success": True, "content": ""}
    )

    with (
        patch("app.channels.instagram.InstagramChannel", return_value=mock_channel),
        patch(
            "app.channels.naver_cafe.NaverCafeChannel", return_value=mock_naver_channel
        ),
        patch("app.channels.youtube.YouTubeChannel", return_value=mock_youtube_channel),
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
async def test_content_publish_only_publishes_approved(scheduler):
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    mock_sb = MagicMock()
    approved_chain = MagicMock()
    approved_chain.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 101,
                "channel": "instagram",
                "body": "캡션",
                "metadata": {"format_type": "feed", "media_path": "img.png"},
            },
            {
                "id": 102,
                "channel": "naver_blog",
                "body": "본문",
                "metadata": {},
            },
        ]
    )
    update_chain = MagicMock()
    update_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()

    call_count = {"contents": 0}

    def table_side_effect(name):
        if name != "marketing_contents":
            return MagicMock()
        call_count["contents"] += 1
        if call_count["contents"] == 1:
            return approved_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    execute_calls = []

    async def capture_call(job, op_name, operation):
        _ = job, operation
        execute_calls.append(op_name)
        return {"success": True, "content": ""}

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
        patch.object(scheduler, "_execute_openclaw_call", side_effect=capture_call),
    ):
        await scheduler._run_content_publish_job()

    approved_chain.select.return_value.eq.assert_called_once_with("status", "approved")
    assert "publish_feed:instagram" in execute_calls
    assert "publish_content:naver_blog" in execute_calls
    assert update_chain.update.call_count == 2
    mock_metric.assert_called_once_with("contents_published", 2)


@pytest.mark.asyncio
async def test_content_publish_skips_when_no_approved_content(scheduler):
    mock_bridge = AsyncMock()
    mock_bridge.close = AsyncMock()

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
        patch.object(
            scheduler,
            "_execute_openclaw_call",
            new_callable=AsyncMock,
            return_value={"success": True, "content": ""},
        ) as mock_execute,
    ):
        await scheduler._run_content_publish_job()

    mock_execute.assert_not_called()
    mock_metric.assert_not_called()


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
        patch("app.channels.naver_cafe.NaverCafeChannel") as mock_naver,
        patch("app.channels.youtube.YouTubeChannel") as mock_youtube,
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
    ):
        mock_naver.return_value.collect_leads = AsyncMock(return_value=[])
        mock_youtube.return_value.collect_leads = AsyncMock(return_value=[])
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
async def test_proposal_execute_approves_linked_generated_content(scheduler):
    proposal = {
        "id": 21,
        "title": "[instagram] 제안",
        "action_type": "content",
        "content_draft": "생성 초안",
        "status": "approved",
        "metadata": {"content_id": 501, "channel": "instagram", "topic": "주제"},
    }

    mock_sb = MagicMock()

    proposals_select_chain = MagicMock()
    proposals_select_chain.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[proposal]
    )

    contents_update_chain = MagicMock()
    contents_update_chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

    proposals_update_chain = MagicMock()
    proposals_update_chain.update.return_value.eq.return_value.execute.return_value = (
        MagicMock()
    )

    proposal_table_calls = {"n": 0}

    def table_side_effect(name):
        if name == "marketing_proposals":
            proposal_table_calls["n"] += 1
            if proposal_table_calls["n"] == 1:
                return proposals_select_chain
            return proposals_update_chain
        if name == "marketing_contents":
            return contents_update_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_proposal_execute_job()

    contents_update_chain.update.assert_called_once_with({"status": "approved"})
    proposals_update_payload = proposals_update_chain.update.call_args[0][0]
    assert proposals_update_payload["status"] == "executed"


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


@pytest.mark.asyncio
async def test_journey_check_creates_consultation_on_decide(scheduler):
    lead_data = {
        "id": "lead-5",
        "username": "lead5",
        "score": 35,
        "status": "super_hot",
        "journey_stage": "hesitate",
        "persona_type": "lifestyle",
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

    mock_svc = MagicMock()
    mock_svc.create_consultation.return_value = "cons-uuid"

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.conversion.consultation.ConsultationService", return_value=mock_svc),
        patch("app.conversion.consultation.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_journey_check_job()

    mock_svc.create_consultation.assert_called_once()
    called = mock_svc.create_consultation.call_args.kwargs
    assert called["lead_id"] == "lead-5"
    assert called["request_channel"] == "auto_decide"
    mock_svc.send_conversion_discord_alert.assert_called_once_with(
        lead_data, "cons-uuid"
    )


@pytest.mark.asyncio
async def test_content_generate_uses_persona(scheduler):
    mock_sb = MagicMock()

    persona_chain = MagicMock()
    persona_chain.select.return_value.neq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {"persona_type": "price_sensitive"},
            {"persona_type": "price_sensitive"},
            {"persona_type": "lifestyle"},
        ]
    )
    insert_chain = MagicMock()
    insert_chain.insert.return_value.execute.return_value = MagicMock()

    def table_side_effect(name):
        if name == "marketing_leads":
            return persona_chain
        return insert_chain

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()
    mock_gen.generate_blog_article = AsyncMock(
        return_value=MagicMock(title="t", body="b")
    )
    mock_gen.generate_instagram_caption = AsyncMock(
        return_value=MagicMock(title="t", body="b")
    )
    mock_gen.generate_cafe_post = AsyncMock(return_value=MagicMock(title="t", body="b"))

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch.object(
            scheduler, "_pick_content_topic", return_value=("주제", ["키워드"])
        ),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_content_generate_job()

    mock_gen.generate_blog_article.assert_called_once_with(
        "주제", ["키워드"], persona="price_sensitive"
    )


@pytest.mark.asyncio
async def test_content_generate_creates_pending_proposals(scheduler):
    mock_sb = MagicMock()

    persona_chain = MagicMock()
    persona_chain.select.return_value.neq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"persona_type": "lifestyle"}]
    )

    contents_chain = MagicMock()
    contents_chain.insert.return_value.execute.side_effect = [
        MagicMock(data=[{"id": 201}]),
        MagicMock(data=[{"id": 202}]),
        MagicMock(data=[{"id": 203}]),
    ]

    proposals_chain = MagicMock()
    proposals_chain.insert.return_value.execute.return_value = MagicMock()

    def table_side_effect(name):
        if name == "marketing_leads":
            return persona_chain
        if name == "marketing_contents":
            return contents_chain
        if name == "marketing_proposals":
            return proposals_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()
    mock_gen.generate_blog_article = AsyncMock(
        return_value=MagicMock(title="블로그", body="본문")
    )
    mock_gen.generate_instagram_caption = AsyncMock(
        return_value=MagicMock(title="인스타", body="본문")
    )
    mock_gen.generate_cafe_post = AsyncMock(
        return_value=MagicMock(title="카페", body="본문")
    )

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch.object(
            scheduler, "_pick_content_topic", return_value=("주제", ["키워드"])
        ),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
    ):
        await scheduler._run_content_generate_job()

    assert contents_chain.insert.call_count == 3
    assert proposals_chain.insert.call_count == 3
    proposal_payloads = [call.args[0] for call in proposals_chain.insert.call_args_list]
    assert all(payload["status"] == "pending" for payload in proposal_payloads)
    assert all(payload["action_type"] == "content" for payload in proposal_payloads)
    assert all(payload["metadata"].get("content_id") for payload in proposal_payloads)
    mock_metric.assert_called_once_with("proposals_made", 3)


@pytest.mark.asyncio
async def test_content_engagement_job_processes_published(scheduler):
    mock_sb = MagicMock()

    select_chain = MagicMock()
    select_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 10,
                "channel": "instagram",
                "title": "콘텐츠",
                "body": "본문",
                "published_at": "2026-03-08T12:00:00+09:00",
                "metadata": {"media_id": "12345"},
            }
        ]
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

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_resolve_instagram_media_id", return_value="12345"),
        patch.object(
            scheduler,
            "_fetch_instagram_metrics",
            return_value={
                "likes": 12,
                "comments": 3,
                "interacted_usernames": ["lead_a", "lead_b"],
            },
        ),
        patch.object(
            scheduler, "_update_lead_journey_from_content_interactions"
        ) as mock_update,
    ):
        await scheduler._run_content_engagement_job()

    update_payload = update_chain.update.call_args[0][0]
    assert update_payload["engagement_metrics"]["status"] == "collected"
    assert update_payload["engagement_metrics"]["likes"] == 12
    assert update_payload["engagement_metrics"]["comments"] == 3
    assert update_payload["engagement_metrics"]["media_id"] == "12345"
    assert update_payload["metadata"]["engagement_collected"] is True
    mock_update.assert_called_once_with(mock_sb, ["lead_a", "lead_b"])


@pytest.mark.asyncio
async def test_content_engagement_job_skips_already_collected(scheduler):
    mock_sb = MagicMock()

    select_chain = MagicMock()
    select_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 11,
                "channel": "instagram",
                "metadata": {"engagement_collected": True},
            }
        ]
    )
    update_chain = MagicMock()

    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return select_chain
        return update_chain

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_content_engagement_job()

    update_chain.update.assert_not_called()


@pytest.mark.asyncio
async def test_content_engagement_job_non_instagram_marked_collected(scheduler):
    mock_sb = MagicMock()

    select_chain = MagicMock()
    select_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 22,
                "channel": "youtube",
                "title": "유튜브",
                "body": "본문",
                "published_at": "2026-03-08T12:00:00+09:00",
                "metadata": {},
            }
        ]
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
        await scheduler._run_content_engagement_job()

    update_payload = update_chain.update.call_args[0][0]
    assert update_payload["engagement_metrics"]["status"] == "collected"
    assert update_payload["engagement_metrics"]["likes"] == 0
    assert update_payload["engagement_metrics"]["comments"] == 0


@pytest.mark.asyncio
async def test_content_engagement_job_marks_collection_failed_on_instagram_error(
    scheduler,
):
    mock_sb = MagicMock()

    select_chain = MagicMock()
    select_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 23,
                "channel": "instagram",
                "title": "인스타",
                "body": "본문",
                "published_at": "2026-03-08T12:00:00+09:00",
                "metadata": {"media_id": "98765"},
            }
        ]
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

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch.object(scheduler, "_resolve_instagram_media_id", return_value="98765"),
        patch.object(
            scheduler,
            "_fetch_instagram_metrics",
            side_effect=RuntimeError("instagram api unavailable"),
        ),
    ):
        await scheduler._run_content_engagement_job()

    update_payload = update_chain.update.call_args[0][0]
    assert update_payload["engagement_metrics"]["status"] == "collection_failed"
    assert "instagram api unavailable" in update_payload["engagement_metrics"]["error"]


@pytest.mark.asyncio
async def test_content_feedback_analyzes_engagement(scheduler):
    mock_sb = MagicMock()

    contents_chain = MagicMock()
    contents_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "c1",
                "channel": "instagram",
                "title": "Test Post",
                "status": "published",
                "engagement_metrics": {
                    "likes": 50,
                    "comments": 10,
                    "status": "collected",
                },
                "metadata": {
                    "topic": "이동식주택 후기",
                    "keywords": ["이동식주택", "전원생활"],
                    "persona_target": "lifestyle",
                },
                "persona_target": "lifestyle",
                "published_at": "2026-03-07T10:00:00+09:00",
            },
            {
                "id": "c2",
                "channel": "naver_blog",
                "title": "Blog Post",
                "status": "published",
                "engagement_metrics": {
                    "likes": 5,
                    "comments": 2,
                    "status": "collected",
                },
                "metadata": {
                    "topic": "모듈러주택 비용",
                    "keywords": ["모듈러주택", "건축비용"],
                    "persona_target": "price_sensitive",
                },
                "persona_target": "price_sensitive",
                "published_at": "2026-03-06T10:00:00+09:00",
            },
        ]
    )

    settings_chain = MagicMock()
    settings_chain.upsert.return_value.execute.return_value = MagicMock()

    def table_side_effect(name):
        if name == "marketing_contents":
            return contents_chain
        if name == "marketing_settings":
            return settings_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_content_feedback_job()

    assert settings_chain.upsert.called
    saved_data = settings_chain.upsert.call_args[0][0]
    assert saved_data["key"] == "content_performance_insights"
    value = saved_data["value"]
    assert value["total_content_analyzed"] == 2
    assert value["top_topics"][0]["name"] == "이동식주택 후기"
    assert len(value["top_personas"]) > 0
    assert len(value["top_channels"]) > 0


@pytest.mark.asyncio
async def test_content_feedback_empty_content(scheduler):
    mock_sb = MagicMock()

    contents_chain = MagicMock()
    contents_chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[]
    )
    settings_chain = MagicMock()

    def table_side_effect(name):
        if name == "marketing_contents":
            return contents_chain
        if name == "marketing_settings":
            return settings_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    with patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb):
        await scheduler._run_content_feedback_job()

    settings_chain.upsert.assert_not_called()


def test_pick_content_topic_uses_performance_insights(scheduler):
    mock_sb = MagicMock()

    settings_chain = MagicMock()
    settings_chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "value": {
                    "top_topics": [
                        {
                            "name": "이동식주택",
                            "avg_score": 50.0,
                            "count": 5,
                            "keywords": ["이동식주택", "전원생활"],
                        }
                    ],
                    "top_personas": [],
                    "top_channels": [],
                }
            }
        ]
    )

    signals_chain = MagicMock()
    signals_chain.select.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {"keywords": ["이동식주택", "전원생활"], "title": "Test"},
            {"keywords": ["모듈러주택"], "title": "Test2"},
        ]
    )

    def table_side_effect(name):
        if name == "marketing_settings":
            return settings_chain
        if name == "marketing_signals":
            return signals_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    topic, keywords = scheduler._pick_content_topic(mock_sb)
    assert "이동식주택" in topic or "이동식주택" in keywords


def test_pick_content_topic_fallback_to_performance(scheduler):
    mock_sb = MagicMock()

    settings_chain = MagicMock()
    settings_chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "value": {
                    "top_topics": [
                        {
                            "name": "귀촌 준비",
                            "avg_score": 30.0,
                            "count": 3,
                            "keywords": ["귀촌", "전원주택"],
                        }
                    ],
                    "top_personas": [],
                    "top_channels": [],
                }
            }
        ]
    )

    signals_chain = MagicMock()
    signals_chain.select.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )

    def table_side_effect(name):
        if name == "marketing_settings":
            return settings_chain
        if name == "marketing_signals":
            return signals_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    topic, keywords = scheduler._pick_content_topic(mock_sb)
    assert topic == "귀촌 준비"
    assert keywords == ["귀촌", "전원주택"]


def test_fetch_instagram_metrics_returns_counts_and_usernames(scheduler):
    mock_client = MagicMock()
    mock_client.media_info.return_value = MagicMock(like_count=17, comment_count=4)
    mock_client.media_likers.return_value = [MagicMock(username="liker_user")]
    mock_client.media_comments.return_value = [
        MagicMock(user=MagicMock(username="comment_user"))
    ]

    mock_wrapper = MagicMock()
    mock_wrapper.login.return_value = True
    mock_wrapper.get_client.return_value = mock_client

    mock_settings = MagicMock()
    mock_settings.instagram = MagicMock(
        username="acct",
        password="pw",
        session_dir="backend/.sessions",
    )

    with (
        patch("app.core.config.Settings", return_value=mock_settings),
        patch(
            "app.clients.instagram_client.InstagrapiClient", return_value=mock_wrapper
        ),
    ):
        metrics = scheduler._fetch_instagram_metrics("123")

    assert metrics["likes"] == 17
    assert metrics["comments"] == 4
    assert metrics["interacted_usernames"] == ["comment_user", "liker_user"]
    mock_wrapper.logout.assert_called_once()


@pytest.mark.asyncio
async def test_suggestion_job_uses_feedback_loop(scheduler):
    mock_engine = MagicMock()
    mock_engine.learn_from_results = AsyncMock(
        return_value={"insights": ["feedback insight"], "approval_rate": 0.4}
    )
    mock_engine.generate_suggestions = AsyncMock(return_value=[])
    mock_engine.propose = AsyncMock()

    with patch(
        "app.intelligence.suggestion.SuggestionEngine", return_value=mock_engine
    ):
        await scheduler._run_suggestion_job()

    mock_engine.learn_from_results.assert_called_once()
    mock_engine.generate_suggestions.assert_called_once_with(
        max_proposals=3,
        prior_insights={"insights": ["feedback insight"], "approval_rate": 0.4},
    )
    assert mock_engine.method_calls[:2] == [
        call.learn_from_results(),
        call.generate_suggestions(
            max_proposals=3,
            prior_insights={"insights": ["feedback insight"], "approval_rate": 0.4},
        ),
    ]


@pytest.mark.asyncio
async def test_execute_openclaw_call_retries_with_strategy_backoff(scheduler):
    attempts = {"count": 0}

    async def operation():
        attempts["count"] += 1
        if attempts["count"] == 1:
            return {"success": False, "content": "network error: connection refused"}
        return {"success": True, "content": "ok"}

    with patch(
        "app.orchestrator.scheduler.asyncio.sleep", new_callable=AsyncMock
    ) as sleep:
        result = await scheduler._execute_openclaw_call(
            "content_publish", "publish_content:instagram", operation
        )

    assert result["success"] is True
    assert attempts["count"] == 2
    sleep.assert_awaited_once_with(60)


@pytest.mark.asyncio
async def test_execute_openclaw_call_caps_backoff_to_one_hour(scheduler):
    async def operation():
        return {"success": False, "content": "action blocked"}

    with patch(
        "app.orchestrator.scheduler.asyncio.sleep", new_callable=AsyncMock
    ) as sleep:
        result = await scheduler._execute_openclaw_call(
            "content_publish", "publish_content:instagram", operation
        )

    assert result["success"] is False
    sleep.assert_awaited_once_with(3600)


@pytest.mark.asyncio
async def test_retry_with_backoff_succeeds_on_retry_with_jitter(scheduler):
    attempts = {"count": 0}

    async def flaky_operation():
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise RuntimeError("temporary network error")
        return "done"

    with (
        patch(
            "app.orchestrator.scheduler.asyncio.sleep", new_callable=AsyncMock
        ) as sleep,
        patch("app.orchestrator.scheduler.random.random", return_value=0.0),
    ):
        result = await scheduler._retry_with_backoff(
            "daily_report", flaky_operation, max_retries=3, base_backoff=5.0
        )

    assert result == "done"
    assert attempts["count"] == 2
    sleep.assert_awaited_once_with(2.5)


@pytest.mark.asyncio
async def test_retry_with_backoff_sends_critical_notification_after_three_failures(
    scheduler,
):
    async def always_fail():
        raise RuntimeError("network error")

    notifier = MagicMock()

    with (
        patch(
            "app.core.notification_service.NotificationService", return_value=notifier
        ),
        patch("app.orchestrator.scheduler.asyncio.sleep", new_callable=AsyncMock),
    ):
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await scheduler._retry_with_backoff(
                    "journey_check", always_fail, max_retries=1, base_backoff=5.0
                )

    assert notifier.send_alert.call_count == 3
    notifier._insert.assert_called_once()
    insert_payload = notifier._insert.call_args.kwargs
    assert insert_payload["category"] == "error"
    assert insert_payload["severity"] == 1
    assert insert_payload["title"] == "스케줄러 작업 실패: journey_check"


@pytest.mark.asyncio
async def test_evening_followup_uses_persona_dm(scheduler):
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

    warm_result = MagicMock(data=[])
    hot_result = MagicMock(data=[])
    super_result = MagicMock(
        data=[
            {
                "id": 301,
                "username": "슈퍼핫",
                "score": 35,
                "journey_stage": "decide",
                "persona_type": "design",
            }
        ]
    )

    mock_sb = MagicMock()
    call_count = {"n": 0}

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
    mock_svc = MagicMock()
    mock_svc.get_persona_dm.return_value = "페르소나 DM"

    async def execute_real_operation(job, op_name, operation):
        _ = job, op_name
        return await operation()

    with (
        patch("app.orchestrator.scheduler.OpenClawBridge", return_value=mock_bridge),
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.conversion.consultation.ConsultationService", return_value=mock_svc),
        patch.object(scheduler, "_record_daily_metric"),
        patch.object(
            scheduler, "_execute_openclaw_call", side_effect=execute_real_operation
        ),
    ):
        await scheduler._run_evening_followup_job()

    mock_svc.get_persona_dm.assert_called_once_with("슈퍼핫", "design")
    mock_bridge.engage_instagram_dm.assert_called_once_with("301", "페르소나 DM")


@pytest.mark.asyncio
async def test_content_generate_handles_image_service_exception(scheduler):
    mock_sb = MagicMock()

    persona_chain = MagicMock()
    persona_chain.select.return_value.neq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"persona_type": "lifestyle"}]
    )
    contents_chain = MagicMock()
    contents_chain.insert.return_value.execute.side_effect = [
        MagicMock(data=[{"id": 301}]),
        MagicMock(data=[{"id": 302}]),
        MagicMock(data=[{"id": 303}]),
    ]
    proposals_chain = MagicMock()
    proposals_chain.insert.return_value.execute.return_value = MagicMock()

    def table_side_effect(name):
        if name == "marketing_leads":
            return persona_chain
        if name == "marketing_contents":
            return contents_chain
        if name == "marketing_proposals":
            return proposals_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    mock_gen = MagicMock()
    mock_gen.generate_blog_article = AsyncMock(
        return_value=MagicMock(title="t", body="b")
    )
    mock_gen.generate_instagram_caption = AsyncMock(
        return_value=MagicMock(title="t", body="b")
    )
    mock_gen.generate_cafe_post = AsyncMock(return_value=MagicMock(title="t", body="b"))

    mock_img = MagicMock()
    mock_img.generate_marketing_image = AsyncMock(side_effect=RuntimeError("API down"))

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.content.generator.ContentGenerator", return_value=mock_gen),
        patch("app.conversion.image_service.ImageService", return_value=mock_img),
        patch.object(
            scheduler, "_pick_content_topic", return_value=("주제", ["키워드"])
        ),
        patch.object(scheduler, "_record_daily_metric"),
    ):
        await scheduler._run_content_generate_job()

    assert contents_chain.insert.call_count == 3
    insta_call = [
        c
        for c in contents_chain.insert.call_args_list
        if c[0][0].get("channel") == "instagram"
    ]
    assert len(insta_call) == 1
    assert insta_call[0][0][0]["metadata"]["media_path"] is None


@pytest.mark.asyncio
async def test_job_content_engagement_delegates(scheduler):
    with patch.object(scheduler, "_run_task", new_callable=AsyncMock) as mock_run:
        await scheduler._job_content_engagement()

    mock_run.assert_called_once_with(
        "content_engagement", scheduler._run_content_engagement_job
    )


@pytest.mark.asyncio
async def test_job_content_feedback_delegates(scheduler):
    with patch.object(scheduler, "_run_task", new_callable=AsyncMock) as mock_run:
        await scheduler._job_content_feedback()

    mock_run.assert_called_once_with(
        "content_feedback", scheduler._run_content_feedback_job
    )


@pytest.mark.asyncio
async def test_job_dm_monitor_delegates_when_operating_hours(scheduler):
    with (
        patch.object(scheduler, "_can_run_instagram_action", return_value=True),
        patch.object(scheduler, "_run_task", new_callable=AsyncMock) as mock_run,
    ):
        await scheduler._job_dm_monitor()

    mock_run.assert_called_once_with("dm_monitor", scheduler._run_dm_monitor_job)


@pytest.mark.asyncio
async def test_run_dm_monitor_job_creates_consultation_and_updates_state(scheduler):
    mock_sb = MagicMock()
    settings_upserts: list[dict[str, Any]] = []
    lead_inserts: list[dict[str, Any]] = []
    lead_updates: list[dict[str, Any]] = []

    def table_side_effect(name):
        chain = MagicMock()
        chain._mode = ""
        chain._payload = None
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain

        def upsert(payload, **kwargs):
            _ = kwargs
            chain._mode = "upsert"
            chain._payload = payload
            settings_upserts.append(payload)
            return chain

        def insert(payload):
            chain._mode = "insert"
            chain._payload = payload
            if name == "marketing_leads":
                lead_inserts.append(payload)
            return chain

        def update(payload):
            chain._mode = "update"
            chain._payload = payload
            if name == "marketing_leads":
                lead_updates.append(payload)
            return chain

        def execute():
            if name == "marketing_settings" and chain._mode == "":
                return MagicMock(data=[{"value": {"processed_message_ids": []}}])
            if name == "marketing_settings" and chain._mode == "upsert":
                return MagicMock(data=[chain._payload])
            if name == "marketing_leads" and chain._mode == "":
                return MagicMock(data=[])
            if name == "marketing_leads" and chain._mode == "insert":
                return MagicMock(data=[{"id": "lead-dm-1"}])
            if name == "marketing_leads" and chain._mode == "update":
                return MagicMock(data=[{"id": "lead-dm-1"}])
            return MagicMock(data=[])

        chain.upsert.side_effect = upsert
        chain.insert.side_effect = insert
        chain.update.side_effect = update
        chain.execute.side_effect = execute
        return chain

    mock_sb.table.side_effect = table_side_effect

    mock_monitor = AsyncMock()
    mock_monitor.check_new_dms.return_value = [
        {
            "username": "keyword_user",
            "message": "가격 궁금합니다",
            "keyword_matched": "가격",
            "thread_id": "200",
            "message_id": "msg-200",
        }
    ]
    mock_consultation = MagicMock()
    mock_consultation.create_consultation.return_value = "consultation-1"
    mock_notifier = MagicMock()

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.channels.dm_monitor.DMMonitor", return_value=mock_monitor),
        patch(
            "app.conversion.consultation.ConsultationService",
            return_value=mock_consultation,
        ),
        patch(
            "app.core.notification_service.NotificationService",
            return_value=mock_notifier,
        ),
        patch.object(scheduler, "_record_daily_metric") as mock_metric,
    ):
        await scheduler._run_dm_monitor_job()

    assert len(lead_inserts) == 1
    assert lead_inserts[0]["source"] == "dm_inbound"
    mock_consultation.create_consultation.assert_called_once()
    assert (
        mock_consultation.create_consultation.call_args.kwargs["request_channel"]
        == "dm_response"
    )
    mock_notifier.send_alert.assert_called_once()
    mock_metric.assert_called_once_with("consultations_requested", 1)
    assert settings_upserts[-1]["key"] == "dm_monitor_last_processed"
    processed = settings_upserts[-1]["value"]["processed_message_ids"]
    assert "msg-200" in processed
    assert lead_updates == []


@pytest.mark.asyncio
async def test_run_dm_monitor_job_sets_minimum_cooldown_on_rate_limit(scheduler):
    from app.channels.dm_monitor import DMMonitorRateLimitError

    mock_sb = MagicMock()
    settings_upserts: list[dict[str, Any]] = []

    def table_side_effect(name):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain

        def execute():
            return MagicMock(data=[{"value": {"processed_message_ids": []}}])

        def upsert(payload, **kwargs):
            _ = kwargs
            settings_upserts.append(payload)
            chain.execute.side_effect = lambda: MagicMock(data=[payload])
            return chain

        chain.execute.side_effect = execute
        chain.upsert.side_effect = upsert
        return chain

    mock_sb.table.side_effect = table_side_effect

    mock_monitor = AsyncMock()
    mock_monitor.check_new_dms.side_effect = DMMonitorRateLimitError(
        cooldown_until=None
    )

    with (
        patch("app.orchestrator.scheduler.get_supabase", return_value=mock_sb),
        patch("app.channels.dm_monitor.DMMonitor", return_value=mock_monitor),
    ):
        await scheduler._run_dm_monitor_job()

    cooldown_raw = settings_upserts[-1]["value"]["cooldown_until"]
    assert isinstance(cooldown_raw, str)
