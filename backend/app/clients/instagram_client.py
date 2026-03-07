"""Instagram client wrapper using instagrapi with session file management."""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import ClassVar

from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
)

logger = logging.getLogger(__name__)


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
            client.challenge_code_handler = self._challenge_callback

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
                    client.challenge_code_handler = self._challenge_callback
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

    def _challenge_callback(self, username: str, choice: int) -> str:
        """Handle Instagram 2FA/checkpoint challenge.

        Called by instagrapi when Instagram requests verification.
        Logs warning and returns empty string (extend later for Discord/stdin).
        """
        logger.warning(
            "Instagram challenge required for %s, choice=%d", username, choice
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
