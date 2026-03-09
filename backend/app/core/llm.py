import json
import re
import time
from typing import Optional

from openai import OpenAI

from app.core.config import Settings

settings = Settings()


class LLMService:
    def __init__(self):
        self.client = OpenAI(
            base_url=settings.lmstudio.base_url,
            api_key="lm-studio",
        )
        self.model = settings.lmstudio.model
        # model_fast: same model for now; swap to a lighter model
        # (e.g. qwen3.5-7b) when one is available on LMStudio.
        self.model_fast = self.model

    def generate(
        self, prompt: str, model: Optional[str] = None, system: Optional[str] = None
    ) -> str:
        use_model = model or self.model
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=use_model, messages=messages
                )
                content = response.choices[0].message.content or ""
                content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL)
                content = re.sub(r"<think>.*", "", content, flags=re.DOTALL)
                return content.strip()
            except Exception as e:
                if attempt == 2:
                    raise ConnectionError(
                        f"LMStudio unavailable after 3 attempts: {e}"
                    ) from e
                time.sleep(2**attempt)
        raise ConnectionError("LMStudio unavailable after 3 attempts")

    def analyze(self, text: str, task: str) -> dict:
        prompt = f"Analyze the following text for {task}. Respond with valid JSON only.\n\nText: {text}"
        last_content = ""
        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a JSON-only responder. Return valid JSON, no markdown.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                raw = response.choices[0].message.content or ""
                last_content = re.sub(
                    r"<think>.*?</think>\s*", "", raw, flags=re.DOTALL
                )
                last_content = re.sub(r"<think>.*", "", last_content, flags=re.DOTALL)
                last_content = last_content.strip()
                if last_content.startswith("```"):
                    last_content = "\n".join(last_content.split("\n")[1:-1])
                return json.loads(last_content)
            except json.JSONDecodeError:
                if attempt == 2:
                    return {"error": "failed to parse JSON", "raw": last_content}
                time.sleep(1)
            except Exception as e:
                if attempt == 2:
                    raise ConnectionError(f"LMStudio unavailable: {e}") from e
                time.sleep(2**attempt)
        raise ConnectionError("LMStudio unavailable after 3 attempts")

    def classify(self, text: str, categories: list[str]) -> str:
        cats = ", ".join(categories)
        prompt = f"Classify the following text into exactly one category: {cats}\n\nText: {text}\n\nRespond with ONLY the category name, nothing else."
        result = self.generate(prompt, model=self.model)
        result_lower = result.strip().lower()
        for cat in categories:
            if cat.lower() in result_lower:
                return cat
        return categories[0]
