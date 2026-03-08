"""Instagram client wrapper using instagrapi with session file management."""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, ClassVar, cast

from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
)

logger = logging.getLogger(__name__)


class InstagramRateLimitError(RuntimeError):
    pass


class InstagrapiClient:
    """Wrapper around instagrapi.Client with session file persistence.

    Uses composition (not inheritance) to wrap the instagrapi Client.
    Session files are stored as JSON in the configured session directory.
    """

    SESSION_FILE_SUFFIX: ClassVar[str] = "_settings.json"

    def __init__(
        self,
        username: str,
        password: str,
        session_dir: str = "backend/.sessions",
    ) -> None:
        self._username = username
        self._password = password
        self._session_dir = session_dir
        self._session_path = os.path.join(
            session_dir, f"{username}{self.SESSION_FILE_SUFFIX}"
        )
        self._client: Client | None = None
        self._cooldown_until: datetime | None = None

        os.makedirs(session_dir, exist_ok=True)

    def login(self) -> bool:
        """Login to Instagram, reusing saved session if available.

        Returns True on success, False on failure. Never raises.
        """
        try:
            client = Client()
            client.challenge_code_handler = cast(
                Any,
                lambda username, choice=None: self._challenge_callback(
                    username, choice
                ),
            )

            if os.path.exists(self._session_path):
                logger.info("Loading saved session for %s", self._username)
                client.load_settings(self._session_path)
                try:
                    client.login(self._username, self._password, relogin=True)
                except LoginRequired:
                    logger.warning(
                        "Saved session invalid for %s, doing fresh login",
                        self._username,
                    )
                    client = Client()
                    client.challenge_code_handler = cast(
                        Any,
                        lambda username, choice=None: self._challenge_callback(
                            username, choice
                        ),
                    )
                    client.login(self._username, self._password)
            else:
                logger.info("No saved session, fresh login for %s", self._username)
                client.login(self._username, self._password)

            client.dump_settings(self._session_path)
            self._client = client
            logger.info("Login successful for %s", self._username)
            return True

        except BadPassword:
            logger.error("Bad password for %s", self._username)
            return False
        except ChallengeRequired:
            logger.error(
                "Challenge required for %s — manual intervention needed", self._username
            )
            return False
        except PleaseWaitFewMinutes:
            logger.error(
                "Rate limited during login for %s — try again later", self._username
            )
            return False
        except Exception as exc:
            logger.error("Login failed for %s: %s", self._username, exc)
            return False

    def _challenge_callback(self, username: str, choice: int | None = None) -> str:
        """Handle Instagram 2FA/checkpoint challenge.

        Called by instagrapi when Instagram requests verification.
        Logs warning and returns empty string (extend later for notifier/stdin).
        """
        logger.warning(
            "Instagram challenge required for %s, choice=%s", username, choice
        )
        return ""

    def get_client(self) -> Client | None:
        """Return the logged-in instagrapi Client instance, or None."""
        return self._client

    def is_session_valid(self) -> bool:
        """Check if client is logged in and session file exists."""
        return self._client is not None and os.path.exists(self._session_path)

    def logout(self) -> None:
        """Logout and preserve session file."""
        if self._client is None:
            return
        try:
            self._client.dump_settings(self._session_path)
            self._client.logout()
        except Exception as exc:
            logger.warning("Logout error for %s: %s", self._username, exc)
        finally:
            self._client = None

    def is_in_cooldown(self) -> bool:
        if self._cooldown_until is None:
            return False
        return datetime.now() < self._cooldown_until

    def get_cooldown_until(self) -> datetime | None:
        return self._cooldown_until

    def _set_cooldown(self, minutes: int = 30) -> None:
        self._cooldown_until = datetime.now() + timedelta(minutes=max(30, minutes))

    def get_direct_threads(self, amount: int = 20):
        if self._client is None:
            raise RuntimeError("Instagram client is not authenticated")
        if self.is_in_cooldown():
            return []
        try:
            return self._client.direct_threads(amount=amount)
        except PleaseWaitFewMinutes as exc:
            self._set_cooldown(30)
            raise InstagramRateLimitError(
                "Instagram DM thread API rate limited"
            ) from exc
        except Exception as exc:
            if "please wait" in str(exc).lower():
                self._set_cooldown(30)
                raise InstagramRateLimitError(
                    "Instagram DM thread API temporarily blocked"
                ) from exc
            raise

    def get_thread_messages(self, thread_id: str, amount: int = 5):
        if self._client is None:
            raise RuntimeError("Instagram client is not authenticated")
        if self.is_in_cooldown():
            return []
        try:
            normalized_thread_id = int(thread_id)
            return self._client.direct_messages(
                thread_id=normalized_thread_id, amount=amount
            )
        except ValueError:
            logger.warning("Invalid thread id for direct_messages: %s", thread_id)
            return []
        except PleaseWaitFewMinutes as exc:
            self._set_cooldown(30)
            raise InstagramRateLimitError(
                "Instagram DM message API rate limited"
            ) from exc
        except Exception as exc:
            if "please wait" in str(exc).lower():
                self._set_cooldown(30)
                raise InstagramRateLimitError(
                    "Instagram DM message API temporarily blocked"
                ) from exc
            raise
