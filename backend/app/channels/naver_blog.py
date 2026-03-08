"""Naver Blog Channel -- AI draft generation + manual publish workflow.
IMPORTANT: Naver Blog has NO Write API. Drafts only. Human publishes manually.
"""

from dataclasses import dataclass, field
from typing import Optional

from app.content.generator import ContentGenerator
from app.core.notification_service import NotificationService
from app.db.session import get_supabase
from app.db.models import Content


@dataclass
class BlogDraft:
    topic: str
    title: str
    body: str
    keywords: list[str] = field(default_factory=list)
    id: Optional[int] = None


class NaverBlogChannel:
    """Naver blog channel -- generates drafts for manual publishing."""

    def __init__(self):
        self.generator = ContentGenerator()
        self.notifier = NotificationService()

    async def generate_draft(self, topic: str, keywords: list[str]) -> BlogDraft:
        """Generate a blog article draft using AI."""
        article = await self.generator.generate_blog_article(topic, keywords)
        draft = BlogDraft(
            topic=topic,
            title=article.title,
            body=article.body,
            keywords=keywords,
        )
        # Save to DB
        draft.id = await self._save_draft(draft)
        # Notify via notifier
        self.notifier.send_message(
            f"\U0001f4dd \uc0c8 \ube14\ub85c\uadf8 \ucd08\uc548\uc774 \uc900\ube44\ub410\uc2b5\ub2c8\ub2e4!\n"
            f"\uc81c\ubaa9: {draft.title}\n"
            f"\uae38\uc774: {len(draft.body)}\uc790\n"
            f"\u26a0\ufe0f \uc218\ub3d9\uc73c\ub85c \ubc1c\ud589\ud574\uc8fc\uc138\uc694 (\ub124\uc774\ubc84 \ube14\ub85c\uadf8 Write API \uc5c6\uc74c)"
        )
        return draft

    async def save_draft(self, draft: BlogDraft) -> int:
        """Save draft to DB (alias for internal use)."""
        return await self._save_draft(draft)

    async def _save_draft(self, draft: BlogDraft) -> int:
        """Save draft to DB, return ID."""
        sb = get_supabase()
        result = (
            sb.table("marketing_contents")
            .insert(
                {
                    "channel": "blog",
                    "title": draft.title,
                    "body": draft.body,
                    "status": "draft",
                }
            )
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data[0].get("id", 0)
        return 0

    async def list_drafts(self) -> list[BlogDraft]:
        """List all unpublished blog drafts."""
        sb = get_supabase()
        result = (
            sb.table("marketing_contents")
            .select("*")
            .eq("channel", "blog")
            .eq("status", "draft")
            .execute()
        )
        drafts = []
        if result.data:
            for c in result.data:
                drafts.append(
                    BlogDraft(
                        topic=c.get("title", ""),
                        title=c.get("title", ""),
                        body=c.get("body", ""),
                        id=c.get("id"),
                    )
                )
        return drafts
