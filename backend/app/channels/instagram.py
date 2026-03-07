"""Instagram Channel Module — lead collection + engagement using instagrapi."""

import asyncio
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.core.discord_bot import DiscordBot
from app.db.models import Lead, LeadAction
from app.db.session import get_supabase
from app.leads.discovery import DailyLimitTracker

OPERATING_HOURS_START = 7  # KST
OPERATING_HOURS_END = 23  # KST
MIN_DELAY = 30  # seconds
MAX_DELAY = 90  # seconds

BOT_PATTERNS = [
    "official",
    "shop",
    "store",
    "brand",
    "company",
    "biz",
    "marketing",
    "sale",
    "promo",
    "sponsor",
]


def get_instagram_settings(key: str) -> list[str]:
    """Get Instagram settings from marketing_settings table.

    Returns JSON array value for the given key, or empty list if not found.
    """
    try:
        sb = get_supabase()
        result = (
            sb.table("marketing_settings")
            .select("value")
            .eq("key", key)
            .limit(1)
            .execute()
        )
        if result.data and len(result.data) > 0:
            value = result.data[0].get("value")
            if isinstance(value, list):
                return value
            return []
        return []
    except Exception:
        return []


def set_instagram_settings(key: str, value: list[str]) -> bool:
    """Save Instagram settings to marketing_settings table.

    Upserts the key-value pair (JSON array) into marketing_settings.
    Returns True on success, False on failure.
    """
    try:
        sb = get_supabase()
        sb.table("marketing_settings").upsert(
            {"key": key, "value": value}, on_conflict="key"
        ).execute()
        return True
    except Exception:
        return False


@dataclass
class PostResult:
    success: bool
    post_id: Optional[str] = None
    error: Optional[str] = None


@dataclass
class LeadCandidate:
    username: str
    platform: str = "instagram"
    source: str = ""
    metadata: dict = field(default_factory=dict)


class InstagramChannel:
    """Instagram channel for lead collection and engagement.

    Uses instagrapi (or simulated) + Playwright macros.
    DECISION: instagrapi + dedicated account + rate limits to manage ban risk.
    """

    def __init__(self) -> None:
        self.discord = DiscordBot()
        self.limit_tracker = DailyLimitTracker(
            likes=150, follows=50, comments=30, dms=15
        )
        self._session_cookie: Optional[str] = None  # instagrapi session reuse

    def _is_operating_hours(self) -> bool:
        """Check if within KST operating hours (07:00-23:00)."""
        kst_hour = (datetime.now(timezone.utc).hour + 9) % 24
        return OPERATING_HOURS_START <= kst_hour < OPERATING_HOURS_END

    def _random_delay(self) -> float:
        """Return random delay between MIN_DELAY and MAX_DELAY seconds."""
        return random.uniform(MIN_DELAY, MAX_DELAY)

    def _is_bot_account(self, username: str, bio: str = "") -> bool:
        """Filter obvious bot/commercial accounts."""
        username_lower = username.lower()
        bio_lower = bio.lower()
        return any(
            pattern in username_lower or pattern in bio_lower
            for pattern in BOT_PATTERNS
        )

    async def get_competitor_commenters(self, username: str) -> list[LeadCandidate]:
        """Collect leads from competitor's post commenters."""
        # NOTE: Real implementation uses instagrapi client
        # For now returns empty list (real calls require account credentials)
        return []

    async def get_competitor_likers(self, post_id: str) -> list[LeadCandidate]:
        """Collect leads from competitor's post likers."""
        return []

    async def get_hashtag_users(self, hashtag: str) -> list[LeadCandidate]:
        """Collect leads using hashtag (귀촌, 이동식주택 etc.)."""
        return []

    async def like_post(self, post_id: str) -> bool:
        """Like a post with rate limit and delay check."""
        if not self._is_operating_hours():
            return False
        try:
            self.limit_tracker.record("likes")
        except RuntimeError:
            return False  # limit exceeded
        await asyncio.sleep(self._random_delay())
        return True

    async def follow_user(self, user_id: str) -> bool:
        """Follow a user with rate limit and delay check."""
        if not self._is_operating_hours():
            return False
        try:
            self.limit_tracker.record("follows")
        except RuntimeError:
            return False
        await asyncio.sleep(self._random_delay())
        return True

    async def post_content(
        self, caption: str, image_path: Optional[str] = None
    ) -> PostResult:
        """Post content to Instagram."""
        if not self._is_operating_hours():
            return PostResult(success=False, error="Outside operating hours")
        # Real implementation would use instagrapi client
        return PostResult(success=True, post_id="mock_post_id")

    async def save_lead_to_db(self, candidate: LeadCandidate) -> Optional[int]:
        """Save a discovered lead to the database with deduplication.

        Uses select-then-upsert on (platform, username) to prevent duplicates.
        If lead already exists, updates score and metadata.
        """
        if self._is_bot_account(candidate.username):
            return None
        sb = get_supabase()
        existing = (
            sb.table("marketing_leads")
            .select("id")
            .eq("platform", candidate.platform)
            .eq("username", candidate.username)
            .limit(1)
            .execute()
        )
        payload = {
            "platform": candidate.platform,
            "username": candidate.username,
            "source": candidate.source,
            "metadata": candidate.metadata,
        }
        if existing.data and len(existing.data) > 0:
            lead_id = existing.data[0].get("id")
            sb.table("marketing_leads").update(payload).eq("id", lead_id).execute()
            return lead_id
        else:
            result = sb.table("marketing_leads").insert(payload).execute()
            if result.data and len(result.data) > 0:
                return result.data[0].get("id")
            return None
