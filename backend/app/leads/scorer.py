from dataclasses import dataclass
from enum import Enum


class SourceType(str, Enum):
    competitor_comment = "competitor_comment"
    naver_cafe_question = "naver_cafe_question"
    high_intent_hashtag = "high_intent_hashtag"
    competitor_liker = "competitor_liker"
    youtube_commenter = "youtube_commenter"
    competitor_follower = "competitor_follower"


SCORE_MAP = {
    SourceType.competitor_comment: 8,
    SourceType.naver_cafe_question: 7,
    SourceType.high_intent_hashtag: 6,
    SourceType.competitor_liker: 5,
    SourceType.youtube_commenter: 4,
    SourceType.competitor_follower: 3,
}

HOT_LEAD_THRESHOLD = 10
DAILY_LIMIT_REACHED_SCORE = 0


@dataclass
class ScoredLead:
    username: str
    platform: str
    source: str
    score: int
    is_hot: bool = False


class LeadScorer:
    def score(self, username: str, platform: str, source: str) -> ScoredLead:
        try:
            source_type = SourceType(source)
            base_score = SCORE_MAP.get(source_type, 1)
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
