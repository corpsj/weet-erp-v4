import logging
import os
import base64
import importlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.core.config import Settings

logger = logging.getLogger(__name__)

PERSONA_IMAGE_PROMPTS: dict[str, str] = {
    "price_sensitive": "이동식주택 외관, 합리적 가격 느낌, 깔끔한 모듈러 디자인, 밝은 자연광",
    "lifestyle": "전원 속 이동식주택, 따뜻한 아침 햇살, 테라스 커피, 힐링 분위기",
    "practical": "이동식주택 내부 작업실, 실용적 수납, 넓은 공간 활용",
    "design": "감성적 이동식주택 인테리어, 미니멀 디자인, 우드톤, 조명",
}
DEFAULT_IMAGE_PROMPT = "이동식주택 외관, 자연 속 배경, 깨끗한 모던 디자인"
DEFAULT_IMAGE_MODEL = "imagen-3.0-generate-002"
FALLBACK_IMAGE_MODEL = "gemini-2.0-flash-exp"
AI_IMAGES_BUCKET = "ai-images"


class ImageService:
    def __init__(self) -> None:
        self._output_dir = os.path.join(os.getcwd(), "generated_images")
        os.makedirs(self._output_dir, exist_ok=True)
        settings = Settings()
        self._google_api_key = settings.google_api_key or os.environ.get(
            "GOOGLE_API_KEY", ""
        )
        self._image_model = settings.gemini_image_model or DEFAULT_IMAGE_MODEL

    async def generate_marketing_image(
        self, topic: str, persona: Optional[str] = None
    ) -> Optional[str]:
        base_prompt = PERSONA_IMAGE_PROMPTS.get(persona or "", DEFAULT_IMAGE_PROMPT)
        full_prompt = f"{base_prompt}, {topic}"
        sb = None

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
        except Exception as exc:
            logger.warning("Image cache lookup failed: %s", exc)

        image_bytes = self._generate_image_bytes(full_prompt)
        if not image_bytes:
            return None

        local_path = self._save_local_image(image_bytes)

        try:
            if sb is None:
                from app.db.session import get_supabase

                sb = get_supabase()
            storage_path = self._upload_and_record(sb, local_path, full_prompt)
            return storage_path
        except Exception as exc:
            logger.warning("Supabase upload failed for generated image: %s", exc)
            return local_path

    def _generate_image_bytes(self, full_prompt: str) -> Optional[bytes]:
        if not self._google_api_key:
            logger.warning("GOOGLE_API_KEY is not set. Skipping image generation.")
            return None

        image_bytes = self._generate_with_google_genai(full_prompt)
        if image_bytes:
            return image_bytes

        return self._generate_with_google_generativeai(full_prompt)

    def _generate_with_google_genai(self, full_prompt: str) -> Optional[bytes]:
        try:
            google_genai = importlib.import_module("google.genai")
            client = google_genai.Client(api_key=self._google_api_key)
            response = client.models.generate_images(
                model=self._image_model,
                prompt=full_prompt,
            )
            generated_images = getattr(response, "generated_images", []) or []
            if not generated_images:
                return None

            image = getattr(generated_images[0], "image", None)
            image_bytes = getattr(image, "image_bytes", None)
            if image_bytes:
                return bytes(image_bytes)
        except ModuleNotFoundError:
            return None
        except Exception as exc:
            logger.warning("Gemini image generation failed (google.genai): %s", exc)

        return None

    def _generate_with_google_generativeai(self, full_prompt: str) -> Optional[bytes]:
        try:
            google_generativeai = importlib.import_module("google.generativeai")
            google_generativeai.configure(api_key=self._google_api_key)

            model_name = (
                self._image_model
                if "gemini" in self._image_model
                else FALLBACK_IMAGE_MODEL
            )
            model = google_generativeai.GenerativeModel(model_name=model_name)
            response = model.generate_content(full_prompt)

            for candidate in getattr(response, "candidates", []) or []:
                content = getattr(candidate, "content", None)
                for part in getattr(content, "parts", []) or []:
                    inline_data = getattr(part, "inline_data", None)
                    if not inline_data:
                        continue
                    encoded = getattr(inline_data, "data", None)
                    if not encoded:
                        continue
                    if isinstance(encoded, bytes):
                        return encoded
                    return base64.b64decode(encoded)
        except ModuleNotFoundError:
            logger.warning(
                "Gemini SDK is not installed. Add google-generativeai dependency."
            )
        except Exception as exc:
            logger.warning(
                "Gemini image generation failed (google.generativeai): %s", exc
            )

        return None

    def _save_local_image(self, image_bytes: bytes) -> str:
        filename = f"marketing-{uuid4().hex}.png"
        local_path = Path(self._output_dir) / filename
        local_path.write_bytes(image_bytes)
        return str(local_path)

    def _upload_and_record(self, sb, local_path: str, prompt: str) -> str:
        filename = Path(local_path).name
        date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        storage_path = f"marketing/{date_prefix}/{filename}"

        with open(local_path, "rb") as image_file:
            sb.storage.from_(AI_IMAGES_BUCKET).upload(
                storage_path,
                image_file,
                {
                    "content-type": "image/png",
                    "cache-control": "31536000",
                    "upsert": False,
                },
            )

        sb.table("ai_generated_images").insert(
            {
                "prompt": prompt,
                "storage_path": storage_path,
                "model": self._image_model,
            }
        ).execute()

        return storage_path
