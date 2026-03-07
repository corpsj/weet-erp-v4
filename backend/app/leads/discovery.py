import random
from datetime import datetime, timezone
from typing import Union, cast

from app.core.discord_bot import DiscordBot
from app.db.models import Lead
from app.db.session import get_supabase
from app.leads.persona import PersonaClassifier
from app.leads.scorer import LeadScorer

OPERATING_HOURS_START = 7
OPERATING_HOURS_END = 23


class DailyLimitTracker:
    def __init__(
        self, likes: int = 150, follows: int = 50, comments: int = 30, dms: int = 15
    ):
        self.limits: dict[str, int] = {
            "likes": likes,
            "follows": follows,
            "comments": comments,
            "dms": dms,
        }
        self.counts: dict[str, int] = {
            "likes": 0,
            "follows": 0,
            "comments": 0,
            "dms": 0,
        }

    def record(self, action_type: str) -> bool:
        if action_type not in self.limits:
            return True
        if self.counts[action_type] >= self.limits[action_type]:
            raise RuntimeError(
                f"Daily {action_type} limit exceeded ({self.limits[action_type]})"
            )
        self.counts[action_type] += 1
        return True

    def reset(self) -> None:
        self.counts = {k: 0 for k in self.counts}

    def remaining(self, action_type: str) -> int:
        return max(0, self.limits.get(action_type, 0) - self.counts.get(action_type, 0))


class LeadDiscovery:
    def __init__(self):
        self.scorer: LeadScorer = LeadScorer()
        self.persona_classifier: PersonaClassifier = PersonaClassifier()
        self.discord: DiscordBot = DiscordBot()
        self.limit_tracker: DailyLimitTracker = DailyLimitTracker()

    def _random_delay(self) -> float:
        return random.uniform(30, 90)

    def _is_operating_hours(self) -> bool:
        kst_hour = (datetime.now(timezone.utc).hour + 9) % 24
        return OPERATING_HOURS_START <= kst_hour < OPERATING_HOURS_END

    async def save_lead(
        self,
        username: str,
        platform: str,
        source: str,
        metadata: Union[dict[str, object], None] = None,
    ) -> Lead:
        scored = self.scorer.score(username, platform, source)
        bio_value = metadata.get("bio") if metadata else ""
        activity = bio_value if isinstance(bio_value, str) else ""

        keywords_value: object = metadata.get("keywords") if metadata else []
        keywords = (
            [
                item
                for item in cast(list[object], keywords_value)
                if isinstance(item, str)
            ]
            if isinstance(keywords_value, list)
            else []
        )

        persona = self.persona_classifier.classify(
            activity=activity,
            keywords=keywords,
        )

        sb = get_supabase()
        result = (
            sb.table("marketing_leads")
            .insert(
                {
                    "platform": platform,
                    "username": username,
                    "score": scored.score,
                    "persona_type": persona.value,
                    "source": source,
                    "metadata": metadata or {},
                }
            )
            .execute()
        )

        if self.scorer.is_hot_lead(scored.score):
            _ = self.discord.send_alert(
                "hot_lead",
                (
                    f"🔥 핫리드 감지: @{username} "
                    f"(score: {scored.score}, persona: {persona.value})"
                ),
            )

        if result.data and len(result.data) > 0:
            lead_data = result.data[0]
            return Lead(
                id=lead_data.get("id"),
                platform=platform,
                username=username,
                score=scored.score,
                persona_type=persona.value,
                source=source,
                metadata_=metadata or {},
            )

        return Lead(
            platform=platform,
            username=username,
            score=scored.score,
            persona_type=persona.value,
            source=source,
            metadata_=metadata or {},
        )
