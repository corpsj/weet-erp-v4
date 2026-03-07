import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

PERSONA_IMAGE_PROMPTS: dict[str, str] = {
    "price_sensitive": "이동식주택 외관, 합리적 가격 느낌, 깔끔한 모듈러 디자인, 밝은 자연광",
    "lifestyle": "전원 속 이동식주택, 따뜻한 아침 햇살, 테라스 커피, 힐링 분위기",
    "practical": "이동식주택 내부 작업실, 실용적 수납, 넓은 공간 활용",
    "design": "감성적 이동식주택 인테리어, 미니멀 디자인, 우드톤, 조명",
}
DEFAULT_IMAGE_PROMPT = "이동식주택 외관, 자연 속 배경, 깨끗한 모던 디자인"


class ImageService:
    def __init__(self) -> None:
        self._output_dir = os.path.join(os.getcwd(), "generated_images")
        os.makedirs(self._output_dir, exist_ok=True)

    async def generate_marketing_image(
        self, topic: str, persona: Optional[str] = None
    ) -> Optional[str]:
        base_prompt = PERSONA_IMAGE_PROMPTS.get(persona or "", DEFAULT_IMAGE_PROMPT)
        full_prompt = f"{base_prompt}, {topic}"

        try:
            from app.db.session import get_supabase

            sb = get_supabase()
            result = (
                sb.table("ai_generated_images")
                .select("id,storage_path")
                .eq("prompt", full_prompt)
                .limit(1)
                .execute()
            )
            if result.data:
                return str(result.data[0].get("storage_path", ""))

            logger.info(
                "No cached image for prompt: %s. Use AI Images workspace to generate.",
                full_prompt[:80],
            )
            return None
        except Exception as exc:
            logger.warning("Image lookup failed: %s", exc)
            return None
