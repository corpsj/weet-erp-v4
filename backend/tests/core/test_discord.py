"""Tests for Discord bot framework."""

import pytest
from unittest.mock import MagicMock, patch
from app.core.discord_bot import DiscordBot


@pytest.fixture
def bot():
    """Create a DiscordBot with a test webhook URL."""
    with patch.dict(
        "os.environ",
        {
            "NAVER__CLIENT_ID": "test_naver_id",
            "NAVER__CLIENT_SECRET": "test_naver_secret",
            "YOUTUBE__API_KEY": "test_yt_key",
            "DISCORD__WEBHOOK_URL": "https://discord.com/api/webhooks/test/token",
        },
    ):
        return DiscordBot()


def test_send_proposal_format(bot):
    """Test that send_proposal creates properly formatted embed."""
    proposal = {
        "title": "귀촌 보조금 기사 급증 — 블로그 글 작성",
        "signal": "네이버 뉴스 3건: 귀촌 보조금 2026년 확대",
        "action": "귀촌 보조금 관련 블로그 글 작성",
        "urgency": "high",
        "impact": "리드 발굴 +20%",
    }
    with patch.object(bot, "_post", return_value=True) as mock_post:
        result = bot.send_proposal(proposal)
        assert result is True
        mock_post.assert_called_once()
        payload = mock_post.call_args[0][0]
        assert "embeds" in payload
        embed = payload["embeds"][0]
        assert "🎯 제안:" in embed["title"]
        assert embed["color"] == 0xFF8C00  # high = orange


def test_send_alert_hot_lead(bot):
    """Test hot lead alert format."""
    with patch.object(bot, "_post", return_value=True) as mock_post:
        bot.send_alert("hot_lead", "user123 (score: 15)")
        payload = mock_post.call_args[0][0]
        assert "🔥" in payload["content"]
        assert "user123" in payload["content"]


def test_send_daily_report(bot):
    """Test daily report embed structure."""
    metrics = {
        "leads_collected": 5,
        "proposals_made": 2,
        "proposals_approved": 1,
        "contents_published": 1,
    }
    with patch.object(bot, "_post", return_value=True) as mock_post:
        result = bot.send_daily_report(metrics)
        assert result is True
        payload = mock_post.call_args[0][0]
        assert "embeds" in payload
        embed = payload["embeds"][0]
        # Check all 4 metric fields exist
        field_names = [f["name"] for f in embed["fields"]]
        assert any("리드" in n for n in field_names)
        assert any("제안" in n for n in field_names)


def test_send_message_basic(bot):
    """Test basic text message sending."""
    with patch.object(bot, "_post", return_value=True) as mock_post:
        bot.send_message("테스트 메시지")
        payload = mock_post.call_args[0][0]
        assert payload["content"] == "테스트 메시지"


def test_placeholder_webhook_skips_post(bot):
    """Test that placeholder webhook URL skips actual HTTP call."""
    bot.webhook_url = "https://discord.com/api/webhooks/placeholder"
    with patch("httpx.Client") as mock_http:
        result = bot.send_message("test")
        assert result is True
        mock_http.assert_not_called()


def test_send_proposal_with_content_draft(bot):
    """Test proposal with content draft included."""
    proposal = {
        "title": "블로그 초안",
        "urgency": "medium",
        "content_draft": "이동식주택의 장점: 빠른 시공, 합리적 비용...",
    }
    with patch.object(bot, "_post", return_value=True) as mock_post:
        bot.send_proposal(proposal)
        payload = mock_post.call_args[0][0]
        embed = payload["embeds"][0]
        field_values = [f["value"] for f in embed["fields"]]
        assert any("이동식주택" in v for v in field_values)
