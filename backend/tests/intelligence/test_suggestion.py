import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.intelligence.suggestion import ProposalData, SuggestionEngine


@pytest.fixture
def engine():
    instance = SuggestionEngine()
    instance.llm = MagicMock()
    instance.notifier = MagicMock()
    return instance


@pytest.mark.asyncio
async def test_generate_suggestions_with_no_data(engine):
    with patch.object(engine, "_get_recent_signals", return_value=[]):
        with patch.object(engine, "_get_lead_count", return_value=0):
            with patch.object(engine, "_get_recent_metrics", return_value={}):
                proposals = await engine.generate_suggestions()

    assert len(proposals) >= 1
    assert any(p.action_type in ["strategy", "content"] for p in proposals)


@pytest.mark.asyncio
async def test_generate_suggestions_with_signals(engine):
    engine.llm.analyze.return_value = [
        {
            "title": "귀촌 보조금 블로그 글 작성",
            "action_type": "content",
            "rationale": "귀촌 보조금 기사 3건 감지",
            "urgency": "high",
            "expected_impact": "방문자 +30%",
        }
    ]
    mock_signals = [
        {
            "source": "naver_news",
            "title": "귀촌 보조금 확대",
            "summary": "2026년 지원금 증가",
        }
    ]
    with patch.object(engine, "_get_recent_signals", return_value=mock_signals):
        with patch.object(engine, "_get_lead_count", return_value=5):
            with patch.object(engine, "_get_recent_metrics", return_value={}):
                proposals = await engine.generate_suggestions()

    assert len(proposals) >= 1
    assert proposals[0].action_type in [
        "content",
        "outreach",
        "strategy",
        "urgent",
        "calendar",
    ]


@pytest.mark.asyncio
async def test_propose_sends_notifier_message(engine):
    with patch.object(
        engine, "_is_duplicate", new_callable=AsyncMock, return_value=False
    ):
        with patch.object(
            engine, "_save_proposal", new_callable=AsyncMock, return_value=42
        ):
            proposal = ProposalData(
                title="테스트 제안",
                action_type="content",
                rationale="테스트 근거",
                urgency="medium",
            )
            result = await engine.propose(proposal)

    assert result == 42
    engine.notifier.send_proposal.assert_called_once()
    sent = engine.notifier.send_proposal.call_args[0][0]
    assert "테스트 제안" in sent["title"]


@pytest.mark.asyncio
async def test_propose_skips_duplicate(engine):
    with patch.object(
        engine, "_is_duplicate", new_callable=AsyncMock, return_value=True
    ):
        proposal = ProposalData(
            title="중복 제안", action_type="content", rationale="test"
        )
        result = await engine.propose(proposal)

    assert result is None
    engine.notifier.send_proposal.assert_not_called()


@pytest.mark.asyncio
async def test_handle_response_approved(engine):
    mock_sb = MagicMock()
    mock_select = MagicMock()
    mock_select.data = [{"id": 1, "title": "테스트 제안"}]
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_select
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("app.intelligence.suggestion.get_supabase", return_value=mock_sb):
        result = await engine.handle_response(1, "approved")

    assert result is True
    engine.notifier.send_message.assert_called_once()
    assert "승인" in engine.notifier.send_message.call_args[0][0]


@pytest.mark.asyncio
async def test_handle_response_rejected_with_reason(engine):
    mock_sb = MagicMock()
    mock_select = MagicMock()
    mock_select.data = [{"id": 1, "title": "거부된 제안"}]
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_select
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("app.intelligence.suggestion.get_supabase", return_value=mock_sb):
        result = await engine.handle_response(
            1, "rejected", feedback="시기적절하지 않음"
        )

    assert result is True
    engine.notifier.send_message.assert_called_once()
    assert "거부" in engine.notifier.send_message.call_args[0][0]


@pytest.mark.asyncio
async def test_learn_from_results_empty(engine):
    mock_sb = MagicMock()
    mock_result = MagicMock()
    mock_result.data = []
    mock_sb.table.return_value.select.return_value.execute.return_value = mock_result

    with patch("app.intelligence.suggestion.get_supabase", return_value=mock_sb):
        result = await engine.learn_from_results()

    assert result["total"] == 0
    assert result["approval_rate"] == 0.0


@pytest.mark.asyncio
async def test_learn_from_results_includes_content_performance_insights(engine):
    mock_sb = MagicMock()

    proposals_chain = MagicMock()
    proposals_chain.select.return_value.execute.return_value = MagicMock(
        data=[
            {"status": "approved", "action_type": "content"},
            {"status": "rejected", "action_type": "outreach"},
        ]
    )

    settings_chain = MagicMock()
    settings_chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "value": {
                    "top_topics": [
                        {"name": "이동식주택", "avg_score": 24.5, "count": 4}
                    ],
                    "top_channels": [
                        {"name": "instagram", "avg_score": 18.0, "count": 6}
                    ],
                }
            }
        ]
    )

    def table_side_effect(name):
        if name == "marketing_proposals":
            return proposals_chain
        if name == "marketing_settings":
            return settings_chain
        return MagicMock()

    mock_sb.table.side_effect = table_side_effect

    with patch("app.intelligence.suggestion.get_supabase", return_value=mock_sb):
        result = await engine.learn_from_results()

    assert result["total"] == 2
    assert any("최고 성과 콘텐츠 주제" in insight for insight in result["insights"])
    assert any("최고 성과 채널" in insight for insight in result["insights"])


@pytest.mark.asyncio
async def test_generate_suggestions_with_prior_insights(engine):
    engine.llm.analyze.return_value = {
        "title": "맞춤 제안",
        "action_type": "content",
        "rationale": "근거",
    }

    with patch.object(
        engine,
        "_get_recent_signals",
        return_value=[
            {
                "source": "naver_news",
                "title": "신호",
                "summary": "요약",
            }
        ],
    ):
        with patch.object(engine, "_get_lead_count", return_value=4):
            with patch.object(engine, "_get_recent_metrics", return_value={}):
                _ = await engine.generate_suggestions(
                    prior_insights={
                        "insights": ["content 유형 거부율 높음"],
                        "approval_rate": 0.4,
                    }
                )

    called_prompt = engine.llm.analyze.call_args.args[0]
    assert "content 유형 거부율 높음" in called_prompt
