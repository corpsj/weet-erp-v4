from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.core.notification_service import NotificationService
from app.core.llm import LLMService
from app.core.prompts import SUGGESTION_PROMPT
from app.db.session import get_supabase

ACTION_TYPES = ["content", "outreach", "strategy", "urgent", "calendar"]


@dataclass
class ProposalData:
    title: str
    action_type: str
    rationale: str
    content_draft: str = ""
    urgency: str = "medium"
    expected_impact: str = ""
    signal_id: Optional[int] = None


class SuggestionEngine:
    def __init__(self):
        self.llm = LLMService()
        self.notifier = NotificationService()

    async def generate_suggestions(
        self,
        max_proposals: int = 3,
        prior_insights: dict[str, Any] | None = None,
    ) -> list[ProposalData]:
        signals = await self._get_recent_signals(limit=10)
        lead_count = await self._get_lead_count()
        metrics = await self._get_recent_metrics()

        if not signals and lead_count == 0:
            return [
                ProposalData(
                    title="시장 모니터링 시작 — 리드 수집 전략 수립",
                    action_type="strategy",
                    rationale="현재 시장 데이터가 부족합니다. 키워드 스캔을 시작하고 초기 콘텐츠를 생성하세요.",
                    urgency="medium",
                    expected_impact="브랜드 노출 시작",
                )
            ]

        signals_text = "\n".join(
            [f"- [{s['source']}] {s['title']}: {s['summary']}" for s in signals[:5]]
        )
        insights_text = ""
        if prior_insights and prior_insights.get("insights"):
            insights_text = "\n과거 학습: " + "; ".join(
                str(insight) for insight in prior_insights["insights"]
            )

        prompt = (
            SUGGESTION_PROMPT.format(
                signals=signals_text or "수집된 신호 없음",
                lead_count=lead_count,
                metrics=str(metrics),
            )
            + insights_text
        )

        try:
            result = self.llm.analyze(prompt, "marketing proposal generation")
            if isinstance(result, list):
                proposals = result[:max_proposals]
            elif isinstance(result, dict):
                proposals = [result]
            else:
                proposals = []
        except Exception:
            proposals = []

        output: list[ProposalData] = []
        seen_titles: set[str] = set()

        for item in proposals:
            if not isinstance(item, dict):
                continue

            title = item.get("title", "마케팅 제안")
            if title in seen_titles:
                continue

            seen_titles.add(title)
            action_type = item.get("action_type", "content")
            if action_type not in ACTION_TYPES:
                action_type = "content"

            output.append(
                ProposalData(
                    title=title,
                    action_type=action_type,
                    rationale=item.get("rationale", ""),
                    content_draft=item.get("content_draft", ""),
                    urgency=item.get("urgency", "medium"),
                    expected_impact=item.get("expected_impact", ""),
                )
            )

        if not output:
            output.append(
                ProposalData(
                    title="콘텐츠 마케팅 강화 제안",
                    action_type="content",
                    rationale="이동식주택 관련 콘텐츠 생성으로 SEO와 브랜드 인지도를 높이세요.",
                    urgency="medium",
                    expected_impact="월 방문자 +20%",
                )
            )

        return output[:max_proposals]

    async def propose(self, proposal: ProposalData) -> Optional[int]:
        if await self._is_duplicate(proposal.title):
            return None

        proposal_id = await self._save_proposal(proposal)
        self.notifier.send_proposal(
            {
                "title": proposal.title,
                "signal": proposal.rationale,
                "action": proposal.action_type,
                "urgency": proposal.urgency,
                "impact": proposal.expected_impact,
                "content_draft": proposal.content_draft,
            }
        )
        return proposal_id

    async def handle_response(
        self,
        proposal_id: int,
        action: str,
        feedback: Optional[str] = None,
    ) -> bool:
        sb = get_supabase()
        proposal_result = (
            sb.table("marketing_proposals")
            .select("id,title")
            .eq("id", proposal_id)
            .limit(1)
            .execute()
        )
        proposal_rows = proposal_result.data or []
        if not proposal_rows:
            return False

        proposal_title = str(proposal_rows[0].get("title", ""))
        update_payload: dict[str, Any] = {}

        if action == "approved":
            update_payload = {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
            }
            self.notifier.send_message(f"✅ 제안 승인됨: {proposal_title}")
        elif action == "rejected":
            update_payload = {"status": "rejected"}
            if feedback:
                update_payload["rejection_reason"] = feedback
            suffix = f" (사유: {feedback})" if feedback else ""
            self.notifier.send_message(f"❌ 제안 거부됨: {proposal_title}{suffix}")
        elif action == "modified":
            update_payload = {"status": "pending"}
            self.notifier.send_message(f"✏️ 제안 수정 요청: {proposal_title}")

        if not update_payload:
            return True

        sb.table("marketing_proposals").update(update_payload).eq(
            "id", proposal_id
        ).execute()
        return True

    async def learn_from_results(self) -> dict[str, Any]:
        sb = get_supabase()
        result = sb.table("marketing_proposals").select("status,action_type").execute()
        all_proposals = result.data or []

        total = len(all_proposals)
        if total == 0:
            return {"total": 0, "approval_rate": 0.0, "insights": []}

        approved = sum(
            1 for proposal in all_proposals if proposal.get("status") == "approved"
        )
        rejected = sum(
            1 for proposal in all_proposals if proposal.get("status") == "rejected"
        )
        approval_rate = approved / total if total > 0 else 0.0

        rejected_types: dict[str, int] = {}
        for proposal in all_proposals:
            if proposal.get("status") == "rejected":
                action_key = str(proposal.get("action_type") or "unknown")
                rejected_types[action_key] = rejected_types.get(action_key, 0) + 1

        insights: list[str] = []
        if rejected_types:
            worst_type = max(rejected_types, key=lambda key: rejected_types[key])
            insights.append(
                f"'{worst_type}' 유형 제안이 가장 많이 거부됨 ({rejected_types[worst_type]}건)"
            )
        if approval_rate < 0.5:
            insights.append("승인율이 50% 미만 — 제안 품질 개선 필요")

        try:
            content_result = (
                sb.table("marketing_settings")
                .select("value")
                .eq("key", "content_performance_insights")
                .limit(1)
                .execute()
            )
            perf_rows = content_result.data or []
            if perf_rows:
                perf = perf_rows[0].get("value") or {}
                top_topics = perf.get("top_topics") or []
                top_channels = perf.get("top_channels") or []
                if top_topics:
                    best_topic = top_topics[0]
                    insights.append(
                        f"최고 성과 콘텐츠 주제: '{best_topic['name']}' (평균 참여도: {best_topic['avg_score']}, {best_topic['count']}건)"
                    )
                if top_channels:
                    best_ch = top_channels[0]
                    insights.append(
                        f"최고 성과 채널: '{best_ch['name']}' (평균 참여도: {best_ch['avg_score']})"
                    )
        except Exception:
            pass

        return {
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "approval_rate": round(approval_rate, 2),
            "insights": insights,
        }

    async def _get_recent_signals(self, limit: int = 10) -> list[dict[str, Any]]:
        try:
            sb = get_supabase()
            result = (
                sb.table("marketing_signals")
                .select("source,title,summary")
                .order("collected_at", desc=True)
                .limit(limit)
                .execute()
            )
            signals = result.data or []
            return [
                {
                    "source": signal.get("source", ""),
                    "title": signal.get("title", ""),
                    "summary": signal.get("summary", ""),
                }
                for signal in signals
            ]
        except Exception:
            return []

    async def _get_lead_count(self) -> int:
        try:
            sb = get_supabase()
            result = sb.table("marketing_leads").select("id", count="exact").execute()
            return int(result.count or 0)
        except Exception:
            return 0

    async def _get_recent_metrics(self) -> dict[str, int]:
        try:
            sb = get_supabase()
            result = (
                sb.table("marketing_daily_metrics")
                .select("leads_collected,proposals_made")
                .order("date", desc=True)
                .limit(7)
                .execute()
            )
            metrics = result.data or []
            if not metrics:
                return {}
            return {
                "avg_leads": sum(
                    int(metric.get("leads_collected") or 0) for metric in metrics
                )
                // len(metrics),
                "avg_proposals": sum(
                    int(metric.get("proposals_made") or 0) for metric in metrics
                )
                // len(metrics),
            }
        except Exception:
            return {}

    async def _is_duplicate(self, title: str) -> bool:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            sb = get_supabase()
            result = (
                sb.table("marketing_proposals")
                .select("id")
                .eq("title", title)
                .gte("created_at", cutoff.isoformat())
                .limit(1)
                .execute()
            )
            existing = result.data or []
            return len(existing) > 0
        except Exception:
            return False

    async def _save_proposal(self, proposal: ProposalData) -> int:
        sb = get_supabase()
        result = (
            sb.table("marketing_proposals")
            .insert(
                {
                    "title": proposal.title,
                    "action_type": proposal.action_type,
                    "content_draft": proposal.content_draft or proposal.rationale,
                    "status": "pending",
                    "signal_id": proposal.signal_id,
                }
            )
            .execute()
        )
        if result.data:
            return int(result.data[0].get("id", 0) or 0)
        return 0
