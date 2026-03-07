import asyncio
from collections.abc import Awaitable, Callable
from typing import ClassVar, Protocol, TypeVar, cast, runtime_checkable

from openclaw_sdk import OpenClawClient

from app.core.config import Settings

T = TypeVar("T")


@runtime_checkable
class SupportsModelDump(Protocol):
    def model_dump(self) -> object: ...


@runtime_checkable
class AgentResponseLike(Protocol):
    success: bool
    content: str


class OpenClawBridge:
    MAX_RETRIES: ClassVar[int] = 3
    TIMEOUT_SECONDS: ClassVar[int] = 120
    RETRY_BACKOFF_SECONDS: ClassVar[tuple[int, int, int]] = (1, 2, 4)

    def __init__(self) -> None:
        settings = Settings()
        self._gateway_ws_url: str = settings.openclaw.gateway_ws_url
        self._api_key: str = settings.openclaw.api_key
        self._client: OpenClawClient | None = None

    async def _with_retry(
        self, operation_name: str, call: Callable[[], Awaitable[T]]
    ) -> T:
        last_error: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                return await asyncio.wait_for(call(), timeout=self.TIMEOUT_SECONDS)
            except Exception as exc:
                last_error = exc
                if attempt == self.MAX_RETRIES - 1:
                    break
                await asyncio.sleep(self.RETRY_BACKOFF_SECONDS[attempt])

        raise ConnectionError(
            f"OpenClaw {operation_name} failed after {self.MAX_RETRIES} attempts"
        ) from last_error

    def _serialize(self, payload: object) -> object:
        if isinstance(payload, SupportsModelDump):
            return payload.model_dump()
        if isinstance(payload, list):
            payload_list = cast(list[object], payload)
            return [self._serialize(item) for item in payload_list]
        return payload

    async def connect(self) -> None:
        if self._client is not None:
            return

        async def _connect() -> OpenClawClient:
            connect_kwargs: dict[str, object] = {
                "gateway_ws_url": self._gateway_ws_url,
                "timeout": self.TIMEOUT_SECONDS,
            }
            if self._api_key:
                connect_kwargs["api_key"] = self._api_key
            return await OpenClawClient.connect(**connect_kwargs)

        self._client = await self._with_retry("connect", _connect)

    async def close(self) -> None:
        if self._client is None:
            return

        client = self._client
        self._client = None
        await self._with_retry("close", client.close)

    async def _get_client(self) -> OpenClawClient:
        if self._client is None:
            await self.connect()
        if self._client is None:
            raise ConnectionError("OpenClaw client is not connected")
        return self._client

    async def _execute_marketing_prompt(self, prompt: str) -> dict[str, object]:
        client = await self._get_client()

        async def _execute() -> object:
            agent = client.get_agent("marketing")
            return await agent.execute(prompt)

        response = await self._with_retry("marketing execute", _execute)
        success = False
        content = ""
        if isinstance(response, AgentResponseLike):
            success = response.success
            content = response.content
        return {
            "success": success,
            "content": content,
            "raw": self._serialize(response),
        }

    async def publish_content(self, channel: str, content_id: str) -> dict[str, object]:
        prompt = (
            "Publish the requested content via configured channel. "
            f"channel={channel}, content_id={content_id}. "
            "Return concise execution result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    async def outreach_lead(self, lead_id: str, action_type: str) -> dict[str, object]:
        prompt = (
            "Execute lead outreach action. "
            f"lead_id={lead_id}, action_type={action_type}. "
            "Return concise execution result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    async def scan_competitors(self, keywords: list[str]) -> dict[str, object]:
        prompt = (
            "Scan competitors for the provided keywords and summarize opportunities. "
            f"keywords={', '.join(keywords)}. "
            "Return concise execution result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    # --- Instagram Content Publishing ---

    async def publish_instagram_feed(
        self, content_id: str, caption: str, image_path: str
    ) -> dict[str, object]:
        """Publish an Instagram feed post via OpenClaw."""
        prompt = (
            "Publish Instagram feed post. "
            f"content_id={content_id}, "
            f"caption={caption[:100]}..., "
            f"image_path={image_path}. "
            "Format: square or portrait image with caption. "
            "Max caption length: 2200 chars. Include relevant hashtags. "
            "CTA: 인스타그램: @weet_kr. "
            "Return JSON with post_id on success."
        )
        return await self._execute_marketing_prompt(prompt)

    async def publish_instagram_story(
        self, content_id: str, media_path: str
    ) -> dict[str, object]:
        """Publish an Instagram story via OpenClaw."""
        prompt = (
            "Publish Instagram story. "
            f"content_id={content_id}, "
            f"media_path={media_path}. "
            "Format: vertical 9:16 image or video (max 15s). "
            "Add subtle CTA sticker if appropriate. "
            "Return JSON with story_id on success."
        )
        return await self._execute_marketing_prompt(prompt)

    async def publish_instagram_reel(
        self, content_id: str, caption: str, video_path: str
    ) -> dict[str, object]:
        """Publish an Instagram reel via OpenClaw."""
        prompt = (
            "Publish Instagram reel. "
            f"content_id={content_id}, "
            f"caption={caption[:100]}..., "
            f"video_path={video_path}. "
            "Format: vertical 9:16 video, 15-90 seconds. "
            "Max caption: 2200 chars with hashtags. "
            "CTA: 인스타그램: @weet_kr. "
            "Return JSON with reel_id on success."
        )
        return await self._execute_marketing_prompt(prompt)

    # --- Instagram Engagement Delegation ---

    async def engage_instagram_like(self, media_id: str) -> dict[str, object]:
        """Delegate Instagram like action to OpenClaw."""
        prompt = (
            "Execute Instagram engagement: like post. "
            f"media_id={media_id}. "
            "Like the specified post naturally. "
            "Return JSON with success status."
        )
        return await self._execute_marketing_prompt(prompt)

    async def engage_instagram_follow(self, username: str) -> dict[str, object]:
        """Delegate Instagram follow action to OpenClaw."""
        prompt = (
            "Execute Instagram engagement: follow user. "
            f"username={username}. "
            "Follow the user naturally. "
            "Return JSON with success status."
        )
        return await self._execute_marketing_prompt(prompt)

    async def engage_instagram_comment(
        self, media_id: str, comment_text: str
    ) -> dict[str, object]:
        """Delegate Instagram comment action to OpenClaw."""
        prompt = (
            "Execute Instagram engagement: comment on post. "
            f"media_id={media_id}. "
            f"Comment text: {comment_text}. "
            "Brand tone: 친근하고 전문적, 과장 없음, 실용 정보 중심. "
            "금지어: 최저가, 가장 싸, 제일 저렴, 100% 보장, 절대, 무조건, 최고의. "
            "Return JSON with comment_id on success."
        )
        return await self._execute_marketing_prompt(prompt)

    async def engage_instagram_dm(
        self, username: str, message: str
    ) -> dict[str, object]:
        """Delegate Instagram DM action to OpenClaw."""
        prompt = (
            "Execute Instagram engagement: send direct message. "
            f"username={username}. "
            f"Message: {message}. "
            "Brand tone: 친근하고 전문적, 과장 없음. "
            "Company: (주)위트, 슬로건: '집, 다시 생각하다'. "
            "금지어: 최저가, 가장 싸, 제일 저렴, 100% 보장. "
            "Return JSON with message_id on success."
        )
        return await self._execute_marketing_prompt(prompt)

    async def get_status(self) -> dict[str, object]:
        client = await self._get_client()

        async def _status() -> dict[str, object]:
            health = await client.health()
            agents = await client.list_agents()
            return {
                "health": self._serialize(health),
                "agents": self._serialize(agents),
            }

        return await self._with_retry("status", _status)
