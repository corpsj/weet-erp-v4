from typing import TypedDict


BRAND_NAME = "(주)위트"
BRAND_SLOGAN = "집, 다시 생각하다"
CONTACT = "010-9645-2348"
LOCATION = "전남 함평"
INSTAGRAM = "@weet_kr"

FORBIDDEN_WORDS = [
    "최저가",
    "가장 싸",
    "제일 저렴",
    "경쟁사보다",
    "100% 보장",
    "절대",
    "무조건",
    "최고의",
]

CTA_PHONE = f"문의: {CONTACT}"
CTA_INSTAGRAM = f"인스타그램: {INSTAGRAM}"


class ChannelSpec(TypedDict):
    min_chars: int
    max_chars: int
    hashtags: bool
    cta: str


CHANNEL_SPECS: dict[str, ChannelSpec] = {
    "blog": {"min_chars": 2000, "max_chars": 3000, "hashtags": False, "cta": CTA_PHONE},
    "instagram": {
        "min_chars": 100,
        "max_chars": 2200,
        "hashtags": True,
        "cta": CTA_INSTAGRAM,
    },
    "cafe": {"min_chars": 500, "max_chars": 2000, "hashtags": False, "cta": CTA_PHONE},
    "youtube": {
        "min_chars": 300,
        "max_chars": 1000,
        "hashtags": False,
        "cta": CTA_PHONE,
    },
    "daangn": {"min_chars": 200, "max_chars": 500, "hashtags": False, "cta": CTA_PHONE},
    "kakao": {"min_chars": 50, "max_chars": 1000, "hashtags": False, "cta": ""},
}


class BrandVoice:
    def validate(self, content: str) -> tuple[bool, list[str]]:
        issues: list[str] = []
        for forbidden in FORBIDDEN_WORDS:
            if forbidden in content:
                issues.append(f"금지어 포함: '{forbidden}'")
        return len(issues) == 0, issues

    def add_cta(self, content: str, channel: str) -> str:
        spec = CHANNEL_SPECS.get(channel)
        cta = spec["cta"] if spec else CTA_PHONE
        if cta and cta not in content:
            return f"{content}\n\n{cta}"
        return content

    def get_system_prompt(self, channel: str) -> str:
        spec = CHANNEL_SPECS.get(channel, CHANNEL_SPECS["blog"])
        return (
            f"당신은 {BRAND_NAME}의 콘텐츠 전문가입니다.\n"
            f"슬로건: '{BRAND_SLOGAN}'\n"
            f"위치: {LOCATION} | 연락처: {CONTACT}\n"
            f"브랜드 톤: 친근하고 전문적, 과장 없음, 실용 정보 중심\n"
            f"금지: {', '.join(FORBIDDEN_WORDS[:4])}\n"
            f"목표 글자수: {spec['min_chars']}-{spec['max_chars']}자\n"
            f"채널: {channel}"
        )
