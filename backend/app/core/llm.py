import ollama
import json
import time
from typing import Optional
from app.core.config import Settings

settings = Settings()


class LLMService:
    def __init__(self):
        self.client = ollama.Client(host=settings.ollama.host)
        self.model_primary = settings.ollama.model_primary  # qwen3.5:35b
        self.model_fast = settings.ollama.model_fast  # qwen3.5:9b
        self.model_embed = settings.ollama.model_embed  # qwen3-embedding:8b
        self.model_quality = settings.ollama.model_quality  # qwen3.5:122b

    def generate(
        self, prompt: str, model: Optional[str] = None, system: Optional[str] = None
    ) -> str:
        """Generate text. Uses fast model by default."""
        use_model = model or self.model_fast
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        for attempt in range(3):
            try:
                response = self.client.chat(model=use_model, messages=messages)
                return response.message.content
            except Exception as e:
                if attempt == 2:
                    raise ConnectionError(
                        f"Ollama unavailable after 3 attempts: {e}"
                    ) from e
                time.sleep(2**attempt)

    def analyze(self, text: str, task: str) -> dict:
        """Analyze text and return structured JSON. Uses fast model."""
        prompt = f"Analyze the following text for {task}. Respond with valid JSON only.\n\nText: {text}"
        for attempt in range(3):
            try:
                response = self.client.chat(
                    model=self.model_fast,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a JSON-only responder. Return valid JSON, no markdown.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                content = response.message.content.strip()
                # Strip markdown code blocks if present
                if content.startswith("```"):
                    content = "\n".join(content.split("\n")[1:-1])
                return json.loads(content)
            except json.JSONDecodeError:
                if attempt == 2:
                    return {"error": "failed to parse JSON", "raw": content}
                time.sleep(1)
            except Exception as e:
                if attempt == 2:
                    raise ConnectionError(f"Ollama unavailable: {e}") from e
                time.sleep(2**attempt)

    def embed(self, text: str) -> list[float]:
        """Generate text embedding using embed model."""
        try:
            response = self.client.embeddings(model=self.model_embed, prompt=text)
            return response.embedding
        except Exception as e:
            raise ConnectionError(f"Ollama embed unavailable: {e}") from e

    def classify(self, text: str, categories: list[str]) -> str:
        """Classify text into one of the given categories."""
        cats = ", ".join(categories)
        prompt = f"Classify the following text into exactly one category: {cats}\n\nText: {text}\n\nRespond with ONLY the category name, nothing else."
        result = self.generate(prompt, model=self.model_fast)
        # Find the closest matching category
        result_lower = result.strip().lower()
        for cat in categories:
            if cat.lower() in result_lower:
                return cat
        return categories[0]  # fallback
