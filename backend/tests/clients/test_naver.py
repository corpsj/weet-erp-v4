import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.naver import NaverClient, NewsItem, BlogItem


@pytest.fixture
def naver_client():
    NaverClient._call_count = 0  # reset quota
    return NaverClient()


@pytest.mark.asyncio
async def test_search_news_returns_items(naver_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "title": "이동식주택 인기",
                "link": "https://news.example.com/1",
                "description": "귀촌 수요 급증",
                "pubDate": "Mon, 01 Jan 2026",
                "originallink": "",
            },
            {
                "title": "모듈러주택 보조금",
                "link": "https://news.example.com/2",
                "description": "2026년 귀촌 지원금",
                "pubDate": "Tue, 02 Jan 2026",
                "originallink": "",
            },
        ]
    }
    mock_response.raise_for_status = MagicMock()
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_ctx
        results = await naver_client.search_news("이동식주택", display=2)
    assert len(results) == 2
    assert isinstance(results[0], NewsItem)
    assert results[0].title == "이동식주택 인기"


@pytest.mark.asyncio
async def test_search_blog_returns_items(naver_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "title": "전원주택 후기",
                "link": "https://blog.example.com",
                "description": "귀촌 블로그",
                "bloggername": "user1",
                "postdate": "20260101",
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_ctx
        results = await naver_client.search_blog("전원주택")
    assert len(results) == 1
    assert results[0].bloggername == "user1"


def test_quota_exceeded_raises_error(naver_client):
    naver_client.__class__._call_count = 25000
    with pytest.raises(RuntimeError, match="quota exceeded"):
        naver_client._check_quota()


@pytest.mark.asyncio
async def test_401_raises_value_error(naver_client):
    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 401
    http_err = httpx.HTTPStatusError("401", request=MagicMock(), response=mock_response)
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        mock_response.raise_for_status.side_effect = http_err
        mock_client_class.return_value = mock_ctx
        with pytest.raises(ValueError, match="credentials"):
            await naver_client.search_news("test")
