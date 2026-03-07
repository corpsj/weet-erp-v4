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
    result = scorer.score("user4", "instagram", "competitor_comment")
    updated = scorer.update_score(result.score, "followed_back")
    assert scorer.is_hot_lead(updated) is True


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
