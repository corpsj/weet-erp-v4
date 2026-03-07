"""Tests for Naver Blog Channel Module."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.channels.naver_blog import NaverBlogChannel, BlogDraft


@pytest.fixture
def channel():
    ch = NaverBlogChannel()
    ch.discord = MagicMock()
    # Mock the content generator
    from app.content.generator import BlogArticle

    mock_article = BlogArticle(
        topic="이동식주택 허가",
        title="이동식주택 허가 절차 완벽 가이드",
        body="이동식주택 허가에 대해 알아보겠습니다. " * 100
        + "\n\n문의: 010-9645-2348",
        keywords=["허가", "농막"],
        word_count=2000,
    )
    ch.generator = MagicMock()
    ch.generator.generate_blog_article = AsyncMock(return_value=mock_article)
    return ch


@pytest.mark.asyncio
async def test_generate_draft_creates_db_entry(channel):
    with patch.object(channel, "_save_draft", new_callable=AsyncMock, return_value=1):
        draft = await channel.generate_draft("이동식주택 허가", ["허가", "농막"])
    assert isinstance(draft, BlogDraft)
    assert draft.id == 1
    assert "이동식주택" in draft.title


@pytest.mark.asyncio
async def test_generate_draft_sends_discord_notification(channel):
    with patch.object(channel, "_save_draft", new_callable=AsyncMock, return_value=1):
        await channel.generate_draft("이동식주택 허가", ["허가"])
    channel.discord.send_message.assert_called_once()
    msg = channel.discord.send_message.call_args[0][0]
    assert "수동" in msg  # Manual publish reminder
    assert "Write API" in msg or "블로그" in msg


def test_blog_draft_contains_cta(channel):
    draft = BlogDraft(
        topic="test",
        title="Test Blog",
        body="내용입니다. 문의: 010-9645-2348",
    )
    assert "010-9645-2348" in draft.body
