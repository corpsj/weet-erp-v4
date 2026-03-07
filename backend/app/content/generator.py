from dataclasses import dataclass, field
from typing import Protocol

from app.content.brand_voice import BrandVoice, CONTACT
from app.core.llm import LLMService
from app.core.prompts import CONTENT_GENERATION_PROMPT


class LLMClient(Protocol):
    model: str
    model_fast: str

    def generate(
        self,
        prompt: str,
        model: "str | None" = None,
        system: "str | None" = None,
    ) -> str: ...


@dataclass
class BlogArticle:
    topic: str
    title: str
    body: str
    keywords: list[str] = field(default_factory=list)
    word_count: int = 0


@dataclass
class Caption:
    topic: str
    body: str
    hashtags: list[str] = field(default_factory=list)


@dataclass
class CafePost:
    topic: str
    title: str
    body: str


@dataclass
class Script:
    topic: str
    title: str
    body: str
    format: str = "short"


@dataclass
class DaangnPost:
    product: str
    title: str
    body: str


@dataclass
class KakaoMessage:
    template: str
    body: str


INSTAGRAM_HASHTAGS = [
    "#이동식주택",
    "#모듈러주택",
    "#전원주택",
    "#귀촌",
    "#세컨하우스",
    "#위트",
    "#weet_kr",
    "#함평",
    "#소형주택",
    "#미니멀하우스",
]


class ContentGenerator:
    def __init__(self):
        self.llm: LLMClient = LLMService()
        self.brand_voice: BrandVoice = BrandVoice()

    async def generate_blog_article(
        self, topic: str, keywords: list[str], persona: "str | None" = None
    ) -> BlogArticle:
        system = self.brand_voice.get_system_prompt("blog")
        prompt = CONTENT_GENERATION_PROMPT.format(
            channel="네이버 블로그",
            topic=topic,
            keywords=", ".join(keywords),
            persona=persona or "일반 독자",
        )
        body = self.llm.generate(prompt, model=self.llm.model, system=system)
        body = self.brand_voice.add_cta(body, "blog")

        title = topic if "블로그" in topic else f"{topic} - 이동식주택 전문 위트 안내"
        return BlogArticle(
            topic=topic,
            title=title,
            body=body,
            keywords=keywords,
            word_count=len(body),
        )

    async def generate_instagram_caption(
        self, topic: str, image_desc: "str | None" = None
    ) -> Caption:
        system = self.brand_voice.get_system_prompt("instagram")
        prompt = (
            f"인스타그램 캡션을 작성하세요.\n"
            f"주제: {topic}\n"
            f"이미지 설명: {image_desc or '이동식주택 외관'}\n"
            f"감성적 훅으로 시작하고, 핵심 정보를 담은 후 연락처로 마무리하세요."
        )
        body = self.llm.generate(prompt, model=self.llm.model, system=system)
        return Caption(
            topic=topic,
            body=self.brand_voice.add_cta(body, "instagram"),
            hashtags=INSTAGRAM_HASHTAGS[:10],
        )

    async def generate_instagram_story_text(self, topic: str) -> Caption:
        """Generate short story CTA text (body ≤50 chars)."""
        system = self.brand_voice.get_system_prompt("instagram")
        prompt = (
            f"인스타그램 스토리용 짧은 텍스트를 작성하세요 (50자 이내).\n"
            f"주제: {topic}\n"
            "CTA 형식으로 간결하게, 스와이프 유도."
        )
        body = self.llm.generate(prompt, model=self.llm.model_fast, system=system)
        return Caption(topic=topic, body=body[:50], hashtags=[])

    async def generate_instagram_reel_caption(self, topic: str) -> Caption:
        """Generate reel caption with hashtags (body ≤2200 chars)."""
        system = self.brand_voice.get_system_prompt("instagram")
        prompt = (
            f"인스타그램 릴스용 캡션을 작성하세요.\n"
            f"주제: {topic}\n"
            "감성적 훅 + 본론 + CTA + 해시태그 포함. 총 2200자 이내."
        )
        body = self.llm.generate(prompt, model=self.llm.model_fast, system=system)
        body = self.brand_voice.add_cta(body, "instagram")
        return Caption(
            topic=topic,
            body=body[:2200],
            hashtags=INSTAGRAM_HASHTAGS[:10],
        )

    async def generate_cafe_post(
        self, topic: str, cafe_context: "str | None" = None
    ) -> CafePost:
        system = self.brand_voice.get_system_prompt("cafe")
        prompt = (
            "네이버 카페 정보 공유 글을 작성하세요 (광고 아닌 정보 제공형).\n"
            f"주제: {topic}\n"
            f"카페 성격: {cafe_context or '이동식주택 관심자 커뮤니티'}"
        )
        body = self.llm.generate(prompt, model=self.llm.model, system=system)
        return CafePost(
            topic=topic,
            title=f"[정보] {topic}",
            body=self.brand_voice.add_cta(body, "cafe"),
        )

    async def generate_youtube_script(
        self, topic: str, format: str = "short"
    ) -> Script:
        system = self.brand_voice.get_system_prompt("youtube")
        duration = "60초 쇼츠" if format == "short" else "5-10분 영상"
        prompt = (
            f"유튜브 {duration} 스크립트를 작성하세요.\n"
            f"주제: {topic}\n"
            "구성: 훅(5초) -> 본론 -> 마무리 CTA"
        )
        body = self.llm.generate(prompt, model=self.llm.model, system=system)
        return Script(topic=topic, title=topic, body=body, format=format)

    async def generate_daangn_post(
        self, product: str, features: list[str]
    ) -> DaangnPost:
        system = self.brand_voice.get_system_prompt("daangn")
        prompt = (
            "당근마켓 게시글을 작성하세요.\n"
            f"제품: {product}\n"
            f"특징: {', '.join(features)}\n"
            "친근하고 신뢰감 있게 작성하세요."
        )
        body = self.llm.generate(prompt, model=self.llm.model, system=system)
        return DaangnPost(
            product=product,
            title=f"{product} - {CONTACT}",
            body=body,
        )

    async def generate_kakao_message(
        self, template: str, lead: "dict[str, str] | None" = None
    ) -> KakaoMessage:
        name = lead.get("username", "고객") if lead else "고객"
        body = template.replace("{name}", name).replace("{contact}", CONTACT)
        return KakaoMessage(template=template, body=body)
