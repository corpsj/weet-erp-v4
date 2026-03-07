import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.youtube import YouTubeClient, VideoItem, Comment


@pytest.fixture
def yt_client():
    YouTubeClient._quota_used = 0
    return YouTubeClient()


@pytest.mark.asyncio
async def test_search_videos_returns_items(yt_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "id": {"videoId": "abc123"},
                "snippet": {
                    "title": "이동식주택 투어",
                    "channelTitle": "채널1",
                    "description": "모듈러 주택",
                    "publishedAt": "2026-01-01T00:00:00Z",
                },
            },
        ]
    }
    mock_response.raise_for_status = MagicMock()
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_ctx
        results = await yt_client.search_videos("이동식주택", max_results=1)
    assert len(results) == 1
    assert isinstance(results[0], VideoItem)
    assert results[0].video_id == "abc123"


@pytest.mark.asyncio
async def test_get_comments_returns_items(yt_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "id": "comment1",
                "snippet": {
                    "topLevelComment": {
                        "snippet": {
                            "authorDisplayName": "user1",
                            "textDisplay": "좋은 영상!",
                            "likeCount": 5,
                            "publishedAt": "2026-01-01T00:00:00Z",
                        }
                    }
                },
            }
        ]
    }
    mock_response.raise_for_status = MagicMock()
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_ctx
        results = await yt_client.get_comments("abc123")
    assert len(results) == 1
    assert results[0].author == "user1"
    assert results[0].like_count == 5


def test_quota_exceeded_raises_error(yt_client):
    yt_client.__class__._quota_used = 10000
    with pytest.raises(RuntimeError, match="quota exceeded"):
        yt_client._check_quota(1)
