"""Tests for Instagram Channel Module."""

import pytest
from unittest.mock import MagicMock, patch

from app.channels.instagram import InstagramChannel, LeadCandidate
from app.leads.discovery import DailyLimitTracker


@pytest.fixture
def channel():
    ch = InstagramChannel()
    ch.discord = MagicMock()
    return ch


def test_daily_limit_tracker_records_action():
    tracker = DailyLimitTracker(likes=150, follows=50, comments=30, dms=15)
    tracker.record("likes")
    assert tracker.counts["likes"] == 1


def test_daily_limit_tracker_raises_when_exceeded():
    tracker = DailyLimitTracker(likes=150, follows=50, comments=30, dms=15)
    tracker.counts["likes"] = 150
    with pytest.raises(RuntimeError, match="limit exceeded"):
        tracker.record("likes")


def test_daily_limit_remaining():
    tracker = DailyLimitTracker(likes=150, follows=50, comments=30, dms=15)
    tracker.counts["likes"] = 50
    assert tracker.remaining("likes") == 100


def test_bot_account_filter(channel):
    assert channel._is_bot_account("official_brand_store") is True
    assert channel._is_bot_account("user_귀촌꿈꾸는중") is False


def test_bot_account_filter_bio(channel):
    assert channel._is_bot_account("normal_user", bio="official shop page") is True
    assert channel._is_bot_account("normal_user", bio="귀촌 생활 일기") is False


def test_delay_range(channel):
    for _ in range(5):
        delay = channel._random_delay()
        assert 30 <= delay <= 90


@pytest.mark.asyncio
async def test_like_outside_operating_hours(channel):
    """Like action fails outside operating hours."""
    with patch.object(channel, "_is_operating_hours", return_value=False):
        result = await channel.like_post("post123")
    assert result is False


@pytest.mark.asyncio
async def test_like_within_limit(channel):
    """Like action succeeds within limit during operating hours."""
    with patch.object(channel, "_is_operating_hours", return_value=True):
        with patch("asyncio.sleep", return_value=None):
            result = await channel.like_post("post123")
    assert result is True
    assert channel.limit_tracker.counts["likes"] == 1


@pytest.mark.asyncio
async def test_like_limit_exceeded(channel):
    """Like action fails when daily limit is reached."""
    channel.limit_tracker.counts["likes"] = 150
    with patch.object(channel, "_is_operating_hours", return_value=True):
        result = await channel.like_post("post123")
    assert result is False
    assert channel.limit_tracker.counts["likes"] == 150  # not incremented


@pytest.mark.asyncio
async def test_follow_within_limit(channel):
    """Follow action succeeds within limit during operating hours."""
    with patch.object(channel, "_is_operating_hours", return_value=True):
        with patch("asyncio.sleep", return_value=None):
            result = await channel.follow_user("user123")
    assert result is True
    assert channel.limit_tracker.counts["follows"] == 1


@pytest.mark.asyncio
async def test_follow_limit_exceeded(channel):
    """Follow action fails when daily limit is reached."""
    channel.limit_tracker.counts["follows"] = 50
    with patch.object(channel, "_is_operating_hours", return_value=True):
        result = await channel.follow_user("user123")
    assert result is False
    assert channel.limit_tracker.counts["follows"] == 50  # not incremented


def test_limit_reset(channel):
    """Daily limit tracker resets all counts."""
    channel.limit_tracker.counts["likes"] = 100
    channel.limit_tracker.reset()
    assert channel.limit_tracker.counts["likes"] == 0


@pytest.mark.asyncio
async def test_post_content_during_hours(channel):
    """Post content succeeds during operating hours."""
    with patch.object(channel, "_is_operating_hours", return_value=True):
        result = await channel.post_content("테스트 캡션", None)
    assert result.success is True
    assert result.post_id is not None


@pytest.mark.asyncio
async def test_post_content_outside_hours(channel):
    """Post content fails outside operating hours."""
    with patch.object(channel, "_is_operating_hours", return_value=False):
        result = await channel.post_content("테스트 캡션", None)
    assert result.success is False
    assert result.error == "Outside operating hours"


@pytest.mark.asyncio
async def test_get_competitor_commenters_returns_empty(channel):
    """Stub returns empty list (no credentials)."""
    result = await channel.get_competitor_commenters("competitor_user")
    assert result == []


@pytest.mark.asyncio
async def test_get_hashtag_users_returns_empty(channel):
    """Stub returns empty list (no credentials)."""
    result = await channel.get_hashtag_users("귀촌")
    assert result == []


def test_lead_candidate_defaults():
    """LeadCandidate dataclass defaults are correct."""
    lc = LeadCandidate(username="test_user")
    assert lc.platform == "instagram"
    assert lc.source == ""
    assert lc.metadata == {}


def test_lead_candidate_custom():
    """LeadCandidate with custom values."""
    lc = LeadCandidate(
        username="custom_user",
        platform="instagram",
        source="hashtag_귀촌",
        metadata={"bio": "시골 생활 꿈꾸는 중"},
    )
    assert lc.source == "hashtag_귀촌"
    assert lc.metadata["bio"] == "시골 생활 꿈꾸는 중"
