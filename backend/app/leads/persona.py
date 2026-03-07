from collections.abc import Mapping
from enum import Enum
from typing import Union

from app.core.llm import LLMService
from app.core.prompts import PERSONA_CLASSIFICATION_PROMPT


class PersonaType(str, Enum):
    price_sensitive = "price_sensitive"
    lifestyle = "lifestyle"
    practical = "practical"
    design = "design"
    unknown = "unknown"


PERSONA_KEYWORDS = {
    PersonaType.price_sensitive: ["가격", "견적", "비용", "얼마", "저렴", "합리적"],
    PersonaType.lifestyle: ["전원생활", "힐링", "꿈", "자연", "귀촌", "여유"],
    PersonaType.practical: ["농막", "창고", "작업실", "사무실", "실용", "기능"],
    PersonaType.design: ["인테리어", "감성", "예쁜", "디자인", "깔끔", "미니멀"],
}


class PersonaClassifier:
    def __init__(self):
        self.llm: LLMService = LLMService()

    def classify(
        self, activity: str, keywords: Union[list[str], None] = None
    ) -> PersonaType:
        activity_lower = activity.lower()
        keyword_scores: dict[PersonaType, int] = {
            persona: 0 for persona in PersonaType if persona != PersonaType.unknown
        }
        for persona, persona_kws in PERSONA_KEYWORDS.items():
            for kw in persona_kws:
                if kw in activity_lower:
                    keyword_scores[persona] = keyword_scores.get(persona, 0) + 1

        best_persona = max(keyword_scores, key=lambda persona: keyword_scores[persona])
        if keyword_scores[best_persona] > 0:
            return best_persona

        try:
            categories = [p.value for p in PersonaType if p != PersonaType.unknown]
            prompt = PERSONA_CLASSIFICATION_PROMPT.format(
                activity=activity,
                keywords=", ".join(keywords or []),
            )
            result = self.llm.classify(text=prompt, categories=categories)
            return PersonaType(result)
        except Exception:
            return PersonaType.unknown

    def get_content_preference(self, persona: PersonaType) -> Mapping[str, object]:
        preferences: dict[PersonaType, dict[str, object]] = {
            PersonaType.price_sensitive: {
                "tone": "실용적, 구체적 수치 제시",
                "topics": ["비용 비교", "가성비", "견적 안내"],
                "channel": "blog",
            },
            PersonaType.lifestyle: {
                "tone": "감성적, 꿈 자극",
                "topics": ["전원생활 로망", "이동식주택 일상", "귀촌 스토리"],
                "channel": "instagram",
            },
            PersonaType.practical: {
                "tone": "기능적, 사양 중심",
                "topics": ["농막 허가", "창고 활용", "설치 편의성"],
                "channel": "cafe",
            },
            PersonaType.design: {
                "tone": "시각적, 감성 중심",
                "topics": ["인테리어", "외관 디자인", "커스터마이징"],
                "channel": "instagram",
            },
            PersonaType.unknown: {
                "tone": "균형적",
                "topics": ["이동식주택 소개"],
                "channel": "blog",
            },
        }
        return preferences.get(persona, preferences[PersonaType.unknown])
