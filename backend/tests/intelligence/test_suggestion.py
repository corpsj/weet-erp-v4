import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.intelligence.suggestion import ProposalData, SuggestionEngine


@pytest.fixture
def engine():
    instance = SuggestionEngine()
    instance.llm = MagicMock()
    instance.discord = MagicMock()
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
async def test_propose_sends_discord_message(engine):
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
    engine.discord.send_proposal.assert_called_once()
    sent = engine.discord.send_proposal.call_args[0][0]
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
    engine.discord.send_proposal.assert_not_called()


@pytest.mark.asyncio
async def test_handle_response_approved(engine):
    mock_proposal = MagicMock()
    mock_proposal.title = "테스트 제안"
    mock_session = AsyncMock()
    mock_session.get.return_value = mock_proposal

    with patch("app.intelligence.suggestion.AsyncSessionLocal") as mock_session_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session_class.return_value = mock_ctx
        result = await engine.handle_response(1, "approved")

    assert result is True
    assert mock_proposal.status == "approved"
    engine.discord.send_message.assert_called_once()
    assert "승인" in engine.discord.send_message.call_args[0][0]


@pytest.mark.asyncio
async def test_handle_response_rejected_with_reason(engine):
    mock_proposal = MagicMock()
    mock_proposal.title = "거부된 제안"
    mock_session = AsyncMock()
    mock_session.get.return_value = mock_proposal

    with patch("app.intelligence.suggestion.AsyncSessionLocal") as mock_session_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session_class.return_value = mock_ctx
        result = await engine.handle_response(
            1, "rejected", feedback="시기적절하지 않음"
        )

    assert result is True
    assert mock_proposal.status == "rejected"
    assert mock_proposal.rejection_reason == "시기적절하지 않음"


@pytest.mark.asyncio
async def test_learn_from_results_empty(engine):
    with patch("app.intelligence.suggestion.AsyncSessionLocal") as mock_session_class:
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_session.execute.return_value = mock_result
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_session
        mock_session_class.return_value = mock_ctx
        result = await engine.learn_from_results()

    assert result["total"] == 0
    assert result["approval_rate"] == 0.0
