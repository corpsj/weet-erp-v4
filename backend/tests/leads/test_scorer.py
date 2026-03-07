from app.leads.scorer import LeadScorer


def test_competitor_comment_score():
    scorer = LeadScorer()
    result = scorer.score("user1", "instagram", "competitor_comment")
    assert result.score == 8


def test_competitor_follower_score():
    scorer = LeadScorer()
    result = scorer.score("user2", "instagram", "competitor_follower")
    assert result.score == 3


def test_naver_cafe_question_score():
    scorer = LeadScorer()
    result = scorer.score("user3", "naver_cafe", "naver_cafe_question")
    assert result.score == 7


def test_hot_lead_threshold():
    scorer = LeadScorer()
    assert scorer.is_hot_lead(20) is True
    assert scorer.is_hot_lead(19) is False


def test_update_score_replied():
    scorer = LeadScorer()
    new_score = scorer.update_score(5, "replied")
    assert new_score == 10


def test_update_score_blocked():
    scorer = LeadScorer()
    new_score = scorer.update_score(3, "blocked")
    assert new_score == 0


def test_unknown_source_gets_minimum_score():
    scorer = LeadScorer()
    result = scorer.score("user5", "instagram", "unknown_source")
    assert result.score == 1


def test_engagement_single_like():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 0,
        "total_like_count": 1,
        "by_competitor": {"placers.official": {"comment_count": 0, "like_count": 1}},
    }
    result = scorer.score_with_engagement("user1", "instagram", metadata)
    assert result.score == 5
    assert result.source == "competitor_liker"
    assert result.is_hot is False


def test_engagement_single_comment():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 1,
        "total_like_count": 0,
        "by_competitor": {"placers.official": {"comment_count": 1, "like_count": 0}},
    }
    result = scorer.score_with_engagement("user2", "instagram", metadata)
    assert result.score == 8
    assert result.source == "competitor_comment"


def test_engagement_same_competitor_comment_and_like():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 1,
        "total_like_count": 2,
        "by_competitor": {
            "placers.official": {"comment_count": 1, "like_count": 2},
        },
    }
    result = scorer.score_with_engagement("user3", "instagram", metadata)
    assert result.score == 16
    assert result.is_hot is False


def test_engagement_two_competitors():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 1,
        "total_like_count": 1,
        "by_competitor": {
            "placers.official": {"comment_count": 1, "like_count": 0},
            "withheim": {"comment_count": 0, "like_count": 1},
        },
    }
    result = scorer.score_with_engagement("user4", "instagram", metadata)
    assert result.score == 18
    assert result.is_hot is False  # 18 < HOT_LEAD_THRESHOLD(20)


def test_engagement_three_competitors_deep():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 3,
        "total_like_count": 4,
        "by_competitor": {
            "placers.official": {"comment_count": 1, "like_count": 2},
            "withheim": {"comment_count": 1, "like_count": 1},
            "wavyroom_kr": {"comment_count": 1, "like_count": 1},
        },
    }
    result = scorer.score_with_engagement("user5", "instagram", metadata)
    assert result.score == 30
    assert result.is_hot is True


def test_engagement_four_plus_competitors():
    scorer = LeadScorer()
    metadata = {
        "total_comment_count": 4,
        "total_like_count": 6,
        "by_competitor": {
            "a": {"comment_count": 1, "like_count": 2},
            "b": {"comment_count": 1, "like_count": 2},
            "c": {"comment_count": 1, "like_count": 1},
            "d": {"comment_count": 1, "like_count": 1},
        },
    }
    result = scorer.score_with_engagement("user6", "instagram", metadata)
    assert result.score == 38


def test_engagement_empty_metadata():
    scorer = LeadScorer()
    result = scorer.score_with_engagement("user7", "instagram", {})
    assert result.score == 3
