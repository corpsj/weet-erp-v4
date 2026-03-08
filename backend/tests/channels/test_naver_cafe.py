"""Tests for Naver Cafe Channel Module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels.naver_cafe import NaverCafeChannel
from app.channels.instagram import LeadCandidate


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
    assert result.error is not None
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


@pytest.mark.asyncio
async def test_collect_leads_uses_keywords_and_question_intent(channel):
    from app.clients.naver import CafeItem

    channel.naver_client = AsyncMock()
    channel.naver_client.search_cafearticle = AsyncMock(
        return_value=[
            CafeItem(
                title="이동식주택 가격 문의드립니다",
                link="https://cafe.naver.com/lead-1",
                description="얼마일까요?",
                cafename="lead_user",
            ),
            CafeItem(
                title="시골 라이프 사진 공유",
                link="https://cafe.naver.com/no-lead",
                description="일상 공유",
                cafename="non_lead_user",
            ),
        ]
    )

    with patch.object(channel, "save_lead_to_db", new_callable=AsyncMock) as mock_save:
        leads = await channel.collect_leads()

    assert channel.naver_client.search_cafearticle.call_count == len(
        channel.LEAD_KEYWORDS
    )
    assert len(leads) == 1
    assert leads[0].username == "lead_user"
    assert leads[0].platform == "naver_cafe"
    assert leads[0].source == "naver_cafe_question"
    mock_save.assert_awaited()


@pytest.mark.asyncio
async def test_save_lead_to_db_merges_duplicate_platform_username(channel):
    candidate = LeadCandidate(
        username="lead_user",
        platform="naver_cafe",
        source="naver_cafe_question",
        metadata={
            "keyword": "이동식주택",
            "title": "이동식주택 가격 질문",
            "description": "문의",
            "url": "https://cafe.naver.com/lead-1",
            "intent_matches": ["질문", "가격"],
        },
    )

    mock_sb = MagicMock()
    table_chain = MagicMock()
    table_chain.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": 123,
                "score": 7,
                "source": "naver_cafe_question",
                "metadata": {
                    "sources": ["naver_cafe_question"],
                    "keywords": ["모듈러주택"],
                    "encounters": 1,
                },
            }
        ]
    )
    table_chain.update.return_value.eq.return_value.execute.return_value = MagicMock()
    mock_sb.table.return_value = table_chain

    with patch("app.channels.naver_cafe.get_supabase", return_value=mock_sb):
        lead_id = await channel.save_lead_to_db(candidate, score=11)

    assert lead_id == 123
    update_payload = table_chain.update.call_args[0][0]
    assert update_payload["score"] == 11
    assert update_payload["metadata"]["encounters"] == 2
    assert "이동식주택" in update_payload["metadata"]["keywords"]
