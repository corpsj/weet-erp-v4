from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SourceType(str, Enum):
    competitor_comment = "competitor_comment"
    naver_cafe_question = "naver_cafe_question"
    high_intent_hashtag = "high_intent_hashtag"
    competitor_liker = "competitor_liker"
    youtube_commenter = "youtube_commenter"
    competitor_follower = "competitor_follower"


BASE_SCORE_MAP = {
    SourceType.competitor_comment: 8,
    SourceType.naver_cafe_question: 7,
    SourceType.high_intent_hashtag: 6,
    SourceType.competitor_liker: 5,
    SourceType.youtube_commenter: 4,
    SourceType.competitor_follower: 3,
}

BREADTH_BONUS = {1: 0, 2: 6, 3: 14}
BREADTH_BONUS_MAX = 22

DEPTH_BONUS = {1: 0, 2: 2, 3: 4, 4: 4}
DEPTH_BONUS_MAX = 6

ACTION_MIX_BONUS = 4

HOT_LEAD_THRESHOLD = 20
SUPER_HOT_THRESHOLD = 30


@dataclass
class ScoredLead:
    username: str
    platform: str
    source: str
    score: int
    is_hot: bool = False


@dataclass
class EngagementProfile:
    total_encounters: int = 0
    competitor_count: int = 0
    max_per_competitor: int = 0
    has_comments: bool = False
    has_likes: bool = False
    total_comment_count: int = 0
    total_like_count: int = 0


class LeadScorer:
    def score(self, username: str, platform: str, source: str) -> ScoredLead:
        try:
            source_type = SourceType(source)
            base_score = BASE_SCORE_MAP.get(source_type, 1)
        except ValueError:
            base_score = 1

        is_hot = base_score >= HOT_LEAD_THRESHOLD
        return ScoredLead(
            username=username,
            platform=platform,
            source=source,
            score=base_score,
            is_hot=is_hot,
        )

    def score_with_engagement(
        self, username: str, platform: str, metadata: dict[str, Any]
    ) -> ScoredLead:
        by_competitor: dict[str, Any] = metadata.get("by_competitor", {})
        total_comment_count: int = metadata.get("total_comment_count", 0)
        total_like_count: int = metadata.get("total_like_count", 0)

        has_comments = total_comment_count > 0
        has_likes = total_like_count > 0
        best_source = (
            SourceType.competitor_comment
            if has_comments
            else SourceType.competitor_liker
            if has_likes
            else SourceType.competitor_follower
        )
        base = BASE_SCORE_MAP.get(best_source, 1)

        num_competitors = len(by_competitor)
        breadth = (
            BREADTH_BONUS.get(num_competitors, BREADTH_BONUS_MAX)
            if num_competitors > 0
            else 0
        )

        max_per = 0
        for comp_data in by_competitor.values():
            cc = comp_data.get("comment_count", 0) if isinstance(comp_data, dict) else 0
            lc = comp_data.get("like_count", 0) if isinstance(comp_data, dict) else 0
            max_per = max(max_per, cc + lc)
        depth = DEPTH_BONUS.get(max_per, DEPTH_BONUS_MAX) if max_per > 0 else 0

        mix = ACTION_MIX_BONUS if (has_comments and has_likes) else 0

        total = base + breadth + depth + mix
        best_source_str = best_source.value

        return ScoredLead(
            username=username,
            platform=platform,
            source=best_source_str,
            score=total,
            is_hot=total >= HOT_LEAD_THRESHOLD,
        )

    def update_score(self, current_score: int, action_result: str) -> int:
        adjustments = {
            "followed_back": 3,
            "replied": 5,
            "liked": 2,
            "no_response": 0,
            "blocked": -5,
        }
        delta = adjustments.get(action_result, 0)
        return max(0, current_score + delta)

    def is_hot_lead(self, score: int) -> bool:
        return score >= HOT_LEAD_THRESHOLD
