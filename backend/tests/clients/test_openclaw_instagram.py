"""Tests for OpenClawBridge Instagram extensions (Tasks 9 & 10)."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.clients.openclaw import OpenClawBridge


@pytest.fixture
def bridge():
    """OpenClawBridge with mocked settings."""
    with patch("app.clients.openclaw.Settings") as mock_settings:
        mock_settings.return_value.openclaw.gateway_ws_url = (
            "ws://localhost:18789/gateway"
        )
        mock_settings.return_value.openclaw.api_key = "test_key"
        return OpenClawBridge()


@pytest.fixture
def mock_prompt_result():
    return {"success": True, "content": "ok", "raw": None}


# ── Content Publishing ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_publish_instagram_feed(bridge, mock_prompt_result):
    """publish_instagram_feed routes through instagram-poster skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_instagram_feed(
            "cid-001", "테스트 캡션", "/path/img.jpg"
        )
    assert result["success"] is True
    mock_exec.assert_called_once()
    prompt = mock_exec.call_args[0][0]
    assert "instagram-poster" in prompt
    assert "cid-001" in prompt
    assert "/path/img.jpg" in prompt


@pytest.mark.asyncio
async def test_publish_instagram_story(bridge, mock_prompt_result):
    """publish_instagram_story routes through instagram-poster skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_instagram_story("cid-002", "/path/story.jpg")
    assert result["success"] is True
    mock_exec.assert_called_once()
    prompt = mock_exec.call_args[0][0]
    assert "instagram-poster" in prompt
    assert "cid-002" in prompt
    assert "/path/story.jpg" in prompt


@pytest.mark.asyncio
async def test_publish_instagram_reel(bridge, mock_prompt_result):
    """publish_instagram_reel routes through instagram-poster skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_instagram_reel(
            "cid-003", "릴스 캡션", "/path/reel.mp4"
        )
    assert result["success"] is True
    mock_exec.assert_called_once()
    prompt = mock_exec.call_args[0][0]
    assert "instagram-poster" in prompt
    assert "cid-003" in prompt
    assert "/path/reel.mp4" in prompt


# ── Engagement Delegation ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_engage_instagram_like(bridge, mock_prompt_result):
    """engage_instagram_like routes through lead-outreach skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_like("lead-123")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-outreach" in prompt
    assert "lead-123" in prompt
    assert "like" in prompt


@pytest.mark.asyncio
async def test_engage_instagram_follow(bridge, mock_prompt_result):
    """engage_instagram_follow routes through lead-outreach skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_follow("lead-456")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-outreach" in prompt
    assert "lead-456" in prompt
    assert "follow" in prompt


@pytest.mark.asyncio
async def test_engage_instagram_comment_includes_brand_tone(bridge, mock_prompt_result):
    """engage_instagram_comment includes brand tone in prompt."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_comment("lead-789", "좋은 집이네요!")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-789" in prompt
    assert "좋은 집이네요!" in prompt
    assert "친근하고 전문적" in prompt


@pytest.mark.asyncio
async def test_engage_instagram_dm(bridge, mock_prompt_result):
    """engage_instagram_dm routes through lead-outreach skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_dm("lead-dm-1", "안녕하세요!")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-dm-1" in prompt
    assert "안녕하세요!" in prompt
    assert "lead-outreach" in prompt


# ── Backward Compatibility ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_backward_compat_publish_content_instagram(bridge, mock_prompt_result):
    """publish_content(instagram) uses instagram-poster skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_content("instagram", "content-001")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "instagram-poster" in prompt
    assert "content-001" in prompt


@pytest.mark.asyncio
async def test_backward_compat_publish_content_other(bridge, mock_prompt_result):
    """publish_content(non-instagram) falls back to generic prompt."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_content("naver-blog", "content-002")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "naver-blog" in prompt
    assert "content-002" in prompt


@pytest.mark.asyncio
async def test_backward_compat_outreach_lead(bridge, mock_prompt_result):
    """outreach_lead uses lead-outreach skill."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.outreach_lead("lead-001", "follow")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-outreach" in prompt
    assert "lead-001" in prompt
    assert "follow" in prompt
