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


_SKILLS_DIR = "/Users/zoopark-studio/.openclaw/workspace-marketing/skills"

_INSTAGRAM_POSTER_INSTRUCTIONS = (
    "Read and follow the SKILL.md at "
    f"{_SKILLS_DIR}/instagram-poster/SKILL.md. "
    "Use the browser tool (profile: marketing, port 18801) to post to Instagram. "
    "Fetch content from Supabase, navigate instagram.com, upload and share. "
    "Wait 30-90s before clicking Share. Check rate limits first (max 3/day). "
)

_LEAD_OUTREACH_INSTRUCTIONS = (
    "Read and follow the SKILL.md at "
    f"{_SKILLS_DIR}/lead-outreach/SKILL.md. "
    "Use the browser tool (profile: marketing, port 18801) for Instagram actions. "
    "Fetch the lead from Supabase by lead_id, navigate to their Instagram profile, "
    "then perform the action. Wait 30-90s between actions. "
    "Check rate limits and operating hours first. "
)


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

    async def publish_content(
        self, channel: str, content_id: str, image_path: str = ""
    ) -> dict[str, object]:
        if channel == "instagram":
            prompt = (
                _INSTAGRAM_POSTER_INSTRUCTIONS
                + f"Parameters: content_id={content_id}"
                + (f", image_path={image_path}" if image_path else "")
                + ". Return the result as JSON."
            )
        else:
            prompt = (
                f"Publish content via {channel} channel. "
                f"content_id={content_id}. "
                "Return concise execution result as JSON."
            )
        return await self._execute_marketing_prompt(prompt)

    async def outreach_lead(self, lead_id: str, action_type: str) -> dict[str, object]:
        prompt = (
            _LEAD_OUTREACH_INSTRUCTIONS
            + f"Parameters: lead_id={lead_id}, action_type={action_type}. "
            "Return the result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    async def scan_competitors(self, keywords: list[str]) -> dict[str, object]:
        prompt = (
            "Scan competitors for the provided keywords and summarize opportunities. "
            f"keywords={', '.join(keywords)}. "
            "Return concise execution result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    # --- Instagram Content Publishing (via instagram-poster skill) ---

    async def publish_instagram_feed(
        self, content_id: str, caption: str, image_path: str
    ) -> dict[str, object]:
        """Publish an Instagram feed post via instagram-poster skill."""
        return await self.publish_content(
            channel="instagram", content_id=content_id, image_path=image_path
        )

    async def publish_instagram_story(
        self, content_id: str, media_path: str
    ) -> dict[str, object]:
        """Publish an Instagram story via instagram-poster skill."""
        return await self.publish_content(
            channel="instagram", content_id=content_id, image_path=media_path
        )

    async def publish_instagram_reel(
        self, content_id: str, caption: str, video_path: str
    ) -> dict[str, object]:
        """Publish an Instagram reel via instagram-poster skill."""
        return await self.publish_content(
            channel="instagram", content_id=content_id, image_path=video_path
        )

    # --- Instagram Engagement (via lead-outreach skill) ---

    async def engage_instagram_like(self, lead_id: str) -> dict[str, object]:
        """Like the most recent post of a lead via lead-outreach skill."""
        return await self.outreach_lead(lead_id=lead_id, action_type="like")

    async def engage_instagram_follow(self, lead_id: str) -> dict[str, object]:
        """Follow a lead on Instagram via lead-outreach skill."""
        return await self.outreach_lead(lead_id=lead_id, action_type="follow")

    async def engage_instagram_comment(
        self, lead_id: str, comment_text: str
    ) -> dict[str, object]:
        prompt = (
            _LEAD_OUTREACH_INSTRUCTIONS
            + f"Parameters: lead_id={lead_id}, action_type=comment. "
            f"Navigate to the lead's profile, find their latest post, "
            f"and leave this comment: {comment_text}. "
            "Brand tone: 친근하고 전문적, 과장 없음, 실용 정보 중심. "
            "Return the result as JSON."
        )
        return await self._execute_marketing_prompt(prompt)

    async def engage_instagram_dm(
        self, lead_id: str, message: str
    ) -> dict[str, object]:
        prompt = (
            _LEAD_OUTREACH_INSTRUCTIONS
            + f"Parameters: lead_id={lead_id}, action_type=dm. "
            f"DM message to send: {message}. "
            "Return the result as JSON."
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
