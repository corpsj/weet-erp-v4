import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Protocol

logger = logging.getLogger(__name__)


@dataclass
class TaskResult:
    task_name: str
    success: bool
    error: Optional[str] = None
    executed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class DiscordAlertClient(Protocol):
    def send_alert(self, alert_type: str, message: str) -> bool: ...


class TaskRunner:
    MAX_RETRIES: int = 3
    INSTAGRAM_RETRY_WAIT_SECONDS: int = 1800
    RATE_LIMIT_WAIT_SECONDS: int = 3600

    def __init__(
        self,
        discord_bot: Optional[DiscordAlertClient] = None,
        dry_run: bool = False,
    ):
        self.discord_bot: Optional[DiscordAlertClient] = discord_bot
        self.dry_run: bool = dry_run
        self._log: list[TaskResult] = []

    async def run(
        self,
        task_name: str,
        coro_fn: Callable[[], Awaitable[object]],
    ) -> TaskResult:
        for attempt in range(self.MAX_RETRIES):
            try:
                if not self.dry_run:
                    await coro_fn()
                else:
                    logger.info("[DRY-RUN] Skipping: %s", task_name)
                result = TaskResult(task_name=task_name, success=True)
                self._log.append(result)
                return result
            except ConnectionError as exc:
                logger.warning(
                    "[%s] LMStudio error (attempt %s): %s", task_name, attempt + 1, exc
                )
                if attempt == self.MAX_RETRIES - 1:
                    result = TaskResult(
                        task_name=task_name, success=False, error=str(exc)
                    )
                    self._log.append(result)
                    if self.discord_bot:
                        self.discord_bot.send_alert(
                            "error", f"{task_name} failed: {exc}"
                        )
                    return result
            except RuntimeError as exc:
                logger.error("[%s] Rate limit: %s", task_name, exc)
                result = TaskResult(task_name=task_name, success=False, error=str(exc))
                self._log.append(result)
                if self.discord_bot:
                    self.discord_bot.send_alert(
                        "error", f"{task_name} rate limited: {exc}"
                    )
                return result
            except Exception as exc:
                logger.error(
                    "[%s] Unexpected error (attempt %s): %s",
                    task_name,
                    attempt + 1,
                    exc,
                )
                if attempt == self.MAX_RETRIES - 1:
                    result = TaskResult(
                        task_name=task_name, success=False, error=str(exc)
                    )
                    self._log.append(result)
                    if self.discord_bot:
                        self.discord_bot.send_alert(
                            "error", f"{task_name} failed: {exc}"
                        )
                    return result

        return TaskResult(
            task_name=task_name, success=False, error="max retries exceeded"
        )

    def get_log(self) -> list[TaskResult]:
        return list(self._log)
