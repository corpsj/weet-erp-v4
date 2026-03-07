"""External API clients for Naver and YouTube."""

from app.clients.naver import NaverClient, NewsItem, BlogItem, CafeItem
from app.clients.youtube import YouTubeClient, VideoItem, Comment

__all__ = [
    "NaverClient",
    "NewsItem",
    "BlogItem",
    "CafeItem",
    "YouTubeClient",
    "VideoItem",
    "Comment",
]
