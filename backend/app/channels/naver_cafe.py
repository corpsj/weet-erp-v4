import httpx
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.channels.instagram import LeadCandidate
from app.clients.naver import NaverClient
from app.core.config import Settings
from app.db.session import get_supabase
from app.leads.scorer import LeadScorer

settings = Settings()
CAFE_API_BASE = "https://openapi.naver.com/v1/cafe"
logger = logging.getLogger(__name__)


@dataclass
class PostResult:
    success: bool
    article_id: Optional[str] = None
    error: Optional[str] = None


class NaverCafeChannel:
    """Collects leads from Naver cafe questions about modular housing."""

    LEAD_KEYWORDS = [
        "이동식주택",
        "모듈러주택",
        "농막",
        "컨테이너하우스",
        "세컨하우스",
    ]
    QUESTION_KEYWORDS = ["?", "질문", "문의", "얼마", "가격", "추천", "가능"]

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

    async def collect_leads(self) -> list[LeadCandidate]:
        unique_leads: dict[str, LeadCandidate] = {}

        for keyword in self.LEAD_KEYWORDS:
            try:
                items = await self.naver_client.search_cafearticle(keyword, display=8)
            except Exception as exc:
                logger.warning("Naver cafe search failed for '%s': %s", keyword, exc)
                continue

            for item in items:
                text = f"{item.title} {item.description}".lower()
                intent_matches = [
                    token for token in self.QUESTION_KEYWORDS if token in text
                ]
                if not intent_matches:
                    continue

                username = (item.cafename or "").strip() or "unknown"
                lead = LeadCandidate(
                    username=username,
                    platform="naver_cafe",
                    source="naver_cafe_question",
                    metadata={
                        "keyword": keyword,
                        "title": item.title,
                        "description": item.description,
                        "url": item.link,
                        "cafe_name": item.cafename,
                        "intent_matches": intent_matches,
                    },
                )
                score = self._calculate_score(lead)
                await self.save_lead_to_db(lead, score)
                unique_leads[username] = lead

        return list(unique_leads.values())

    def _calculate_score(self, candidate: LeadCandidate) -> int:
        scorer = LeadScorer()
        base = scorer.score(
            username=candidate.username,
            platform=candidate.platform,
            source=candidate.source,
        ).score

        title = str(candidate.metadata.get("title") or "").lower()
        description = str(candidate.metadata.get("description") or "").lower()
        text = f"{title} {description}"

        keyword_hits = sum(
            1 for keyword in self.LEAD_KEYWORDS if keyword.lower() in text
        )
        intent_hits = len(candidate.metadata.get("intent_matches") or [])

        return base + min(4, keyword_hits * 2) + min(4, intent_hits)

    async def save_lead_to_db(
        self, candidate: LeadCandidate, score: int
    ) -> Optional[int]:
        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        existing = (
            sb.table("marketing_leads")
            .select("id, score, source, metadata")
            .eq("platform", candidate.platform)
            .eq("username", candidate.username)
            .limit(1)
            .execute()
        )

        if existing.data:
            row = existing.data[0]
            lead_id = row.get("id")
            old_score = int(row.get("score") or 0)
            old_metadata = (
                row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            )

            sources = old_metadata.get("sources", [])
            if not isinstance(sources, list):
                sources = []
            if candidate.source not in sources:
                sources.append(candidate.source)

            keywords = old_metadata.get("keywords", [])
            if not isinstance(keywords, list):
                keywords = []
            keyword = candidate.metadata.get("keyword")
            if isinstance(keyword, str) and keyword and keyword not in keywords:
                keywords.append(keyword)

            merged_metadata: dict[str, Any] = {
                **old_metadata,
                **candidate.metadata,
                "sources": sources,
                "keywords": keywords,
                "encounters": int(old_metadata.get("encounters") or 1) + 1,
                "last_seen_at": now,
            }

            sb.table("marketing_leads").update(
                {
                    "score": max(old_score, score),
                    "source": candidate.source,
                    "metadata": merged_metadata,
                }
            ).eq("id", lead_id).execute()

            candidate.id = lead_id
            candidate.metadata = merged_metadata
            return lead_id

        payload = {
            "platform": candidate.platform,
            "username": candidate.username,
            "source": candidate.source,
            "score": score,
            "metadata": {
                **candidate.metadata,
                "sources": [candidate.source],
                "keywords": [candidate.metadata.get("keyword")]
                if candidate.metadata.get("keyword")
                else [],
                "encounters": 1,
                "first_seen_at": now,
                "last_seen_at": now,
            },
        }

        result = sb.table("marketing_leads").insert(payload).execute()
        if result.data:
            lead_id = result.data[0].get("id")
            candidate.id = lead_id
            return lead_id
        return None

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
