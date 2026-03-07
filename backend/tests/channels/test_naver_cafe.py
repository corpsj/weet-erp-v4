"""Tests for Naver Cafe Channel Module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels.naver_cafe import NaverCafeChannel, PostResult


@pytest.fixture
def channel():
    return NaverCafeChannel(cafe_id="test_cafe", oauth_token="test_token")


@pytest.mark.asyncio
async def test_post_article_success(channel):
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"articleId": "12345"}
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_ctx
        result = await channel.post_article("test_cafe", "테스트 글", "내용입니다.")
    assert result.success is True
    assert result.article_id == "12345"


@pytest.mark.asyncio
async def test_post_article_no_token():
    channel = NaverCafeChannel(cafe_id="test_cafe", oauth_token="")
    result = await channel.post_article("test_cafe", "테스트", "내용")
    assert result.success is False
    assert "OAuth" in result.error


@pytest.mark.asyncio
async def test_monitor_questions_finds_leads(channel):
    from app.clients.naver import CafeItem

    channel.naver_client = AsyncMock()
    channel.naver_client.search_cafearticle = AsyncMock(
        return_value=[
            CafeItem(
                title="이동식주택 가격 질문드립니다?",
                link="https://cafe.naver.com/1",
                description="문의",
                cafename="user1",
            ),
            CafeItem(
                title="전원주택 정보 공유",
                link="https://cafe.naver.com/2",
                description="정보",
                cafename="user2",
            ),
        ]
    )
    leads = await channel.monitor_questions("test_cafe", ["이동식주택"])
    # Only the question post should be a lead
    assert len(leads) >= 1
    assert any("naver_cafe_question" in lead.source for lead in leads)
