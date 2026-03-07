"""Naver Cafe Channel -- official Write API for posting to own cafe.
API: POST https://openapi.naver.com/v1/cafe/{cafeId}/articles
Requires OAuth 2.0 token.
"""

import httpx
from dataclasses import dataclass
from typing import Optional

from app.channels.instagram import LeadCandidate
from app.clients.naver import NaverClient
from app.core.config import Settings

settings = Settings()
CAFE_API_BASE = "https://openapi.naver.com/v1/cafe"


@dataclass
class PostResult:
    success: bool
    article_id: Optional[str] = None
    error: Optional[str] = None


class NaverCafeChannel:
    """Naver Cafe channel using official Write API."""

    def __init__(
        self,
        cafe_id: Optional[str] = None,
        oauth_token: Optional[str] = None,
    ):
        self.cafe_id = cafe_id or "weet_cafe"
        self.oauth_token = oauth_token or ""
        self.naver_client = NaverClient()

    async def post_article(self, cafe_id: str, title: str, content: str) -> PostResult:
        """Post an article to Naver Cafe using official Write API."""
        if not self.oauth_token:
            return PostResult(success=False, error="OAuth token not configured")

        url = f"{CAFE_API_BASE}/{cafe_id}/articles"
        headers = {
            "Authorization": f"Bearer {self.oauth_token}",
            "Content-Type": "application/json",
        }
        payload = {"title": title, "content": content, "menuId": 0}

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code in (200, 201):
                    data = response.json()
                    return PostResult(
                        success=True,
                        article_id=str(data.get("articleId", "")),
                    )
                return PostResult(success=False, error=f"HTTP {response.status_code}")
            except Exception as e:
                return PostResult(success=False, error=str(e))

    async def monitor_questions(
        self, cafe_id: str, keywords: list[str]
    ) -> list[LeadCandidate]:
        """Find question posts about modular housing in Naver Cafe."""
        leads: list[LeadCandidate] = []
        for keyword in keywords[:3]:
            try:
                items = await self.naver_client.search_cafearticle(keyword, display=5)
                for item in items:
                    if (
                        "?" in item.title
                        or "\uc9c8\ubb38" in item.title
                        or "\ubb38\uc758" in item.title
                    ):
                        leads.append(
                            LeadCandidate(
                                username=item.cafename or "unknown",
                                platform="naver_cafe",
                                source="naver_cafe_question",
                                metadata={
                                    "title": item.title,
                                    "url": item.link,
                                },
                            )
                        )
            except Exception:
                continue
        return leads

    async def post_answer(
        self, cafe_id: str, article_id: str, content: str
    ) -> PostResult:
        """Post an answer/comment to a cafe question."""
        if not self.oauth_token:
            return PostResult(success=False, error="OAuth token not configured")

        url = f"{CAFE_API_BASE}/{cafe_id}/articles/{article_id}/comments"
        headers = {
            "Authorization": f"Bearer {self.oauth_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.post(
                    url, json={"content": content}, headers=headers
                )
                return PostResult(success=response.status_code in (200, 201))
            except Exception as e:
                return PostResult(success=False, error=str(e))
