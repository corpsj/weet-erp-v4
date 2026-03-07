"""Instagram Channel Module — lead collection + engagement using instagrapi."""

import asyncio
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.clients.instagram_client import InstagrapiClient
from app.core.config import Settings
from app.core.discord_bot import DiscordBot
from app.db.models import Lead, LeadAction
from app.db.session import get_supabase
from app.leads.discovery import DailyLimitTracker

logger = logging.getLogger(__name__)

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
        try:
            supabase = get_supabase()
        except Exception:
            supabase = None
        self.limit_tracker = DailyLimitTracker(
            likes=150,
            follows=50,
            comments=30,
            dms=15,
            supabase_client=supabase,
        )
        self._session_cookie: Optional[str] = None  # instagrapi session reuse
        self._instagrapi_wrapper: Optional[InstagrapiClient] = None
        self._ig_client = None
        self._cooldown_until: Optional[datetime] = None

    def _is_operating_hours(self) -> bool:
        """Check if within KST operating hours (07:00-23:00)."""
        kst_hour = (datetime.now(timezone.utc).hour + 9) % 24
        return OPERATING_HOURS_START <= kst_hour < OPERATING_HOURS_END

    def _is_in_cooldown(self) -> bool:
        """Check if currently in action block cooldown period."""
        if self._cooldown_until is None:
            return False
        return datetime.now(timezone.utc) < self._cooldown_until

    def _handle_action_block(self) -> None:
        """Handle Instagram action block: set 24h cooldown + Discord alert."""
        self._cooldown_until = datetime.now(timezone.utc) + timedelta(hours=24)
        logger.error(
            "Instagram ACTION_BLOCK detected. Cooldown until %s",
            self._cooldown_until,
        )
        try:
            self.discord.send_alert(
                "error",
                f"Instagram 액션 블록 감지! 24시간 쿨다운 시작. 종료: {self._cooldown_until}",
            )
        except Exception as exc:
            logger.warning("Failed to send Discord alert for action block: %s", exc)

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

    def _get_authenticated_client(self):
        """Lazy-initialize and return authenticated instagrapi Client, or None."""
        if self._ig_client is not None:
            return self._ig_client
        try:
            settings = Settings()
            ig_config = settings.instagram
            if not ig_config.username or not ig_config.password:
                logger.warning("Instagram credentials not configured")
                return None
            wrapper = InstagrapiClient(
                username=ig_config.username,
                password=ig_config.password,
                session_dir=ig_config.session_dir,
            )
            if not wrapper.login():
                logger.error("Failed to login to Instagram as %s", ig_config.username)
                return None
            self._instagrapi_wrapper = wrapper
            self._ig_client = wrapper.get_client()
            return self._ig_client
        except Exception as exc:
            logger.error("Failed to initialize instagrapi client: %s", exc)
            return None

    async def get_competitor_commenters(
        self, username: str | None = None
    ) -> list[LeadCandidate]:
        """Collect leads from competitor's post commenters via instagrapi."""
        if not self._is_operating_hours():
            logger.info("Outside operating hours, skipping competitor commenters")
            return []
        if self._is_in_cooldown():
            logger.info("Skipping lead collection: in action block cooldown")
            return []

        client = self._get_authenticated_client()
        if client is None:
            return []

        competitors = get_instagram_settings("instagram_competitors")
        if not competitors:
            logger.info("No competitor accounts configured")
            return []

        leads: list[LeadCandidate] = []
        for competitor in competitors:
            try:
                await asyncio.sleep(self._random_delay())
                user_id = client.user_id_from_username(competitor)
                medias = client.user_medias(user_id, amount=5)

                for media in medias:
                    try:
                        await asyncio.sleep(self._random_delay())
                        comments = client.media_comments(media.pk)
                        for comment in comments:
                            commenter_name = comment.user.username
                            if self._is_bot_account(commenter_name):
                                continue
                            lead = LeadCandidate(
                                username=commenter_name,
                                platform="instagram",
                                source="competitor_comment",
                                metadata={
                                    "source_account": competitor,
                                    "media_id": str(media.pk),
                                },
                            )
                            await self.save_lead_to_db(lead)
                            leads.append(lead)
                    except Exception as exc:
                        exc_text = str(exc).lower()
                        if (
                            "action_block" in exc_text
                            or "action blocked" in exc_text
                            or "temporarily blocked" in exc_text
                        ):
                            self._handle_action_block()
                            return leads
                        logger.error(
                            "Error fetching comments for media %s: %s", media.pk, exc
                        )
                        continue
            except Exception as exc:
                exc_text = str(exc).lower()
                if (
                    "action_block" in exc_text
                    or "action blocked" in exc_text
                    or "temporarily blocked" in exc_text
                ):
                    self._handle_action_block()
                    return leads
                elif "private" in exc_text:
                    logger.warning("Competitor %s is private, skipping", competitor)
                elif "not found" in exc_text or "doesn't exist" in exc_text:
                    logger.warning("Competitor %s not found, skipping", competitor)
                else:
                    logger.error(
                        "Error collecting commenters from %s: %s", competitor, exc
                    )
                continue

        return leads

    async def get_competitor_likers(
        self, post_id: str | None = None
    ) -> list[LeadCandidate]:
        """Collect leads from competitor's post likers via instagrapi."""
        if not self._is_operating_hours():
            logger.info("Outside operating hours, skipping competitor likers")
            return []
        if self._is_in_cooldown():
            logger.info("Skipping lead collection: in action block cooldown")
            return []

        client = self._get_authenticated_client()
        if client is None:
            return []

        competitors = get_instagram_settings("instagram_competitors")
        if not competitors:
            logger.info("No competitor accounts configured")
            return []

        leads: list[LeadCandidate] = []
        for competitor in competitors:
            try:
                await asyncio.sleep(self._random_delay())
                user_id = client.user_id_from_username(competitor)
                medias = client.user_medias(user_id, amount=5)

                for media in medias:
                    try:
                        await asyncio.sleep(self._random_delay())
                        likers = client.media_likers(media.pk)
                        for liker in likers:
                            if self._is_bot_account(liker.username):
                                continue
                            lead = LeadCandidate(
                                username=liker.username,
                                platform="instagram",
                                source="competitor_liker",
                                metadata={
                                    "source_account": competitor,
                                    "media_id": str(media.pk),
                                },
                            )
                            await self.save_lead_to_db(lead)
                            leads.append(lead)
                    except Exception as exc:
                        exc_text = str(exc).lower()
                        if (
                            "action_block" in exc_text
                            or "action blocked" in exc_text
                            or "temporarily blocked" in exc_text
                        ):
                            self._handle_action_block()
                            return leads
                        logger.error(
                            "Error fetching likers for media %s: %s", media.pk, exc
                        )
                        continue
            except Exception as exc:
                exc_text = str(exc).lower()
                if (
                    "action_block" in exc_text
                    or "action blocked" in exc_text
                    or "temporarily blocked" in exc_text
                ):
                    self._handle_action_block()
                    return leads
                elif "private" in exc_text:
                    logger.warning("Competitor %s is private, skipping", competitor)
                elif "not found" in exc_text or "doesn't exist" in exc_text:
                    logger.warning("Competitor %s not found, skipping", competitor)
                else:
                    logger.error("Error collecting likers from %s: %s", competitor, exc)
                continue

        return leads

    async def get_hashtag_users(
        self, hashtag: str | None = None
    ) -> list[LeadCandidate]:
        """Collect leads from hashtag recent posts via instagrapi."""
        if not self._is_operating_hours():
            logger.info("Outside operating hours, skipping hashtag users")
            return []
        if self._is_in_cooldown():
            logger.info("Skipping lead collection: in action block cooldown")
            return []

        client = self._get_authenticated_client()
        if client is None:
            return []

        hashtags = get_instagram_settings("instagram_target_hashtags")
        if not hashtags:
            logger.info("No target hashtags configured")
            return []

        leads: list[LeadCandidate] = []
        seen_usernames: set[str] = set()

        for tag in hashtags:
            try:
                await asyncio.sleep(self._random_delay())
                medias = client.hashtag_medias_recent(tag, amount=20)

                for media in medias:
                    author = media.user.username
                    if author in seen_usernames:
                        continue
                    seen_usernames.add(author)

                    if self._is_bot_account(author):
                        continue

                    lead = LeadCandidate(
                        username=author,
                        platform="instagram",
                        source="hashtag",
                        metadata={
                            "hashtag": tag,
                            "media_id": str(media.pk),
                        },
                    )
                    await self.save_lead_to_db(lead)
                    leads.append(lead)
            except Exception as exc:
                exc_text = str(exc).lower()
                if (
                    "action_block" in exc_text
                    or "action blocked" in exc_text
                    or "temporarily blocked" in exc_text
                ):
                    self._handle_action_block()
                    return leads
                elif "restricted" in exc_text or "blocked" in exc_text:
                    logger.warning("Hashtag '%s' is restricted, skipping", tag)
                else:
                    logger.error(
                        "Error collecting users from hashtag '%s': %s", tag, exc
                    )
                continue

        return leads

    async def like_post(self, post_id: str) -> bool:
        """Like a post with rate limit and delay check."""
        if not self._is_operating_hours():
            return False
        if self._is_in_cooldown():
            logger.info("Skipping like_post: in action block cooldown")
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
        if self._is_in_cooldown():
            logger.info("Skipping follow_user: in action block cooldown")
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
