import pytest

from app.content.brand_voice import BrandVoice
from app.content.generator import BlogArticle, ContentGenerator


class FakeLLM:
    model_primary: str
    model_fast: str
    response: str

    def __init__(self, response: str):
        self.model_primary = "qwen3.5:35b"
        self.model_fast = "qwen3.5:9b"
        self.response = response

    def generate(
        self,
        prompt: str,
        model: "str | None" = None,
        system: "str | None" = None,
    ) -> str:
        _ = prompt, model, system
        return self.response


@pytest.fixture
def generator() -> ContentGenerator:
    gen = ContentGenerator()
    text = (
        "이동식주택은 현대인의 새로운 주거 선택입니다. "
        "빠른 시공과 합리적인 비용으로 꿈의 공간을 만들어보세요. "
        "전남 함평에서 직접 설계부터 시공까지 원스톱으로 진행합니다. "
    ) * 50
    gen.llm = FakeLLM(text)
    return gen


@pytest.mark.asyncio
async def test_blog_article_has_minimum_length(generator: ContentGenerator):
    article = await generator.generate_blog_article(
        "이동식주택 허가 절차", ["농막", "이동식건축물"]
    )
    assert isinstance(article, BlogArticle)
    assert article.word_count > 100


@pytest.mark.asyncio
async def test_blog_article_contains_cta(generator: ContentGenerator):
    article = await generator.generate_blog_article("이동식주택 비용", ["비용", "견적"])
    assert "010-9645-2348" in article.body


@pytest.mark.asyncio
async def test_instagram_caption_has_hashtags(generator: ContentGenerator):
    caption = await generator.generate_instagram_caption("전원생활 이동식주택")
    assert len(caption.hashtags) > 0
    assert "#이동식주택" in caption.hashtags or "#위트" in caption.hashtags


@pytest.mark.asyncio
async def test_daangn_post_has_contact(generator: ContentGenerator):
    post = await generator.generate_daangn_post(
        "6평 이동식주택", ["빠른 시공", "합리적 비용"]
    )
    assert "010-9645-2348" in post.title or "010-9645-2348" in post.body


def test_brand_voice_forbidden_words():
    bv = BrandVoice()
    is_valid, issues = bv.validate("최저가 이동식주택 판매")
    assert is_valid is False
    assert len(issues) > 0
    assert "최저가" in issues[0]


def test_brand_voice_clean_content():
    bv = BrandVoice()
    is_valid, issues = bv.validate(
        "이동식주택 전문 위트입니다. 함평 소재 공장에서 직접 제작합니다."
    )
    assert is_valid is True
    assert len(issues) == 0


def test_brand_voice_add_cta_blog():
    bv = BrandVoice()
    content = "이동식주택 관련 글입니다."
    result = bv.add_cta(content, "blog")
    assert "010-9645-2348" in result


@pytest.mark.asyncio
async def test_youtube_script_format():
    gen = ContentGenerator()
    gen.llm = FakeLLM(
        "훅: 이동식주택 진짜 비용은? 본론: 부지비용 제외 약 2500만원부터. CTA: "
        + "010-9645-2348"
    )
    script = await gen.generate_youtube_script("이동식주택 실제 비용", format="short")
    assert script.format == "short"
    assert len(script.body) > 0
