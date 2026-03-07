from unittest.mock import patch

from app.leads.persona import PersonaClassifier, PersonaType


def build_classifier():
    return PersonaClassifier()


def test_price_sensitive_keyword_match():
    classifier = build_classifier()
    persona = classifier.classify("이동식주택 가격이 얼마나 할까요?")
    assert persona == PersonaType.price_sensitive


def test_lifestyle_keyword_match():
    classifier = build_classifier()
    persona = classifier.classify("귀촌해서 전원생활 꿈꾸는 중이에요")
    assert persona == PersonaType.lifestyle


def test_practical_keyword_match():
    classifier = build_classifier()
    persona = classifier.classify("농막으로 쓸 이동식주택 찾고 있어요")
    assert persona == PersonaType.practical


def test_design_keyword_match():
    classifier = build_classifier()
    persona = classifier.classify("인테리어가 예쁜 감성 주택 원해요")
    assert persona == PersonaType.design


def test_llm_fallback_for_unknown():
    classifier = build_classifier()
    with patch.object(classifier.llm, "classify", return_value="lifestyle"):
        persona = classifier.classify("그냥 궁금해서요")
    assert persona in PersonaType.__members__.values()


def test_content_preference_structure():
    classifier = build_classifier()
    pref = classifier.get_content_preference(PersonaType.lifestyle)
    assert "tone" in pref
    assert "topics" in pref
    assert "channel" in pref
    assert pref["channel"] == "instagram"
