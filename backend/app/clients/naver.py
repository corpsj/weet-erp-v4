"""Naver Open API client for news, blog, cafe search."""

import httpx
from pydantic import BaseModel
from typing import Optional
from app.core.config import Settings

settings = Settings()

NAVER_API_BASE = "https://openapi.naver.com/v1/search"


class NewsItem(BaseModel):
    title: str
    link: str
    description: str
    pub_date: str = ""
    originallink: str = ""


class BlogItem(BaseModel):
    title: str
    link: str
    description: str
    bloggername: str = ""
    postdate: str = ""


class CafeItem(BaseModel):
    title: str
    link: str
    description: str
    cafename: str = ""
    cafeurl: str = ""


class NaverClient:
    """Async client for Naver Open API search endpoints."""

    DAILY_LIMIT = 25000  # calls per day
    _call_count = 0

    def __init__(self):
        self.client_id = settings.naver.client_id
        self.client_secret = settings.naver.client_secret
        self.headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
        }

    def _check_quota(self):
        if self._call_count >= self.DAILY_LIMIT:
            raise RuntimeError(
                f"Naver API daily quota exceeded ({self.DAILY_LIMIT} calls)"
            )
        self.__class__._call_count += 1

    async def search_news(self, query: str, display: int = 10) -> list[NewsItem]:
        """Search Naver news for given query."""
        self._check_quota()
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.get(
                    f"{NAVER_API_BASE}/news.json",
                    params={"query": query, "display": display, "sort": "date"},
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()
                return [NewsItem(**item) for item in data.get("items", [])]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise ValueError("Naver API: Invalid credentials") from e
                if e.response.status_code == 429:
                    raise RuntimeError("Naver API: Rate limit hit") from e
                raise

    async def search_blog(self, query: str, display: int = 10) -> list[BlogItem]:
        """Search Naver blogs for given query."""
        self._check_quota()
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.get(
                    f"{NAVER_API_BASE}/blog.json",
                    params={"query": query, "display": display, "sort": "date"},
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()
                return [BlogItem(**item) for item in data.get("items", [])]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise ValueError("Naver API: Invalid credentials") from e
                raise

    async def search_cafearticle(self, query: str, display: int = 10) -> list[CafeItem]:
        """Search Naver cafe articles for given query."""
        self._check_quota()
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.get(
                    f"{NAVER_API_BASE}/cafearticle.json",
                    params={"query": query, "display": display},
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()
                return [CafeItem(**item) for item in data.get("items", [])]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise ValueError("Naver API: Invalid credentials") from e
                raise
