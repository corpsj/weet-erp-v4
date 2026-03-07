import logging
import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
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
        IntervalTrigger = import_module("apscheduler.triggers.interval").IntervalTrigger
        _ = self.scheduler.add_job(
            self._job_manual_lead_collect,
            IntervalTrigger(minutes=5),
            id="manual_lead_collect",
        )
        _ = self.scheduler.add_job(
            self._job_evening_followup,
            CronTrigger(hour=21, minute=0, timezone="Asia/Seoul"),
            id="evening_followup",
        )
        _ = self.scheduler.add_job(
            self._job_content_engagement,
            CronTrigger(hour=22, minute=0, timezone="Asia/Seoul"),
            id="content_engagement",
        )
        _ = self.scheduler.add_job(
            self._job_proposal_execute,
            CronTrigger(hour=14, minute=0, timezone="Asia/Seoul"),
            id="proposal_execute",
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
        self._write_heartbeat(task_name)

    def _write_heartbeat(self, last_task: str) -> None:
        try:
            sb = get_supabase()
            now = datetime.now(self._kst)
            sb.table("marketing_settings").upsert(
                {
                    "key": "scheduler_heartbeat",
                    "value": {
                        "timestamp": now.isoformat(),
                        "last_run": now.isoformat(),
                        "last_task": last_task,
                    },
                }
            ).execute()
        except Exception as exc:
            logger.warning("Failed to write scheduler heartbeat: %s", exc)

    def _can_run_instagram_action(self) -> bool:
        hour = datetime.now(self._kst).hour
        return 7 <= hour < 23

    async def _noop(self) -> None:
        return None

    async def _run_daily_reset_job(self) -> None:
        sb = get_supabase()
        today = datetime.now(self._kst).strftime("%Y-%m-%d")
        sb.table("marketing_daily_metrics").upsert(
            {
                "date": today,
                "leads_collected": 0,
                "proposals_made": 0,
                "proposals_approved": 0,
                "contents_published": 0,
                "naver_api_calls": 0,
            },
            on_conflict="date",
        ).execute()
        logger.info("Daily metrics reset for %s", today)

    async def _run_suggestion_job(self) -> None:
        from app.intelligence.suggestion import SuggestionEngine

        engine = SuggestionEngine()
        insights = await engine.learn_from_results()
        proposals = await engine.generate_suggestions(
            max_proposals=3, prior_insights=insights
        )
        for proposal in proposals:
            await engine.propose(proposal)
        logger.info(
            "Generated %d proposals (insights: %s)",
            len(proposals),
            insights.get("insights", []),
        )

    async def _run_daily_report_job(self) -> None:
        from app.core.discord_bot import DiscordBot

        sb = get_supabase()
        today = datetime.now(self._kst).strftime("%Y-%m-%d")
        result = (
            sb.table("marketing_daily_metrics")
            .select("*")
            .eq("date", today)
            .limit(1)
            .execute()
        )
        metrics = result.data[0] if result.data else {}
        bot = DiscordBot()
        bot.send_daily_report(metrics)
        logger.info("Daily report sent")

    async def _run_journey_check_job(self) -> None:
        sb = get_supabase()
        result = (
            sb.table("marketing_leads")
            .select(
                "id,username,score,status,journey_stage,persona_type,metadata,last_action_at"
            )
            .neq("status", "converted")
            .order("score", desc=True)
            .limit(100)
            .execute()
        )
        leads = result.data or []
        updated = 0

        for lead in leads:
            score = int(lead.get("score") or 0)
            current_status = str(lead.get("status") or "new")
            current_stage = str(lead.get("journey_stage") or "awareness")
            meta = lead.get("metadata") or {}
            encounters = int(meta.get("encounters") or 1)
            sources = meta.get("sources") or []
            source_count = len(sources) if isinstance(sources, list) else 0

            new_status = current_status
            new_stage = current_stage

            # --- status transitions (score-based) ---
            if score >= 30:
                new_status = "super_hot"
            elif score >= 20:
                new_status = "hot"
            elif score >= 8 and current_status == "new":
                new_status = "contacted"

            # --- journey_stage transitions (behavior-based) ---
            if current_stage == "awareness":
                if score >= 8 or encounters >= 2:
                    new_stage = "interest"
            elif current_stage == "interest":
                if score >= 15 or (source_count >= 2 and encounters >= 3):
                    new_stage = "explore"
            elif current_stage == "explore":
                by_comp = meta.get("by_competitor", {})
                comp_count = len(by_comp) if isinstance(by_comp, dict) else 0
                if comp_count >= 2 or score >= 22:
                    new_stage = "compare"
            elif current_stage == "compare":
                if score >= 30:
                    new_stage = "hesitate"
            elif current_stage == "hesitate":
                if score >= 35:
                    new_stage = "decide"

            changes: dict[str, str] = {}
            if new_status != current_status:
                changes["status"] = new_status
            if new_stage != current_stage:
                changes["journey_stage"] = new_stage

            if changes:
                sb.table("marketing_leads").update(changes).eq(
                    "id", lead["id"]
                ).execute()
                updated += 1

            if new_stage == "decide" and current_stage != "decide":
                try:
                    from app.conversion.consultation import ConsultationService

                    svc = ConsultationService()
                    consultation_id = svc.create_consultation(
                        lead_id=lead["id"],
                        request_channel="auto_decide",
                        persona_type=lead.get("persona_type"),
                        metadata={"trigger": "score_threshold", "score": score},
                    )
                    if consultation_id:
                        svc.send_conversion_discord_alert(lead, consultation_id)
                    self._record_daily_metric("consultations_requested", 1)
                except Exception as exc:
                    logger.warning(
                        "Conversion pipeline failed for @%s: %s",
                        lead.get("username", "unknown"),
                        exc,
                    )
                logger.info(
                    "Conversion triggered for @%s (score=%s, persona=%s)",
                    lead.get("username", "unknown"),
                    score,
                    lead.get("persona_type") or "unknown",
                )

        logger.info("Journey check: %d leads updated out of %d", updated, len(leads))

    async def _run_content_generate_job(self) -> None:
        from app.content.generator import ContentGenerator
        from collections import Counter

        gen = ContentGenerator()
        sb = get_supabase()

        topic, keywords = self._pick_content_topic(sb)
        persona_result = (
            sb.table("marketing_leads")
            .select("persona_type")
            .neq("persona_type", None)
            .limit(100)
            .execute()
        )
        personas = [
            row.get("persona_type")
            for row in (persona_result.data or [])
            if row.get("persona_type")
        ]
        top_persona = (
            Counter(personas).most_common(1)[0][0] if personas else "lifestyle"
        )

        channels_config = [
            (
                "naver_blog",
                lambda t, kw, p=top_persona: gen.generate_blog_article(
                    t, kw, persona=p
                ),
            ),
            ("instagram", lambda t, kw: gen.generate_instagram_caption(t)),
            ("naver_cafe", lambda t, kw: gen.generate_cafe_post(t)),
        ]

        saved = 0
        for channel, gen_fn in channels_config:
            try:
                result = await gen_fn(topic, keywords)
                if not result:
                    continue

                title = getattr(result, "title", topic)
                body = getattr(result, "body", "")
                media_path: str | None = None
                if channel == "instagram":
                    try:
                        from app.conversion.image_service import ImageService

                        img_svc = ImageService()
                        media_path = await img_svc.generate_marketing_image(
                            topic, top_persona
                        )
                    except Exception as exc:
                        logger.warning("Image generation failed for %s: %s", topic, exc)

                sb.table("marketing_contents").insert(
                    {
                        "channel": channel,
                        "title": title,
                        "body": body,
                        "status": "draft",
                        "metadata": {
                            "topic": topic,
                            "keywords": keywords,
                            "persona_target": top_persona,
                            "media_path": media_path,
                            "generated_at": datetime.now(self._kst).isoformat(),
                        },
                    }
                ).execute()
                saved += 1
                logger.info("Content generated for %s: %s", channel, title)
            except Exception as exc:
                logger.warning("Content generation failed for %s: %s", channel, exc)

        self._record_daily_metric("proposals_made", saved)

    async def _run_content_engagement_job(self) -> None:
        sb = get_supabase()
        cutoff = (datetime.now(self._kst) - timedelta(hours=72)).isoformat()
        result = (
            sb.table("marketing_contents")
            .select("id,channel,metadata")
            .eq("status", "published")
            .gte("published_at", cutoff)
            .execute()
        )
        contents = result.data or []
        for content in contents:
            cid = content.get("id")
            meta = content.get("metadata") or {}
            if meta.get("engagement_collected"):
                continue

            sb.table("marketing_contents").update(
                {
                    "engagement_metrics": {
                        "collected_at": datetime.now(self._kst).isoformat(),
                        "status": "pending_collection",
                    },
                    "metadata": {**meta, "engagement_collected": True},
                }
            ).eq("id", cid).execute()
        logger.info("Content engagement check: %d contents processed", len(contents))

    def _pick_content_topic(self, sb) -> tuple[str, list[str]]:
        """Pick a topic from recent signals; fall back to evergreen topics."""
        from collections import Counter

        try:
            result = (
                sb.table("marketing_signals")
                .select("keywords,title")
                .order("created_at", desc=True)
                .limit(30)
                .execute()
            )
            rows = result.data or []
        except Exception:
            rows = []

        if rows:
            kw_counter: Counter[str] = Counter()
            for row in rows:
                kws = row.get("keywords") or []
                if isinstance(kws, list):
                    kw_counter.update(kws)
            if kw_counter:
                top_keywords = [kw for kw, _ in kw_counter.most_common(5)]
                topic = top_keywords[0]
                return topic, top_keywords[:3]

        evergreen = [
            ("이동식주택 실거주 후기", ["이동식주택", "전원생활", "모듈러주택"]),
            ("모듈러주택 비용 비교", ["모듈러주택", "건축비용", "이동식주택"]),
            ("귀촌 준비 체크리스트", ["귀촌", "전원주택", "세컨하우스"]),
            ("농막 vs 이동식주택 차이", ["농막", "이동식주택", "컨테이너하우스"]),
            ("소형주택 트렌드", ["소형주택", "미니멀하우스", "1인가구"]),
        ]
        import random

        return random.choice(evergreen)

    async def _run_weekly_report_job(self) -> None:
        from app.core.discord_bot import DiscordBot

        sb = get_supabase()
        result = (
            sb.table("marketing_daily_metrics")
            .select("*")
            .order("date", desc=True)
            .limit(7)
            .execute()
        )
        days = result.data or []
        total_leads = sum(int(day.get("leads_collected") or 0) for day in days)
        total_proposals = sum(int(day.get("proposals_made") or 0) for day in days)
        total_published = sum(int(day.get("contents_published") or 0) for day in days)
        bot = DiscordBot()
        bot.send_weekly_report(
            {
                "total_leads": total_leads,
                "total_proposals": total_proposals,
                "total_published": total_published,
            }
        )
        logger.info("Weekly report sent")

    async def _run_monthly_analysis_job(self) -> None:
        from app.core.discord_bot import DiscordBot

        sb = get_supabase()
        result = (
            sb.table("marketing_daily_metrics")
            .select("*")
            .order("date", desc=True)
            .limit(30)
            .execute()
        )
        days = result.data or []
        total_leads = sum(int(day.get("leads_collected") or 0) for day in days)
        total_proposals = sum(int(day.get("proposals_made") or 0) for day in days)
        total_published = sum(int(day.get("contents_published") or 0) for day in days)
        bot = DiscordBot()
        bot.send_message(
            f"📊 **월간 마케팅 분석**\n리드: {total_leads}건 | 제안: {total_proposals}건 | 발행: {total_published}건 | 기간: {len(days)}일"
        )
        logger.info("Monthly analysis sent")

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
                sb.table("marketing_daily_metrics")
                .select(metric_name)
                .eq("date", metric_date)
                .limit(1)
                .execute()
            )
            current_value = 0
            if current_row.data:
                current_value = int(current_row.data[0].get(metric_name, 0) or 0)
            payload = {"date": metric_date, metric_name: current_value + increment}
            _ = sb.table("marketing_daily_metrics").upsert(payload).execute()
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
                    format_type = "feed"
                    caption = ""
                    media_path = ""
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
                        media_path = ""
                        if content_row.data:
                            raw_meta = content_row.data[0].get("metadata")
                            metadata = raw_meta if isinstance(raw_meta, dict) else {}
                            caption = str(content_row.data[0].get("caption") or "")
                            media_path = str(metadata.get("media_path") or "")
                        format_type = str(metadata.get("format_type", "feed"))
                    except Exception:
                        pass

                    if format_type == "story":
                        operation = lambda cid=content_id, mp=media_path: (
                            bridge.publish_instagram_story(cid, mp)
                        )
                    elif format_type == "reel":
                        operation = lambda cid=content_id, cap=caption, mp=media_path: (
                            bridge.publish_instagram_reel(cid, cap, mp)
                        )
                    else:
                        operation = lambda cid=content_id, cap=caption, mp=media_path: (
                            bridge.publish_instagram_feed(cid, cap, mp)
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
            total_leads = commenters + likers

            self._record_daily_metric("leads_collected", len(total_leads))

            for lead in commenters:
                if lead.id is None:
                    continue
                try:
                    _ = await self._execute_openclaw_call(
                        "lead_hunt",
                        f"engage_follow:{lead.username}",
                        lambda lid=str(lead.id): bridge.engage_instagram_follow(lid),
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

            # Phase 1: Like posts of warm leads (score 8-19)
            warm_result = (
                sb.table("marketing_leads")
                .select("id,username,score,metadata")
                .eq("platform", "instagram")
                .gte("score", 8)
                .order("score", desc=True)
                .limit(15)
                .execute()
            )
            warm_leads: list[dict[str, Any]] = warm_result.data or []
            like_count = 0
            for lead_row in warm_leads:
                score = int(lead_row.get("score") or 0)
                if score >= 20:
                    continue
                lead_id = str(lead_row.get("id") or "")
                if not lead_id:
                    continue
                try:
                    await self._execute_openclaw_call(
                        "evening_followup",
                        f"engage_like:{lead_row.get('username', '')}",
                        lambda lid=lead_id: bridge.engage_instagram_like(lid),
                    )
                    like_count += 1
                except Exception as exc:
                    logger.warning(
                        "Like engagement failed for %s: %s",
                        lead_row.get("username"),
                        exc,
                    )

            # Phase 2: Follow hot leads (score >= 20)
            hot_result = (
                sb.table("marketing_leads")
                .select("id,username,score,journey_stage,persona_type")
                .eq("platform", "instagram")
                .gte("score", 20)
                .order("score", desc=True)
                .limit(10)
                .execute()
            )
            hot_leads: list[dict[str, Any]] = hot_result.data or []
            follow_count = 0
            for lead_row in hot_leads:
                lead_id = str(lead_row.get("id") or "")
                if not lead_id:
                    continue
                try:
                    await self._execute_openclaw_call(
                        "evening_followup",
                        f"engage_follow:{lead_row.get('username', '')}",
                        lambda lid=lead_id: bridge.engage_instagram_follow(lid),
                    )
                    follow_count += 1
                except Exception as exc:
                    logger.warning(
                        "Follow engagement failed for %s: %s",
                        lead_row.get("username"),
                        exc,
                    )

            # Phase 3: DM super-hot leads (score >= 30) not DM'd in 48h
            super_result = (
                sb.table("marketing_leads")
                .select("id,username,score,journey_stage,persona_type")
                .eq("platform", "instagram")
                .gte("score", 30)
                .order("score", desc=True)
                .limit(5)
                .execute()
            )
            super_leads: list[dict[str, Any]] = super_result.data or []
            dm_count = 0
            for lead_row in super_leads:
                lead_id = str(lead_row.get("id") or "")
                username = str(lead_row.get("username") or "")
                if not lead_id or not username:
                    continue

                persona = str(lead_row.get("persona_type") or "일반")
                from app.conversion.consultation import ConsultationService

                svc = ConsultationService()
                dm_msg = svc.get_persona_dm(username, persona)
                try:
                    await self._execute_openclaw_call(
                        "evening_followup",
                        f"engage_dm:{username}",
                        lambda lid=lead_id, msg=dm_msg: bridge.engage_instagram_dm(
                            lid, msg
                        ),
                    )
                    dm_count += 1
                except Exception as exc:
                    logger.warning("DM engagement failed for %s: %s", username, exc)

            total = like_count + follow_count + dm_count
            logger.info(
                "Evening followup: %d likes, %d follows, %d DMs",
                like_count,
                follow_count,
                dm_count,
            )
            self._record_daily_metric("proposals_made", total)
        finally:
            await bridge.close()

    async def _run_market_scan_job(self) -> None:
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
        await self._run_task("daily_reset", self._run_daily_reset_job)

    async def _job_market_scan(self) -> None:
        await self._run_task("market_scan", self._run_market_scan_job)

    async def _job_suggestion_run(self) -> None:
        await self._run_task("suggestion_run", self._run_suggestion_job)

    async def _job_daily_report(self) -> None:
        await self._run_task("daily_report", self._run_daily_report_job)

    async def _job_journey_check(self) -> None:
        await self._run_task("journey_check", self._run_journey_check_job)

    async def _job_content_generate(self) -> None:
        await self._run_task("content_generate", self._run_content_generate_job)

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

    async def _job_content_engagement(self) -> None:
        await self._run_task("content_engagement", self._run_content_engagement_job)

    def _check_manual_collect_flag(self) -> bool:
        try:
            sb = get_supabase()
            result = (
                sb.table("marketing_settings")
                .select("value")
                .eq("key", "lead_collection_requested")
                .limit(1)
                .execute()
            )
            if not result.data:
                return False
            value = result.data[0].get("value")
            if isinstance(value, dict):
                return bool(value.get("requested", False))
            return False
        except Exception as exc:
            logger.warning("Failed to check manual collect flag: %s", exc)
            return False

    def _clear_manual_collect_flag(self) -> None:
        try:
            sb = get_supabase()
            sb.table("marketing_settings").upsert(
                {
                    "key": "lead_collection_requested",
                    "value": {
                        "requested": False,
                        "completed_at": datetime.now(self._kst).isoformat(),
                    },
                }
            ).execute()
        except Exception as exc:
            logger.warning("Failed to clear manual collect flag: %s", exc)

    async def _job_manual_lead_collect(self) -> None:
        if self.dry_run:
            return
        if not self._check_manual_collect_flag():
            return
        logger.info("Manual lead collection triggered via web UI")
        await self._run_task("manual_lead_collect", self._run_lead_hunt_job)
        self._clear_manual_collect_flag()
        logger.info("Manual lead collection completed, flag cleared")

    async def _job_proposal_execute(self) -> None:
        await self._run_task("proposal_execute", self._run_proposal_execute_job)

    async def _run_proposal_execute_job(self) -> None:
        """Execute approved proposals: content→generate, outreach→engage."""
        sb = get_supabase()
        result = (
            sb.table("marketing_proposals")
            .select("id,title,action_type,content_draft,status")
            .eq("status", "approved")
            .order("approved_at", desc=True)
            .limit(5)
            .execute()
        )
        proposals = result.data or []
        if not proposals:
            logger.info("No approved proposals to execute")
            return

        from app.content.generator import ContentGenerator

        gen = ContentGenerator()
        executed = 0

        for proposal in proposals:
            pid = proposal.get("id")
            action = str(proposal.get("action_type") or "content")
            title = str(proposal.get("title") or "")
            draft = str(proposal.get("content_draft") or "")

            try:
                if action == "content":
                    await self._execute_content_proposal(sb, gen, proposal)
                elif action == "outreach":
                    await self._execute_outreach_proposal(sb, proposal)
                else:
                    logger.info(
                        "Proposal %s has action_type=%s, marking executed", pid, action
                    )

                sb.table("marketing_proposals").update(
                    {
                        "status": "executed",
                        "metadata": {
                            "executed_at": datetime.now(self._kst).isoformat(),
                            "execution_result": "success",
                        },
                    }
                ).eq("id", pid).execute()
                executed += 1
            except Exception as exc:
                logger.error("Failed to execute proposal %s: %s", pid, exc)
                sb.table("marketing_proposals").update(
                    {
                        "status": "execution_failed",
                        "metadata": {
                            "executed_at": datetime.now(self._kst).isoformat(),
                            "execution_error": str(exc)[:500],
                        },
                    }
                ).eq("id", pid).execute()

        self._record_daily_metric("proposals_approved", executed)
        logger.info("Proposal execution: %d/%d executed", executed, len(proposals))

    async def _execute_content_proposal(
        self, sb, gen, proposal: dict[str, Any]
    ) -> None:
        title = str(proposal.get("title") or "")
        draft = str(proposal.get("content_draft") or "")

        if draft:
            sb.table("marketing_contents").insert(
                {
                    "channel": "instagram",
                    "title": title,
                    "body": draft,
                    "status": "draft",
                    "metadata": {
                        "source": "proposal",
                        "proposal_id": proposal.get("id"),
                        "generated_at": datetime.now(self._kst).isoformat(),
                    },
                }
            ).execute()
        else:
            result = await gen.generate_instagram_caption(topic=title)
            if result:
                sb.table("marketing_contents").insert(
                    {
                        "channel": "instagram",
                        "title": title,
                        "body": result.body,
                        "status": "draft",
                        "metadata": {
                            "source": "proposal_generated",
                            "proposal_id": proposal.get("id"),
                            "hashtags": result.hashtags,
                            "generated_at": datetime.now(self._kst).isoformat(),
                        },
                    }
                ).execute()

    async def _execute_outreach_proposal(self, sb, proposal: dict[str, Any]) -> None:
        bridge = OpenClawBridge()
        try:
            hot_leads = (
                sb.table("marketing_leads")
                .select("id,username")
                .eq("platform", "instagram")
                .gte("score", 20)
                .order("score", desc=True)
                .limit(5)
                .execute()
            )
            leads = hot_leads.data or []
            for lead in leads:
                lid = str(lead.get("id") or "")
                if lid:
                    await self._execute_openclaw_call(
                        "proposal_execute",
                        f"outreach_follow:{lead.get('username', '')}",
                        lambda l=lid: bridge.engage_instagram_follow(l),
                    )
        finally:
            await bridge.close()

    async def _job_weekly_report(self) -> None:
        await self._run_task("weekly_report", self._run_weekly_report_job)

    async def _job_monthly_analysis(self) -> None:
        await self._run_task("monthly_analysis", self._run_monthly_analysis_job)
