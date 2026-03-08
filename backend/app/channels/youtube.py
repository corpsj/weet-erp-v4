"""YouTube Channel -- read-only monitoring and lead collection.
Upload is manual only (no Write API for this sprint).
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from typing import Optional

from app.channels.instagram import LeadCandidate
from app.clients.youtube import YouTubeClient
from app.content.generator import ContentGenerator
from app.db.session import get_supabase
from app.leads.scorer import LeadScorer

logger = logging.getLogger(__name__)


@dataclass
class VideoInfo:
    video_id: str
    title: str
    channel_title: str
    view_count: int = 0
    published_at: str = ""


@dataclass
class ScriptResult:
    topic: str
    title: str
    body: str
    format: str = "short"


class YouTubeChannel:
    """YouTube channel for monitoring and lead collection (read-only)."""

    SEARCH_QUERIES = ["이동식주택 후기", "모듈러주택 가격", "농막 추천"]
    INTENT_KEYWORDS = ["가격", "얼마", "문의", "구매", "견적", "상담"]

    def __init__(self):
        self.client = YouTubeClient()

    async def monitor_videos(self, keywords: list[str]) -> list[VideoInfo]:
        """Monitor YouTube for trending videos on modular housing topics."""
        videos: list[VideoInfo] = []
        for keyword in keywords[:2]:  # quota protection
            try:
                items = await self.client.search_videos(keyword, max_results=5)
                for item in items:
                    videos.append(
                        VideoInfo(
                            video_id=item.video_id,
                            title=item.title,
                            channel_title=item.channel_title,
                            view_count=item.view_count,
                            published_at=item.published_at,
                        )
                    )
            except Exception:
                continue
        return videos

    async def collect_commenters(self, video_id: str) -> list[LeadCandidate]:
        """Collect commenter usernames as lead candidates."""
        leads: list[LeadCandidate] = []
        try:
            comments = await self.client.get_comments(video_id, max_results=20)
            for comment in comments:
                leads.append(
                    LeadCandidate(
                        username=comment.author,
                        platform="youtube",
                        source="youtube_commenter",
                        metadata={
                            "comment": comment.text[:200],
                            "video_id": video_id,
                        },
                    )
                )
        except Exception as e:
            logger.warning("Failed to collect commenters for video %s: %s", video_id, e)
        return leads

    async def collect_leads(self) -> list[LeadCandidate]:
        unique_leads: dict[str, LeadCandidate] = {}

        for query in self.SEARCH_QUERIES:
            try:
                videos = await self.client.search_videos(query, max_results=3)
            except Exception as exc:
                logger.warning("YouTube search failed for '%s': %s", query, exc)
                continue

            for video in videos[:3]:
                try:
                    comments = await self.client.get_comments(
                        video.video_id, max_results=15
                    )
                except Exception as exc:
                    logger.warning(
                        "YouTube comments fetch failed video=%s: %s",
                        video.video_id,
                        exc,
                    )
                    continue

                for comment in comments:
                    intent_matches = [
                        keyword
                        for keyword in self.INTENT_KEYWORDS
                        if keyword in comment.text
                    ]
                    if not intent_matches:
                        continue

                    username = (comment.author or "").strip() or "unknown"
                    lead = LeadCandidate(
                        username=username,
                        platform="youtube",
                        source="youtube_commenter",
                        metadata={
                            "query": query,
                            "video_id": video.video_id,
                            "video_title": video.title,
                            "comment_id": comment.comment_id,
                            "comment": comment.text[:300],
                            "like_count": comment.like_count,
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

        intent_hits = len(candidate.metadata.get("intent_matches") or [])
        like_count = int(candidate.metadata.get("like_count") or 0)
        like_bonus = 2 if like_count >= 3 else 1 if like_count >= 1 else 0
        return base + min(4, intent_hits * 2) + like_bonus

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

            queries = old_metadata.get("queries", [])
            if not isinstance(queries, list):
                queries = []
            query = candidate.metadata.get("query")
            if isinstance(query, str) and query and query not in queries:
                queries.append(query)

            videos = old_metadata.get("videos", [])
            if not isinstance(videos, list):
                videos = []
            video_id = candidate.metadata.get("video_id")
            if isinstance(video_id, str) and video_id and video_id not in videos:
                videos.append(video_id)

            comments = old_metadata.get("recent_comments", [])
            if not isinstance(comments, list):
                comments = []
            current_comment = candidate.metadata.get("comment")
            if isinstance(current_comment, str) and current_comment:
                comments = [current_comment, *comments][:5]

            merged_metadata: dict[str, Any] = {
                **old_metadata,
                **candidate.metadata,
                "sources": sources,
                "queries": queries,
                "videos": videos,
                "recent_comments": comments,
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
                "queries": [candidate.metadata.get("query")]
                if candidate.metadata.get("query")
                else [],
                "videos": [candidate.metadata.get("video_id")]
                if candidate.metadata.get("video_id")
                else [],
                "recent_comments": [candidate.metadata.get("comment")]
                if candidate.metadata.get("comment")
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

    async def generate_shorts_script(self, topic: str) -> ScriptResult:
        """Generate a YouTube Shorts script for the given topic."""
        gen = ContentGenerator()
        script = await gen.generate_youtube_script(topic, format="short")
        return ScriptResult(
            topic=topic,
            title=script.title,
            body=script.body,
            format="short",
        )
