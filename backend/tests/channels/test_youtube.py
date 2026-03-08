"""Tests for YouTube Channel Module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels.youtube import YouTubeChannel, VideoInfo
from app.channels.instagram import LeadCandidate


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


@pytest.mark.asyncio
async def test_collect_leads_filters_intent_comments(channel):
    with patch.object(channel, "save_lead_to_db", new_callable=AsyncMock) as mock_save:
        leads = await channel.collect_leads()

    assert channel.client.search_videos.call_count == len(channel.SEARCH_QUERIES)
    assert len(leads) == 1
    assert leads[0].username == "user2"
    assert leads[0].platform == "youtube"
    assert leads[0].source == "youtube_commenter"
    mock_save.assert_awaited()


@pytest.mark.asyncio
async def test_save_lead_to_db_merges_duplicate_platform_username(channel):
    candidate = LeadCandidate(
        username="user2",
        platform="youtube",
        source="youtube_commenter",
        metadata={
            "query": "모듈러주택 가격",
            "video_id": "vid2",
            "comment": "가격이 얼마나 하나요?",
            "intent_matches": ["가격", "얼마"],
        },
    )

    mock_sb = MagicMock()
    table_chain = MagicMock()
    table_chain.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 456,
                "score": 5,
                "source": "youtube_commenter",
                "metadata": {
                    "sources": ["youtube_commenter"],
                    "queries": ["이동식주택 후기"],
                    "videos": ["vid1"],
                    "recent_comments": ["관심있어요"],
                    "encounters": 1,
                },
            }
        ]
    )
    table_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()
    mock_sb.table.return_value = table_chain

    with patch("app.channels.youtube.get_supabase", return_value=mock_sb):
        lead_id = await channel.save_lead_to_db(candidate, score=9)

    assert lead_id == 456
    update_payload = table_chain.update.call_args[0][0]
    assert update_payload["score"] == 9
    assert update_payload["metadata"]["encounters"] == 2
    assert "모듈러주택 가격" in update_payload["metadata"]["queries"]
    assert "vid2" in update_payload["metadata"]["videos"]
