import logging
import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime
from importlib import import_module
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from app.clients.error_classifier import SUCCESS, classify_response, get_retry_strategy
from app.clients.openclaw import OpenClawBridge
from app.db.session import get_supabase

AsyncIOScheduler = import_module("apscheduler.schedulers.asyncio").AsyncIOScheduler
CronTrigger = import_module("apscheduler.triggers.cron").CronTrigger

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.orchestrator.runner import TaskRunner


class WeetScheduler:
    CONTENT_PUBLISH_CHANNELS: tuple[str, ...] = (
        "naver-cafe",
        "instagram",
        "naver-blog",
        "youtube",
        "daangn",
        "kakao",
    )
    MARKET_SCAN_KEYWORDS: tuple[str, ...] = (
        "인테리어",
        "홈스타일링",
        "수납",
        "리빙",
    )

    def __init__(self, runner: "TaskRunner", dry_run: bool = False):
        self.runner: TaskRunner = runner
        self.dry_run: bool = dry_run
        self.scheduler: Any = AsyncIOScheduler(timezone="Asia/Seoul")
        self._jobs_registered: bool = False
        self._kst: ZoneInfo = ZoneInfo("Asia/Seoul")

    def setup_jobs(self) -> None:
        if self._jobs_registered:
            return

        _ = self.scheduler.add_job(
            self._job_daily_reset,
            CronTrigger(hour=6, minute=0, timezone="Asia/Seoul"),
            id="daily_reset",
        )
        _ = self.scheduler.add_job(
            self._job_market_scan,
            CronTrigger(hour=7, minute=0, timezone="Asia/Seoul"),
            id="market_scan",
        )
        _ = self.scheduler.add_job(
            self._job_suggestion_run,
            CronTrigger(hour=8, minute=0, timezone="Asia/Seoul"),
            id="suggestion_run",
        )
        _ = self.scheduler.add_job(
            self._job_daily_report,
            CronTrigger(hour=9, minute=0, timezone="Asia/Seoul"),
            id="daily_report",
        )
        _ = self.scheduler.add_job(
            self._job_journey_check,
            CronTrigger(hour=10, minute=0, timezone="Asia/Seoul"),
            id="journey_check",
        )
        _ = self.scheduler.add_job(
            self._job_content_generate,
            CronTrigger(hour=13, minute=0, timezone="Asia/Seoul"),
            id="content_generate",
        )
        _ = self.scheduler.add_job(
            self._job_content_publish,
            CronTrigger(hour=15, minute=0, timezone="Asia/Seoul"),
            id="content_publish",
        )
        _ = self.scheduler.add_job(
            self._job_lead_hunt,
            CronTrigger(hour=18, minute=0, timezone="Asia/Seoul"),
            id="lead_hunt",
        )
        _ = self.scheduler.add_job(
            self._job_evening_followup,
            CronTrigger(hour=21, minute=0, timezone="Asia/Seoul"),
            id="evening_followup",
        )
        _ = self.scheduler.add_job(
            self._job_weekly_report,
            CronTrigger(day_of_week="mon", hour=9, minute=0, timezone="Asia/Seoul"),
            id="weekly_report",
        )
        _ = self.scheduler.add_job(
            self._job_monthly_analysis,
            CronTrigger(day=1, hour=9, minute=0, timezone="Asia/Seoul"),
            id="monthly_analysis",
        )
        self._jobs_registered = True

    def start(self) -> None:
        self.setup_jobs()
        self.scheduler.start()

    def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def get_job_ids(self) -> list[str]:
        return [job.id for job in self.scheduler.get_jobs()]

    async def _run_task(
        self, task_name: str, fn: Callable[[], Awaitable[None]]
    ) -> None:
        _ = await self.runner.run(task_name, fn)

    def _can_run_instagram_action(self) -> bool:
        hour = datetime.now(self._kst).hour
        return 6 <= hour < 23

    async def _noop(self) -> None:
        return None

    async def _execute_openclaw_call(
        self,
        job_name: str,
        operation_name: str,
        operation: Callable[[], Awaitable[dict[str, object]]],
    ) -> dict[str, object]:
        attempt = 0
        max_attempts = 1
        result: dict[str, object] = {"success": False, "content": ""}
        while attempt < max_attempts:
            try:
                raw_result = await operation()
                success = bool(raw_result.get("success", False))
                content = str(raw_result.get("content", ""))
                result = dict(raw_result)
                result["success"] = success
                result["content"] = content
            except Exception as exc:
                success = False
                content = str(exc)
                result = {"success": False, "content": content}

            error_type = classify_response(success, content)
            retry_strategy = get_retry_strategy(error_type)
            logger.info(
                "[%s] %s attempt %s/%s => %s",
                job_name,
                operation_name,
                attempt + 1,
                max_attempts,
                error_type,
            )

            should_retry = bool(retry_strategy.get("retry", False))
            retry_limit = self._as_int(retry_strategy.get("max_retries", 0))
            max_attempts = max(max_attempts, retry_limit + 1)
            if error_type == SUCCESS or not should_retry or attempt >= max_attempts - 1:
                return result

            backoff = self._as_int(retry_strategy.get("backoff", 0))
            if backoff > 0:
                await asyncio.sleep(backoff)
            attempt += 1

        return {"success": False, "content": "retry attempts exhausted"}

    @staticmethod
    def _as_int(value: object, default: int = 0) -> int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                return default
        return default

    def _record_daily_metric(self, metric_name: str, increment: int) -> None:
        if increment <= 0:
            return
        try:
            sb = get_supabase()
            metric_date = datetime.now(self._kst).strftime("%Y-%m-%d")
            current_row = (
                sb.table("daily_metrics")
                .select(metric_name)
                .eq("date", metric_date)
                .limit(1)
                .execute()
            )
            current_value = 0
            if current_row.data:
                current_value = int(current_row.data[0].get(metric_name, 0) or 0)
            payload = {"date": metric_date, metric_name: current_value + increment}
            _ = sb.table("daily_metrics").upsert(payload).execute()
        except Exception as exc:
            logger.warning("Failed to write daily_metrics(%s): %s", metric_name, exc)

    async def _run_content_publish_job(self) -> None:
        if self.dry_run:
            logger.info("DRY-RUN: would call OpenClaw for content_publish")
            return

        content_id = f"content-{datetime.now(self._kst).strftime('%Y%m%d')}"
        success_count = 0
        bridge = OpenClawBridge()
        try:
            for channel in self.CONTENT_PUBLISH_CHANNELS:
                if channel == "instagram":
                    # Fetch content metadata to determine format type
                    try:
                        sb = get_supabase()
                        content_row = (
                            sb.table("marketing_contents")
                            .select("metadata,caption")
                            .eq("content_id", content_id)
                            .limit(1)
                            .execute()
                        )
                        metadata: dict[str, object] = {}
                        caption = ""
                        if content_row.data:
                            raw_meta = content_row.data[0].get("metadata")
                            metadata = raw_meta if isinstance(raw_meta, dict) else {}
                            caption = str(content_row.data[0].get("caption") or "")
                        format_type = str(metadata.get("format_type", "feed"))
                    except Exception:
                        format_type = "feed"
                        caption = ""

                    if format_type == "story":
                        operation = lambda cid=content_id: (
                            bridge.publish_instagram_story(cid, "")
                        )
                    elif format_type == "reel":
                        operation = lambda cid=content_id, cap=caption: (
                            bridge.publish_instagram_reel(cid, cap, "")
                        )
                    else:
                        operation = lambda cid=content_id, cap=caption: (
                            bridge.publish_instagram_feed(cid, cap, "")
                        )

                    result = await self._execute_openclaw_call(
                        "content_publish",
                        f"publish_{format_type}:instagram",
                        operation,
                    )
                else:
                    result = await self._execute_openclaw_call(
                        "content_publish",
                        f"publish_content:{channel}",
                        lambda c=channel: bridge.publish_content(c, content_id),
                    )

                success = bool(result.get("success", False))
                if success:
                    success_count += 1
                else:
                    logger.error(
                        "[content_publish] OpenClaw publish failed channel=%s content=%s",
                        channel,
                        result.get("content", ""),
                    )
            self._record_daily_metric("contents_published", success_count)
            if success_count != len(self.CONTENT_PUBLISH_CHANNELS):
                raise RuntimeError(
                    "content_publish failed for one or more channels via OpenClaw"
                )
        finally:
            await bridge.close()

    async def _run_lead_hunt_job(self) -> None:
        if self.dry_run:
            logger.info("DRY-RUN: would run Instagram lead hunt")
            return

        from app.channels.instagram import InstagramChannel

        channel = InstagramChannel()
        bridge = OpenClawBridge()
        try:
            commenters = await channel.get_competitor_commenters()
            likers = await channel.get_competitor_likers()
            hashtag_users = await channel.get_hashtag_users()
            total_leads = commenters + likers + hashtag_users

            self._record_daily_metric("leads_collected", len(total_leads))

            for lead in commenters:
                try:
                    _ = await self._execute_openclaw_call(
                        "lead_hunt",
                        f"engage_follow:{lead.username}",
                        lambda u=lead.username: bridge.engage_instagram_follow(u),
                    )
                except Exception as exc:
                    logger.warning(
                        "Follow engagement failed for %s: %s", lead.username, exc
                    )
        finally:
            await bridge.close()

    async def _run_evening_followup_job(self) -> None:
        if self.dry_run:
            logger.info("DRY-RUN: would run evening followup")
            return

        bridge = OpenClawBridge()
        try:
            sb = get_supabase()
            result = (
                sb.table("marketing_leads")
                .select("username,source")
                .eq("platform", "instagram")
                .eq("status", "new")
                .limit(20)
                .execute()
            )
            leads: list[dict[str, Any]] = result.data or []

            engagement_count = 0
            for lead_row in leads:
                username = str(lead_row.get("username", "") or "")
                if not username:
                    continue
                try:
                    _ = await self._execute_openclaw_call(
                        "evening_followup",
                        f"engage_follow:{username}",
                        lambda u=username: bridge.engage_instagram_follow(u),
                    )
                    engagement_count += 1
                except Exception as exc:
                    logger.warning("Evening followup failed for %s: %s", username, exc)

            self._record_daily_metric("proposals_made", engagement_count)
        finally:
            await bridge.close()

    async def _run_market_scan_job(self) -> None:
        await self._noop()

        if self.dry_run:
            logger.info("DRY-RUN: would call OpenClaw for market_scan")
            return

        bridge = OpenClawBridge()
        try:
            result = await self._execute_openclaw_call(
                "market_scan",
                "scan_competitors",
                lambda: bridge.scan_competitors(list(self.MARKET_SCAN_KEYWORDS)),
            )
            if not bool(result.get("success", False)):
                raise RuntimeError(
                    f"market_scan OpenClaw scan failed: {result.get('content', '')}"
                )
            self._record_daily_metric("proposals_approved", 1)
        finally:
            await bridge.close()

    async def _job_daily_reset(self) -> None:
        await self._run_task("daily_reset", self._noop)

    async def _job_market_scan(self) -> None:
        await self._run_task("market_scan", self._run_market_scan_job)

    async def _job_suggestion_run(self) -> None:
        await self._run_task("suggestion_run", self._noop)

    async def _job_daily_report(self) -> None:
        await self._run_task("daily_report", self._noop)

    async def _job_journey_check(self) -> None:
        await self._run_task("journey_check", self._noop)

    async def _job_content_generate(self) -> None:
        await self._run_task("content_generate", self._noop)

    async def _job_content_publish(self) -> None:
        if not self._can_run_instagram_action():
            logger.info("Skipping content_publish outside Instagram hours")
            return
        await self._run_task("content_publish", self._run_content_publish_job)

    async def _job_lead_hunt(self) -> None:
        await self._run_task("lead_hunt", self._run_lead_hunt_job)

    async def _job_evening_followup(self) -> None:
        if not self._can_run_instagram_action():
            logger.info("Skipping evening_followup outside Instagram hours")
            return
        await self._run_task("evening_followup", self._run_evening_followup_job)

    async def _job_weekly_report(self) -> None:
        await self._run_task("weekly_report", self._noop)

    async def _job_monthly_analysis(self) -> None:
        await self._run_task("monthly_analysis", self._noop)
