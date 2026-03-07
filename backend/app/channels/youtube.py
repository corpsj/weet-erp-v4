"""YouTube Channel -- read-only monitoring and lead collection.
Upload is manual only (no Write API for this sprint).
"""

from dataclasses import dataclass, field
from typing import Optional

from app.channels.instagram import LeadCandidate
from app.clients.youtube import YouTubeClient
from app.content.generator import ContentGenerator


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
        except Exception:
            pass
        return leads

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
