import asyncio
import logging
import os
from datetime import datetime
from typing import Any

from app.clients.instagram_client import InstagramRateLimitError, InstagrapiClient
from app.core.config import Settings

logger = logging.getLogger(__name__)


class DMMonitorRateLimitError(RuntimeError):
    def __init__(self, cooldown_until: datetime | None = None):
        super().__init__("Instagram DM monitor is rate-limited")
        self.cooldown_until = cooldown_until


class DMMonitor:
    CONSULTATION_KEYWORDS = [
        "가격",
        "상담",
        "문의",
        "견적",
        "비용",
        "얼마",
        "평수",
        "크기",
        "방문",
    ]

    def __init__(self, client_wrapper: InstagrapiClient | None = None) -> None:
        self._client_wrapper = client_wrapper

    async def _run_sync(self, fn):
        return await asyncio.get_event_loop().run_in_executor(None, fn)

    async def _get_client_wrapper(self) -> InstagrapiClient | None:
        if self._client_wrapper is not None:
            return self._client_wrapper
        if os.environ.get("TESTING") == "1":
            return None
        settings = Settings()
        ig_config = settings.instagram
        if not ig_config.username or not ig_config.password:
            logger.warning("Instagram credentials not configured for DM monitor")
            return None
        wrapper = InstagrapiClient(
            username=ig_config.username,
            password=ig_config.password,
            session_dir=ig_config.session_dir,
        )
        logged_in = await self._run_sync(wrapper.login)
        if not logged_in:
            logger.warning("Instagram login failed for DM monitor")
            return None
        self._client_wrapper = wrapper
        return wrapper

    @staticmethod
    def _extract_thread_id(thread: Any) -> str:
        thread_id = getattr(thread, "id", None) or getattr(thread, "thread_id", None)
        if thread_id is None:
            return ""
        return str(thread_id)

    @staticmethod
    def _extract_text(message: Any) -> str:
        raw_text = getattr(message, "text", None) or getattr(message, "message", None)
        if raw_text is None:
            return ""
        return str(raw_text)

    @staticmethod
    def _extract_message_id(message: Any) -> str:
        message_id = getattr(message, "id", None) or getattr(message, "item_id", None)
        if message_id is None:
            return ""
        return str(message_id)

    @staticmethod
    def _extract_username(thread: Any, message: Any) -> str:
        msg_user = getattr(message, "user", None)
        if msg_user is not None:
            msg_username = getattr(msg_user, "username", None)
            if msg_username:
                return str(msg_username)
        users = getattr(thread, "users", None)
        if isinstance(users, list):
            for user in users:
                username = getattr(user, "username", None)
                if username:
                    return str(username)
        return ""

    @staticmethod
    def _is_incoming(message: Any, my_user_id: int | None) -> bool:
        if my_user_id is None:
            return True
        message_user_id = getattr(message, "user_id", None)
        if message_user_id is None:
            msg_user = getattr(message, "user", None)
            message_user_id = getattr(msg_user, "pk", None)
        if message_user_id is None:
            return True
        return int(message_user_id) != int(my_user_id)

    @classmethod
    def _matched_keyword(cls, text: str) -> str | None:
        lowered = text.lower()
        for keyword in cls.CONSULTATION_KEYWORDS:
            if keyword.lower() in lowered:
                return keyword
        return None

    async def check_new_dms(self) -> list[dict[str, Any]]:
        wrapper = await self._get_client_wrapper()
        if wrapper is None:
            return []

        if wrapper.is_in_cooldown():
            raise DMMonitorRateLimitError(wrapper.get_cooldown_until())

        try:
            threads = await self._run_sync(
                lambda: wrapper.get_direct_threads(amount=20)
            )
        except InstagramRateLimitError as exc:
            raise DMMonitorRateLimitError(wrapper.get_cooldown_until()) from exc

        client = wrapper.get_client()
        my_user_id = None if client is None else getattr(client, "user_id", None)

        matched: list[dict[str, Any]] = []
        for thread in threads:
            thread_id = self._extract_thread_id(thread)
            if not thread_id:
                continue
            try:
                messages = await self._run_sync(
                    lambda thread_id=thread_id: wrapper.get_thread_messages(
                        thread_id=thread_id,
                        amount=5,
                    )
                )
            except InstagramRateLimitError as exc:
                raise DMMonitorRateLimitError(wrapper.get_cooldown_until()) from exc

            for message in messages:
                if not self._is_incoming(message, my_user_id):
                    continue
                text = self._extract_text(message).strip()
                if not text:
                    continue
                keyword = self._matched_keyword(text)
                if keyword is None:
                    continue
                username = self._extract_username(thread, message)
                if not username:
                    continue
                matched.append(
                    {
                        "username": username,
                        "message": text,
                        "keyword_matched": keyword,
                        "thread_id": thread_id,
                        "message_id": self._extract_message_id(message),
                    }
                )

        return matched
