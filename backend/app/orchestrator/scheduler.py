import logging
import asyncio
import random
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from importlib import import_module
from typing import TYPE_CHECKING, Any, TypeVar
from zoneinfo import ZoneInfo

from app.clients.error_classifier import SUCCESS, classify_response, get_retry_strategy
from app.clients.openclaw import OpenClawBridge
from app.core.config import Settings
from app.db.session import get_supabase

AsyncIOScheduler = import_module("apscheduler.schedulers.asyncio").AsyncIOScheduler
CronTrigger = import_module("apscheduler.triggers.cron").CronTrigger

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.orchestrator.runner import TaskRunner


T = TypeVar("T")


class WeetScheduler:
    CONTENT_PUBLISH_CHANNELS: tuple[str, ...] = (
        "naver-cafe",
        "instagram",
        "naver-blog",
        "youtube",
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
        self._job_failure_counts: dict[str, int] = {}

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
            self._job_dm_monitor,
            IntervalTrigger(minutes=15),
            id="dm_monitor",
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
            self._job_content_feedback,
            CronTrigger(hour=23, minute=0, timezone="Asia/Seoul"),
            id="content_feedback",
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

        async def _operation() -> None:
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

        await self._retry_with_backoff("suggestion_run", _operation)

    async def _run_daily_report_job(self) -> None:
        from app.core.notification_service import NotificationService

        async def _operation() -> None:
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
            bot = NotificationService()
            bot.send_daily_report(metrics)
            logger.info("Daily report sent")

        await self._retry_with_backoff("daily_report", _operation)

    async def _run_journey_check_job(self) -> None:
        async def _operation() -> None:
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
                            svc.send_conversion_alert(lead, consultation_id)
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

            logger.info(
                "Journey check: %d leads updated out of %d", updated, len(leads)
            )

        await self._retry_with_backoff("journey_check", _operation)

    async def _run_content_generate_job(self) -> None:
        from app.content.generator import ContentGenerator
        from collections import Counter

        async def _operation() -> None:
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

            perf_insights: dict[str, Any] = {}
            try:
                perf_result = (
                    sb.table("marketing_settings")
                    .select("value")
                    .eq("key", "content_performance_insights")
                    .limit(1)
                    .execute()
                )
                perf_rows = perf_result.data or []
                if perf_rows:
                    perf_insights = perf_rows[0].get("value") or {}
                    top_personas_perf = perf_insights.get("top_personas") or []
                    if top_personas_perf:
                        best_persona = top_personas_perf[0].get("name")
                        if best_persona and best_persona != "unknown":
                            best_score = top_personas_perf[0].get("avg_score", 0)
                            best_count = top_personas_perf[0].get("count", 0)
                            if best_score > 0 and best_count >= 2:
                                top_persona = best_persona
                                logger.info(
                                    "Persona adjusted by feedback: %s (avg_score=%.1f)",
                                    best_persona,
                                    best_score,
                                )
            except Exception:
                pass

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

            top_channels_perf = perf_insights.get("top_channels") or []
            if top_channels_perf:
                channel_scores: dict[str, float] = {
                    str(entry.get("name") or ""): float(entry.get("avg_score") or 0)
                    for entry in top_channels_perf
                }
                channels_config.sort(
                    key=lambda item: channel_scores.get(item[0], 0), reverse=True
                )

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
                            logger.warning(
                                "Image generation failed for %s: %s", topic, exc
                            )

                    content_insert_result = (
                        sb.table("marketing_contents")
                        .insert(
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
                        )
                        .execute()
                    )
                    content_data = content_insert_result.data or []
                    content_id = content_data[0].get("id") if content_data else None

                    if content_id is not None:
                        sb.table("marketing_proposals").insert(
                            {
                                "title": f"[{channel}] {title}",
                                "action_type": "content",
                                "content_draft": body[:500],
                                "status": "pending",
                                "metadata": {
                                    "content_id": content_id,
                                    "channel": channel,
                                    "topic": topic,
                                },
                            }
                        ).execute()
                    saved += 1
                    logger.info("Content generated for %s: %s", channel, title)
                except Exception as exc:
                    logger.warning("Content generation failed for %s: %s", channel, exc)

            self._record_daily_metric("proposals_made", saved)

        await self._retry_with_backoff("content_generate", _operation)

    async def _run_content_engagement_job(self) -> None:
        sb = get_supabase()
        cutoff = (datetime.now(self._kst) - timedelta(hours=72)).isoformat()
        result = (
            sb.table("marketing_contents")
            .select("id,channel,title,body,published_at,metadata")
            .eq("status", "published")
            .gte("published_at", cutoff)
            .execute()
        )
        contents = result.data or []
        processed = 0
        failed = 0
        for content in contents:
            cid = content.get("id")
            meta = content.get("metadata") or {}
            if meta.get("engagement_collected"):
                continue

            engagement_metrics: dict[str, Any] = {
                "collected_at": datetime.now(self._kst).isoformat(),
                "status": "collected",
            }

            if content.get("channel") == "instagram":
                try:
                    media_id = self._resolve_instagram_media_id(content)
                    if not media_id:
                        raise ValueError("instagram media_id could not be resolved")

                    metrics = self._fetch_instagram_metrics(media_id)
                    likes = self._as_int(metrics.get("likes"), default=0)
                    comments = self._as_int(metrics.get("comments"), default=0)

                    engagement_metrics = {
                        "likes": likes,
                        "comments": comments,
                        "collected_at": datetime.now(self._kst).isoformat(),
                        "status": "collected",
                        "media_id": media_id,
                    }

                    interacted_usernames = metrics.get("interacted_usernames") or []
                    if isinstance(interacted_usernames, list):
                        self._update_lead_journey_from_content_interactions(
                            sb, interacted_usernames
                        )
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "Instagram engagement collection failed for content %s: %s",
                        cid,
                        exc,
                    )
                    engagement_metrics = {
                        "collected_at": datetime.now(self._kst).isoformat(),
                        "status": "collection_failed",
                        "error": str(exc),
                    }
            else:
                engagement_metrics = {
                    "likes": 0,
                    "comments": 0,
                    "collected_at": datetime.now(self._kst).isoformat(),
                    "status": "collected",
                }

            sb.table("marketing_contents").update(
                {
                    "engagement_metrics": engagement_metrics,
                    "metadata": {**meta, "engagement_collected": True},
                }
            ).eq("id", cid).execute()
            processed += 1

        logger.info(
            "Content engagement check: %d contents processed (%d failed)",
            processed,
            failed,
        )

    async def _run_content_feedback_job(self) -> None:
        """Analyze content engagement and store performance insights for future generation."""
        sb = get_supabase()

        cutoff = (datetime.now(self._kst) - timedelta(days=30)).isoformat()
        result = (
            sb.table("marketing_contents")
            .select(
                "id,channel,title,status,engagement_metrics,metadata,persona_target,published_at"
            )
            .eq("status", "published")
            .gte("published_at", cutoff)
            .execute()
        )
        contents = result.data or []

        if not contents:
            logger.info("Content feedback: no published content to analyze")
            return

        topic_performance: dict[str, dict[str, Any]] = {}
        persona_performance: dict[str, dict[str, Any]] = {}
        channel_performance: dict[str, dict[str, Any]] = {}

        for content in contents:
            metrics = content.get("engagement_metrics") or {}
            if metrics.get("status") != "collected":
                continue

            likes = self._as_int(metrics.get("likes"), default=0)
            comments = self._as_int(metrics.get("comments"), default=0)
            engagement_score = likes + comments * 2

            meta = content.get("metadata") or {}
            topic = meta.get("topic", "unknown")
            persona = content.get("persona_target") or meta.get(
                "persona_target", "unknown"
            )
            channel = content.get("channel", "unknown")
            keywords = meta.get("keywords") or []

            if topic not in topic_performance:
                topic_performance[topic] = {
                    "total_score": 0,
                    "count": 0,
                    "keywords": [],
                }
            topic_performance[topic]["total_score"] += engagement_score
            topic_performance[topic]["count"] += 1
            if isinstance(keywords, list):
                topic_performance[topic]["keywords"].extend(keywords)

            if persona not in persona_performance:
                persona_performance[persona] = {"total_score": 0, "count": 0}
            persona_performance[persona]["total_score"] += engagement_score
            persona_performance[persona]["count"] += 1

            if channel not in channel_performance:
                channel_performance[channel] = {"total_score": 0, "count": 0}
            channel_performance[channel]["total_score"] += engagement_score
            channel_performance[channel]["count"] += 1

        def _ranked(perf: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
            ranked = []
            for key, val in perf.items():
                count = int(val.get("count") or 0)
                if count == 0:
                    continue
                avg = float(val.get("total_score") or 0) / count
                entry: dict[str, Any] = {
                    "name": key,
                    "avg_score": round(avg, 2),
                    "count": count,
                }
                if "keywords" in val:
                    entry["keywords"] = list(set(val["keywords"]))[:10]
                ranked.append(entry)
            ranked.sort(key=lambda x: float(x.get("avg_score") or 0), reverse=True)
            return ranked

        analyzed_count = len(
            [
                c
                for c in contents
                if (c.get("engagement_metrics") or {}).get("status") == "collected"
            ]
        )
        if analyzed_count == 0:
            logger.info("Content feedback: no collected engagement metrics to analyze")
            return

        insights = {
            "analyzed_at": datetime.now(self._kst).isoformat(),
            "total_content_analyzed": analyzed_count,
            "top_topics": _ranked(topic_performance)[:5],
            "top_personas": _ranked(persona_performance)[:4],
            "top_channels": _ranked(channel_performance)[:6],
        }

        sb.table("marketing_settings").upsert(
            {"key": "content_performance_insights", "value": insights}
        ).execute()

        top_topics = insights.get("top_topics")
        top_topic = (
            str(top_topics[0].get("name", "none"))
            if isinstance(top_topics, list) and top_topics
            else "none"
        )
        logger.info(
            "Content feedback analysis: %d contents analyzed, top topic=%s",
            insights["total_content_analyzed"],
            top_topic,
        )

    def _resolve_instagram_media_id(self, content: dict[str, Any]) -> str | None:
        metadata = content.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        media_id = metadata.get("media_id")
        if media_id:
            return str(media_id)

        shortcode = metadata.get("shortcode")
        if shortcode:
            try:
                from app.clients.instagram_client import InstagrapiClient
                from app.core.config import Settings

                ig = Settings().instagram
                if not ig.username or not ig.password:
                    return None

                wrapper = InstagrapiClient(
                    username=ig.username,
                    password=ig.password,
                    session_dir=ig.session_dir,
                )
                if not wrapper.login():
                    return None
                try:
                    client = wrapper.get_client()
                    if client is None:
                        return None
                    return str(client.media_pk_from_code(str(shortcode)))
                finally:
                    wrapper.logout()
            except Exception:
                return None

        try:
            from app.clients.instagram_client import InstagrapiClient
            from app.core.config import Settings

            ig = Settings().instagram
            if not ig.username or not ig.password:
                return None

            wrapper = InstagrapiClient(
                username=ig.username,
                password=ig.password,
                session_dir=ig.session_dir,
            )
            if not wrapper.login():
                return None

            try:
                client = wrapper.get_client()
                if client is None:
                    return None

                account_id = client.user_id_from_username(ig.username)
                recent_medias = client.user_medias(account_id, amount=10)
                if not recent_medias:
                    return None

                published_at_raw = content.get("published_at")
                published_at: datetime | None = None
                if isinstance(published_at_raw, str):
                    normalized = published_at_raw.replace("Z", "+00:00")
                    try:
                        published_at = datetime.fromisoformat(normalized)
                    except ValueError:
                        published_at = None

                if published_at is None:
                    return str(getattr(recent_medias[0], "pk", "")) or None

                best_match = None
                best_delta: float | None = None
                for media in recent_medias:
                    taken_at = getattr(media, "taken_at", None)
                    if not isinstance(taken_at, datetime):
                        continue
                    try:
                        delta = abs((taken_at - published_at).total_seconds())
                    except TypeError:
                        continue
                    if best_delta is None or delta < best_delta:
                        best_delta = delta
                        best_match = media

                if best_match is None:
                    return str(getattr(recent_medias[0], "pk", "")) or None
                return str(getattr(best_match, "pk", "")) or None
            finally:
                wrapper.logout()
        except Exception:
            return None

    def _fetch_instagram_metrics(self, media_id: str) -> dict[str, Any]:
        from app.clients.instagram_client import InstagrapiClient
        from app.core.config import Settings

        ig = Settings().instagram
        if not ig.username or not ig.password:
            raise RuntimeError("Instagram credentials are not configured")

        wrapper = InstagrapiClient(
            username=ig.username,
            password=ig.password,
            session_dir=ig.session_dir,
        )
        if not wrapper.login():
            raise RuntimeError("Instagram login failed for engagement collection")

        try:
            client = wrapper.get_client()
            if client is None:
                raise RuntimeError("Instagram client is not available")

            media_info = client.media_info(media_id)
            likes = self._as_int(getattr(media_info, "like_count", 0), default=0)
            comments = self._as_int(getattr(media_info, "comment_count", 0), default=0)

            interacted_usernames: set[str] = set()
            try:
                likers = client.media_likers(media_id)
                for liker in likers:
                    username = getattr(liker, "username", None)
                    if isinstance(username, str) and username:
                        interacted_usernames.add(username)
            except Exception as exc:
                logger.warning(
                    "Failed to fetch Instagram likers for media %s: %s", media_id, exc
                )

            try:
                comments_data = client.media_comments(media_id)
                for comment in comments_data:
                    user = getattr(comment, "user", None)
                    username = getattr(user, "username", None)
                    if isinstance(username, str) and username:
                        interacted_usernames.add(username)
            except Exception as exc:
                logger.warning(
                    "Failed to fetch Instagram commenters for media %s: %s",
                    media_id,
                    exc,
                )

            return {
                "likes": likes,
                "comments": comments,
                "interacted_usernames": sorted(interacted_usernames),
            }
        finally:
            wrapper.logout()

    def _update_lead_journey_from_content_interactions(
        self, sb: Any, usernames: list[str]
    ) -> None:
        stage_order = {
            "awareness": "interest",
            "interest": "explore",
            "explore": "compare",
            "compare": "hesitate",
            "hesitate": "decide",
        }

        for username in {u for u in usernames if isinstance(u, str) and u}:
            try:
                row = (
                    sb.table("marketing_leads")
                    .select("id,journey_stage,metadata")
                    .eq("platform", "instagram")
                    .eq("username", username)
                    .limit(1)
                    .execute()
                )
                if not row.data:
                    continue

                lead = row.data[0]
                lead_id = lead.get("id")
                if lead_id is None:
                    continue
                current_stage = str(lead.get("journey_stage") or "awareness")
                new_stage = stage_order.get(current_stage, current_stage)

                metadata = lead.get("metadata") or {}
                if not isinstance(metadata, dict):
                    metadata = {}
                engagement_count = self._as_int(
                    metadata.get("content_engagement_count"), default=0
                )

                payload: dict[str, Any] = {
                    "metadata": {
                        **metadata,
                        "latest_event": "content_engagement",
                        "content_engagement_count": engagement_count + 1,
                        "last_content_engagement_at": datetime.now(
                            self._kst
                        ).isoformat(),
                    }
                }
                if new_stage != current_stage:
                    payload["journey_stage"] = new_stage

                sb.table("marketing_leads").update(payload).eq("id", lead_id).execute()
            except Exception as exc:
                logger.warning(
                    "Failed to update lead journey after content interaction @%s: %s",
                    username,
                    exc,
                )

    def _pick_content_topic(self, sb) -> tuple[str, list[str]]:
        """Pick a topic from recent signals boosted by engagement performance; fall back to evergreen."""
        from collections import Counter

        try:
            perf_result = (
                sb.table("marketing_settings")
                .select("value")
                .eq("key", "content_performance_insights")
                .limit(1)
                .execute()
            )
            perf_rows = perf_result.data or []
            perf_insights = perf_rows[0].get("value") if perf_rows else None
        except Exception:
            perf_insights = None

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

            if perf_insights and isinstance(perf_insights, dict):
                top_topics = perf_insights.get("top_topics") or []
                for top in top_topics:
                    topic_name = top.get("name", "")
                    topic_keywords = top.get("keywords") or []
                    avg_score = top.get("avg_score", 0)
                    if avg_score > 0:
                        boost = max(1, int(avg_score / 5))
                        if topic_name in kw_counter:
                            kw_counter[topic_name] += boost
                        for kw in topic_keywords:
                            if kw in kw_counter:
                                kw_counter[kw] += boost
            if kw_counter:
                top_keywords = [kw for kw, _ in kw_counter.most_common(5)]
                topic = top_keywords[0]
                return topic, top_keywords[:3]

        if perf_insights and isinstance(perf_insights, dict):
            top_topics = perf_insights.get("top_topics") or []
            if top_topics:
                best = top_topics[0]
                topic_name = best.get("name", "")
                topic_kws = best.get("keywords") or []
                if topic_name:
                    return topic_name, (topic_kws[:3] if topic_kws else [topic_name])

        evergreen = [
            ("이동식주택 실거주 후기", ["이동식주택", "전원생활", "모듈러주택"]),
            ("모듈러주택 비용 비교", ["모듈러주택", "건축비용", "이동식주택"]),
            ("귀촌 준비 체크리스트", ["귀촌", "전원주택", "세컨하우스"]),
            ("농막 vs 이동식주택 차이", ["농막", "이동식주택", "컨테이너하우스"]),
            ("소형주택 트렌드", ["소형주택", "미니멀하우스", "1인가구"]),
        ]
        return random.choice(evergreen)

    async def _run_weekly_report_job(self) -> None:
        from app.core.notification_service import NotificationService

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
        bot = NotificationService()
        bot.send_weekly_report(
            {
                "total_leads": total_leads,
                "total_proposals": total_proposals,
                "total_published": total_published,
            }
        )
        logger.info("Weekly report sent")

    async def _run_monthly_analysis_job(self) -> None:
        from app.core.notification_service import NotificationService

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
        bot = NotificationService()
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
                if error_type != SUCCESS:
                    logger.error(
                        "[%s:%s] Failed after %d attempts: %s (error_type=%s)",
                        job_name,
                        operation_name,
                        attempt + 1,
                        content,
                        error_type,
                    )
                return result

            base_backoff = max(self._as_int(retry_strategy.get("backoff", 0)), 5)
            backoff = min(base_backoff * (2**attempt), 3600)
            logger.warning(
                "[%s] %s retry attempt=%d error_type=%s backoff=%.2fs",
                job_name,
                operation_name,
                attempt + 1,
                error_type,
                float(backoff),
            )
            if backoff > 0:
                await asyncio.sleep(backoff)
            attempt += 1

        return {"success": False, "content": "retry attempts exhausted"}

    async def _retry_with_backoff(
        self,
        operation_name: str,
        fn: Callable[[], Awaitable[T]],
        max_retries: int = 3,
        base_backoff: float = 5.0,
        max_backoff: float = 300.0,
    ) -> T:
        retries = max(0, max_retries)
        for attempt in range(retries + 1):
            try:
                result = await fn()
                self._job_failure_counts.pop(operation_name, None)
                return result
            except Exception as exc:
                error_type = classify_response(False, str(exc))
                if attempt >= retries:
                    logger.error(
                        "[%s] Failed after %d attempts: %s (error_type=%s)",
                        operation_name,
                        attempt + 1,
                        str(exc),
                        error_type,
                    )
                    self._notify_job_failure(
                        operation_name, exc, attempt + 1, error_type
                    )
                    raise

                clamped_base = max(base_backoff, 5.0)
                backoff = min(clamped_base * (2**attempt), max_backoff)
                jittered_backoff = backoff * (0.5 + random.random() * 0.5)
                logger.warning(
                    "[%s] Retry attempt %d/%d (error_type=%s, backoff=%.2fs): %s",
                    operation_name,
                    attempt + 1,
                    retries + 1,
                    error_type,
                    jittered_backoff,
                    exc,
                )
                await asyncio.sleep(jittered_backoff)

        raise RuntimeError(f"{operation_name} retry attempts exhausted")

    def _notify_job_failure(
        self, task_name: str, exc: Exception, attempts: int, error_type: str
    ) -> None:
        from app.core.notification_service import NotificationService

        fail_count = self._job_failure_counts.get(task_name, 0) + 1
        self._job_failure_counts[task_name] = fail_count

        notifier = NotificationService()
        notifier.send_alert(
            "error",
            f"{task_name} failed after {attempts} attempts ({error_type}): {str(exc)[:200]}",
        )

        if fail_count >= 3:
            notifier._insert(
                category="error",
                type_="alert.scheduler_job_failure",
                severity=1,
                title=f"스케줄러 작업 실패: {task_name}",
                body=f"{task_name} failed {fail_count} consecutive times. last_error={str(exc)[:500]}",
                metadata={
                    "task_name": task_name,
                    "consecutive_failures": fail_count,
                    "attempts": attempts,
                    "error_type": error_type,
                },
            )

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

    def _read_dm_monitor_state(self) -> dict[str, Any]:
        sb = get_supabase()
        result = (
            sb.table("marketing_settings")
            .select("value")
            .eq("key", "dm_monitor_last_processed")
            .limit(1)
            .execute()
        )
        if result.data and isinstance(result.data[0].get("value"), dict):
            return dict(result.data[0]["value"])
        return {}

    def _write_dm_monitor_state(self, state: dict[str, Any]) -> None:
        sb = get_supabase()
        sb.table("marketing_settings").upsert(
            {
                "key": "dm_monitor_last_processed",
                "value": state,
            },
            on_conflict="key",
        ).execute()

    def _get_or_create_instagram_lead(
        self, username: str, context: dict[str, Any]
    ) -> str | None:
        sb = get_supabase()
        existing = (
            sb.table("marketing_leads")
            .select("id,metadata")
            .eq("platform", "instagram")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if existing.data:
            lead = existing.data[0]
            lead_id = str(lead.get("id") or "")
            if not lead_id:
                return None
            metadata = (
                lead.get("metadata") if isinstance(lead.get("metadata"), dict) else {}
            )
            sources = metadata.get("sources") if isinstance(metadata, dict) else []
            if not isinstance(sources, list):
                sources = []
            if "dm_inbound" not in sources:
                sources.append("dm_inbound")
            merged = {
                **metadata,
                "sources": sources,
                "last_dm_keyword_at": datetime.now(self._kst).isoformat(),
                "last_dm_keyword": context.get("keyword_matched"),
                "last_dm_message": context.get("message"),
                "last_dm_thread_id": context.get("thread_id"),
            }
            sb.table("marketing_leads").update({"metadata": merged}).eq(
                "id", lead_id
            ).execute()
            return lead_id

        payload = {
            "platform": "instagram",
            "username": username,
            "source": "dm_inbound",
            "score": 30,
            "status": "contacted",
            "journey_stage": "interest",
            "metadata": {
                "encounters": 1,
                "sources": ["dm_inbound"],
                "first_dm_keyword_at": datetime.now(self._kst).isoformat(),
                "first_dm_keyword": context.get("keyword_matched"),
                "first_dm_message": context.get("message"),
                "first_dm_thread_id": context.get("thread_id"),
            },
        }
        created = sb.table("marketing_leads").insert(payload).execute()
        if not created.data:
            return None
        return str(created.data[0].get("id") or "") or None

    async def _run_dm_monitor_job(self) -> None:
        from app.channels.dm_monitor import DMMonitor, DMMonitorRateLimitError
        from app.conversion.consultation import ConsultationService
        from app.core.notification_service import NotificationService

        if self.dry_run:
            logger.info("DRY-RUN: would run DM monitor")
            return

        state = self._read_dm_monitor_state()
        cooldown_until_raw = state.get("cooldown_until")
        if isinstance(cooldown_until_raw, str):
            try:
                cooldown_until = datetime.fromisoformat(cooldown_until_raw)
                if datetime.now(self._kst) < cooldown_until:
                    logger.info(
                        "Skipping dm_monitor due to cooldown until %s", cooldown_until
                    )
                    return
            except ValueError:
                pass

        monitor = DMMonitor()
        try:
            matched_dms = await monitor.check_new_dms()
        except DMMonitorRateLimitError as exc:
            fallback_cooldown = datetime.now(self._kst) + timedelta(minutes=30)
            cooldown_until = exc.cooldown_until or fallback_cooldown
            state["cooldown_until"] = cooldown_until.isoformat()
            state["last_checked_at"] = datetime.now(self._kst).isoformat()
            self._write_dm_monitor_state(state)
            logger.warning(
                "DM monitor rate-limited; cooldown set until %s", cooldown_until
            )
            return
        except Exception as exc:
            logger.warning("DM monitor failed: %s", exc)
            return

        processed_ids_raw = state.get("processed_message_ids", [])
        processed_ids = (
            {str(mid) for mid in processed_ids_raw if isinstance(mid, (str, int))}
            if isinstance(processed_ids_raw, list)
            else set()
        )

        consultation_service = ConsultationService()
        notifier = NotificationService()
        created_count = 0

        for dm in matched_dms:
            message_id = str(dm.get("message_id") or "")
            dedupe_key = message_id or f"{dm.get('thread_id')}:{dm.get('message')}"
            if dedupe_key in processed_ids:
                continue

            username = str(dm.get("username") or "")
            if not username:
                continue
            lead_id = self._get_or_create_instagram_lead(username, dm)
            if not lead_id:
                continue

            consultation_id = consultation_service.create_consultation(
                lead_id=lead_id,
                request_channel="dm_response",
                notes=f"Inbound DM keyword: {dm.get('keyword_matched', '')}",
                metadata={
                    "trigger": "dm_keyword",
                    "platform": "instagram",
                    "username": username,
                    "keyword": dm.get("keyword_matched"),
                    "message": dm.get("message"),
                    "thread_id": dm.get("thread_id"),
                    "message_id": message_id,
                },
            )
            if not consultation_id:
                continue

            notifier.send_alert(
                "hot_lead",
                (
                    f"📩 Instagram 상담 DM 감지: @{username} | "
                    f"키워드: {dm.get('keyword_matched', '')} | "
                    f"상담 ID: {consultation_id}"
                ),
            )
            processed_ids.add(dedupe_key)
            created_count += 1

        state["processed_message_ids"] = list(processed_ids)[-500:]
        state["last_checked_at"] = datetime.now(self._kst).isoformat()
        state["cooldown_until"] = None
        self._write_dm_monitor_state(state)
        if created_count > 0:
            self._record_daily_metric("consultations_requested", created_count)
        logger.info(
            "DM monitor processed %d matched DMs, created %d consultations",
            len(matched_dms),
            created_count,
        )

    async def _run_content_publish_job(self) -> None:
        if self.dry_run:
            logger.info("DRY-RUN: would call OpenClaw for content_publish")
            return

        sb = get_supabase()
        approved_result = (
            sb.table("marketing_contents")
            .select("id,channel,title,body,metadata")
            .eq("status", "approved")
            .order("created_at")
            .limit(50)
            .execute()
        )
        approved_contents = approved_result.data or []
        if not approved_contents:
            logger.info("No approved content to publish")
            return

        success_count = 0
        publishable_count = 0
        bridge = OpenClawBridge()
        try:
            for content in approved_contents:
                content_id = str(content.get("id") or "")
                channel = str(content.get("channel") or "")
                caption = str(content.get("body") or "")
                metadata = content.get("metadata") or {}
                metadata = metadata if isinstance(metadata, dict) else {}
                media_path = str(metadata.get("media_path") or "")
                if not content_id or not channel:
                    continue
                publishable_count += 1

                if channel == "instagram":
                    format_type = "feed"
                    format_type = str(metadata.get("format_type", "feed"))

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
                    sb.table("marketing_contents").update(
                        {
                            "status": "published",
                            "published_at": datetime.now(self._kst).isoformat(),
                        }
                    ).eq("id", content_id).execute()
                else:
                    logger.error(
                        "[content_publish] OpenClaw publish failed channel=%s content=%s",
                        channel,
                        result.get("content", ""),
                    )
            self._record_daily_metric("contents_published", success_count)
            if success_count != publishable_count:
                raise RuntimeError(
                    "content_publish failed for one or more approved contents via OpenClaw"
                )
        finally:
            await bridge.close()

    async def _run_lead_hunt_job(self) -> None:
        if self.dry_run:
            logger.info("DRY-RUN: would run lead hunt")
            return

        from app.channels.instagram import InstagramChannel
        from app.channels.naver_cafe import NaverCafeChannel
        from app.channels.youtube import YouTubeChannel as YouTubeLeadChannel

        settings = Settings()
        instagram_channel = InstagramChannel()
        naver_channel = NaverCafeChannel()
        bridge = OpenClawBridge()
        try:
            commenters_raw = await instagram_channel.get_competitor_commenters()
            likers_raw = await instagram_channel.get_competitor_likers()
            hashtag_users_raw = await instagram_channel.get_hashtag_users()
            naver_leads = await naver_channel.collect_leads()

            if settings.youtube.api_key and settings.youtube.api_key not in (
                "",
                "your_youtube_api_key_here",
            ):
                youtube_channel = YouTubeLeadChannel()
                youtube_leads = await youtube_channel.collect_leads()
            else:
                logger.info(
                    "YouTube API key not configured, skipping YouTube lead hunt"
                )
                youtube_leads = []

            commenters = commenters_raw if isinstance(commenters_raw, list) else []
            likers = likers_raw if isinstance(likers_raw, list) else []
            hashtag_users = (
                hashtag_users_raw if isinstance(hashtag_users_raw, list) else []
            )
            naver_leads = naver_leads if isinstance(naver_leads, list) else []
            youtube_leads = youtube_leads if isinstance(youtube_leads, list) else []
            total_leads = (
                commenters + likers + hashtag_users + naver_leads + youtube_leads
            )

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

    async def _job_content_feedback(self) -> None:
        await self._run_task("content_feedback", self._run_content_feedback_job)

    async def _job_dm_monitor(self) -> None:
        if not self._can_run_instagram_action():
            logger.info("Skipping dm_monitor outside Instagram hours")
            return
        await self._run_task("dm_monitor", self._run_dm_monitor_job)

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
            .select("id,title,action_type,content_draft,status,metadata")
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
            proposal_meta = proposal.get("metadata") or {}
            proposal_meta = proposal_meta if isinstance(proposal_meta, dict) else {}

            try:
                if action == "content":
                    await self._execute_content_proposal(sb, gen, proposal)
                    content_id = proposal_meta.get("content_id")
                    if content_id is not None:
                        sb.table("marketing_contents").update(
                            {"status": "approved"}
                        ).eq("id", content_id).eq("status", "draft").execute()
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
        proposal_meta = proposal.get("metadata") or {}
        proposal_meta = proposal_meta if isinstance(proposal_meta, dict) else {}

        if proposal_meta.get("content_id") is not None:
            return

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
