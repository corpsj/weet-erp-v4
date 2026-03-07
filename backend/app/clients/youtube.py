"""YouTube Data API v3 client for video and comment collection."""

import httpx
from pydantic import BaseModel
from app.core.config import Settings

settings = Settings()

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


class VideoItem(BaseModel):
    video_id: str
    title: str
    channel_title: str = ""
    description: str = ""
    view_count: int = 0
    published_at: str = ""


class Comment(BaseModel):
    comment_id: str
    author: str
    text: str
    like_count: int = 0
    published_at: str = ""


class YouTubeClient:
    """Async client for YouTube Data API v3."""

    DAILY_QUOTA = 10000  # units per day
    _quota_used = 0

    def __init__(self):
        self.api_key = settings.youtube.api_key

    def _check_quota(self, cost: int = 1):
        if self._quota_used + cost > self.DAILY_QUOTA:
            raise RuntimeError(
                f"YouTube API daily quota exceeded ({self.DAILY_QUOTA} units)"
            )
        self.__class__._quota_used += cost

    async def search_videos(self, query: str, max_results: int = 10) -> list[VideoItem]:
        """Search YouTube videos for given query. Costs 100 units."""
        self._check_quota(100)
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.get(
                    f"{YOUTUBE_API_BASE}/search",
                    params={
                        "q": query,
                        "part": "snippet",
                        "type": "video",
                        "maxResults": max_results,
                        "key": self.api_key,
                        "regionCode": "KR",
                        "relevanceLanguage": "ko",
                    },
                )
                response.raise_for_status()
                data = response.json()
                items = []
                for item in data.get("items", []):
                    snippet = item.get("snippet", {})
                    items.append(
                        VideoItem(
                            video_id=item["id"]["videoId"],
                            title=snippet.get("title", ""),
                            channel_title=snippet.get("channelTitle", ""),
                            description=snippet.get("description", ""),
                            published_at=snippet.get("publishedAt", ""),
                        )
                    )
                return items
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    raise ValueError(
                        "YouTube API: Quota exceeded or invalid key"
                    ) from e
                raise

    async def get_comments(self, video_id: str, max_results: int = 20) -> list[Comment]:
        """Get top comments for a video. Costs 1 unit."""
        self._check_quota(1)
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.get(
                    f"{YOUTUBE_API_BASE}/commentThreads",
                    params={
                        "videoId": video_id,
                        "part": "snippet",
                        "maxResults": max_results,
                        "order": "relevance",
                        "key": self.api_key,
                    },
                )
                response.raise_for_status()
                data = response.json()
                comments = []
                for item in data.get("items", []):
                    top = item["snippet"]["topLevelComment"]["snippet"]
                    comments.append(
                        Comment(
                            comment_id=item["id"],
                            author=top.get("authorDisplayName", ""),
                            text=top.get("textDisplay", ""),
                            like_count=top.get("likeCount", 0),
                            published_at=top.get("publishedAt", ""),
                        )
                    )
                return comments
            except httpx.HTTPStatusError as e:
                raise

    async def get_channel_videos(
        self, channel_id: str, max_results: int = 10
    ) -> list[VideoItem]:
        """Get recent videos from a specific channel. Costs 1 unit."""
        self._check_quota(1)
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.get(
                    f"{YOUTUBE_API_BASE}/search",
                    params={
                        "channelId": channel_id,
                        "part": "snippet",
                        "type": "video",
                        "order": "date",
                        "maxResults": max_results,
                        "key": self.api_key,
                    },
                )
                response.raise_for_status()
                data = response.json()
                items = []
                for item in data.get("items", []):
                    snippet = item.get("snippet", {})
                    items.append(
                        VideoItem(
                            video_id=item["id"]["videoId"],
                            title=snippet.get("title", ""),
                            channel_title=snippet.get("channelTitle", ""),
                            description=snippet.get("description", ""),
                            published_at=snippet.get("publishedAt", ""),
                        )
                    )
                return items
            except httpx.HTTPStatusError:
                raise
