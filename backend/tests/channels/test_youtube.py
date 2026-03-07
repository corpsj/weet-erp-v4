"""Tests for YouTube Channel Module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels.youtube import YouTubeChannel, VideoInfo


@pytest.fixture
def channel():
    ch = YouTubeChannel()
    from app.clients.youtube import VideoItem, Comment

    ch.client = AsyncMock()
    ch.client.search_videos = AsyncMock(
        return_value=[
            VideoItem(
                video_id="vid1",
                title="이동식주택 투어",
                channel_title="채널1",
            ),
            VideoItem(
                video_id="vid2",
                title="모듈러주택 비용",
                channel_title="채널2",
            ),
        ]
    )
    ch.client.get_comments = AsyncMock(
        return_value=[
            Comment(
                comment_id="c1",
                author="user1",
                text="이 영상 좋네요 저도 귀촌 생각 중",
            ),
            Comment(
                comment_id="c2",
                author="user2",
                text="가격이 얼마나 하나요?",
            ),
        ]
    )
    return ch


@pytest.mark.asyncio
async def test_monitor_videos_returns_video_info(channel):
    videos = await channel.monitor_videos(["이동식주택"])
    assert len(videos) >= 1
    assert all(isinstance(v, VideoInfo) for v in videos)


@pytest.mark.asyncio
async def test_collect_commenters_returns_leads(channel):
    leads = await channel.collect_commenters("vid1")
    assert len(leads) == 2
    assert all(lead.platform == "youtube" for lead in leads)
    assert all(lead.source == "youtube_commenter" for lead in leads)


@pytest.mark.asyncio
async def test_generate_shorts_script(channel):
    from app.content.generator import Script

    mock_script = Script(
        topic="이동식주택",
        title="이동식주택 비용",
        body="훅: 이동식주택 진짜 비용은?",
        format="short",
    )
    with patch("app.channels.youtube.ContentGenerator") as mock_gen_class:
        mock_gen = AsyncMock()
        mock_gen.generate_youtube_script = AsyncMock(return_value=mock_script)
        mock_gen_class.return_value = mock_gen
        result = await channel.generate_shorts_script("이동식주택 비용")
    assert result.format == "short"
    assert "이동식주택" in result.topic
