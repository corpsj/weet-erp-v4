import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.db.session import get_supabase

logger = logging.getLogger(__name__)

SEVERITY_URGENT = 1
SEVERITY_HIGH = 2
SEVERITY_NORMAL = 3
SEVERITY_LOW = 4

ALERT_SEVERITY = {
    "hot_lead": SEVERITY_HIGH,
    "error": SEVERITY_HIGH,
    "market_change": SEVERITY_NORMAL,
    "urgent": SEVERITY_URGENT,
}

ALERT_CATEGORY = {
    "hot_lead": "lead",
    "error": "error",
    "market_change": "market",
    "urgent": "market",
}

_kst = ZoneInfo("Asia/Seoul")


class NotificationService:
    def _insert(
        self,
        *,
        category: str,
        type_: str,
        title: str,
        body: str | None = None,
        severity: int = SEVERITY_NORMAL,
        action_path: str | None = None,
        dedupe_key: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        sb = get_supabase()
        result = (
            sb.table("marketing_notifications")
            .insert(
                {
                    "category": category,
                    "type": type_,
                    "severity": severity,
                    "title": title,
                    "body": body,
                    "action_path": action_path,
                    "dedupe_key": dedupe_key,
                    "metadata": metadata or {},
                }
            )
            .execute()
        )
        if result.data:
            return str(result.data[0].get("id", ""))
        return None

    def send_message(self, content: str, embeds: list[Any] | None = None) -> bool:
        _ = embeds
        self._insert(
            category="report",
            type_="message",
            title=content[:200],
            body=content,
        )
        return True

    def send_proposal(self, proposal: dict[str, Any]) -> bool:
        title = proposal.get("title", "마케팅 제안")
        urgency = proposal.get("urgency", "medium")
        severity_map = {
            "critical": SEVERITY_URGENT,
            "high": SEVERITY_HIGH,
            "medium": SEVERITY_NORMAL,
            "low": SEVERITY_LOW,
        }
        self._insert(
            category="proposal",
            type_="proposal.submitted",
            severity=severity_map.get(urgency, SEVERITY_NORMAL),
            title=title,
            body=proposal.get("content_draft"),
            action_path="/marketing/proposals",
            metadata={
                "signal": proposal.get("signal"),
                "action": proposal.get("action"),
                "urgency": urgency,
                "impact": proposal.get("impact"),
            },
        )
        return True

    def send_daily_report(self, metrics: dict[str, Any]) -> bool:
        now = datetime.now(_kst)
        self._insert(
            category="report",
            type_="report.daily",
            title=f"일일 마케팅 리포트 ({now.strftime('%m/%d')})",
            body=(
                f"리드 {metrics.get('leads_collected', 0)}건 | "
                f"제안 {metrics.get('proposals_made', 0)}건 | "
                f"승인 {metrics.get('proposals_approved', 0)}건 | "
                f"발행 {metrics.get('contents_published', 0)}건"
            ),
            action_path="/marketing",
            dedupe_key=f"daily_report_{now.strftime('%Y-%m-%d')}",
            metadata=metrics,
        )
        return True

    def send_weekly_report(self, metrics: dict[str, Any]) -> bool:
        now = datetime.now(_kst)
        self._insert(
            category="report",
            type_="report.weekly",
            title=f"주간 마케팅 리포트 ({now.strftime('%m/%d')})",
            body=(
                f"총 리드: {metrics.get('total_leads', 0)} | "
                f"총 제안: {metrics.get('total_proposals', 0)} | "
                f"발행: {metrics.get('total_published', 0)}"
            ),
            action_path="/marketing",
            dedupe_key=f"weekly_report_{now.strftime('%Y-%W')}",
            metadata=metrics,
        )
        return True

    def send_alert(self, alert_type: str, message: str) -> bool:
        category = ALERT_CATEGORY.get(alert_type, "error")
        severity = ALERT_SEVERITY.get(alert_type, SEVERITY_NORMAL)
        self._insert(
            category=category,
            type_=f"alert.{alert_type}",
            severity=severity,
            title=f"{alert_type.upper()}: {message[:200]}",
            body=message,
        )
        return True

    def send_consultation_alert(self, lead_context: str) -> bool:
        return self.send_alert("hot_lead", lead_context)

    def send_test(self) -> bool:
        return self.send_message("WEET Director: 연결 테스트 성공!")
