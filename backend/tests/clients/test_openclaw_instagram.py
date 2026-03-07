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
    """publish_instagram_feed delegates to _execute_marketing_prompt."""
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
    assert "feed" in prompt.lower() or "instagram" in prompt.lower()
    assert "cid-001" in prompt


@pytest.mark.asyncio
async def test_publish_instagram_story(bridge, mock_prompt_result):
    """publish_instagram_story delegates to _execute_marketing_prompt."""
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
    assert "story" in prompt.lower()
    assert "cid-002" in prompt


@pytest.mark.asyncio
async def test_publish_instagram_reel(bridge, mock_prompt_result):
    """publish_instagram_reel delegates to _execute_marketing_prompt."""
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
    assert "reel" in prompt.lower()
    assert "cid-003" in prompt


# ── Engagement Delegation ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_engage_instagram_like(bridge, mock_prompt_result):
    """engage_instagram_like delegates to _execute_marketing_prompt."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_like("media-123")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "like" in prompt.lower()
    assert "media-123" in prompt


@pytest.mark.asyncio
async def test_engage_instagram_follow(bridge, mock_prompt_result):
    """engage_instagram_follow delegates to _execute_marketing_prompt."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_follow("target_user")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "follow" in prompt.lower()
    assert "target_user" in prompt


@pytest.mark.asyncio
async def test_engage_instagram_comment_includes_brand_tone(bridge, mock_prompt_result):
    """engage_instagram_comment includes brand tone guidelines."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_comment("media-456", "좋은 집이네요!")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "media-456" in prompt
    assert "좋은 집이네요!" in prompt
    assert "친근하고 전문적" in prompt  # brand tone present


@pytest.mark.asyncio
async def test_engage_instagram_dm_includes_brand_info(bridge, mock_prompt_result):
    """engage_instagram_dm includes company and brand info."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.engage_instagram_dm("dm_target", "안녕하세요!")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "dm_target" in prompt
    assert "위트" in prompt  # brand name present


# ── Backward Compatibility ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_backward_compat_publish_content(bridge, mock_prompt_result):
    """Existing publish_content() still works unchanged."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.publish_content("instagram", "content-001")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "instagram" in prompt
    assert "content-001" in prompt


@pytest.mark.asyncio
async def test_backward_compat_outreach_lead(bridge, mock_prompt_result):
    """Existing outreach_lead() still works unchanged."""
    with patch.object(
        bridge,
        "_execute_marketing_prompt",
        new_callable=AsyncMock,
        return_value=mock_prompt_result,
    ) as mock_exec:
        result = await bridge.outreach_lead("lead-001", "hunt")
    assert result["success"] is True
    prompt = mock_exec.call_args[0][0]
    assert "lead-001" in prompt
    assert "hunt" in prompt
