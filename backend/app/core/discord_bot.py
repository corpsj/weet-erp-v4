"""Discord bot for WEET Director — proposals, reports, alerts."""

import httpx
import json
from typing import Optional
from datetime import datetime, timezone
from app.core.config import Settings

settings = Settings()


class DiscordBot:
    """Webhook-based Discord bot for sending marketing notifications."""

    EMOJI_APPROVE = "✅"
    EMOJI_EDIT = "✏️"
    EMOJI_REJECT = "❌"

    def __init__(self):
        self.webhook_url = settings.discord.webhook_url
        self.channel_id = settings.discord.channel_id

    def send_message(self, content: str, embeds: Optional[list] = None) -> bool:
        """Send a plain message or embed to Discord webhook."""
        payload = {"content": content}
        if embeds:
            payload["embeds"] = embeds
        return self._post(payload)

    def send_proposal(self, proposal: dict) -> bool:
        """Send a marketing proposal with approval reaction buttons as embed."""
        urgency_color = {
            "critical": 0xFF0000,  # red
            "high": 0xFF8C00,  # orange
            "medium": 0xFFD700,  # gold
            "low": 0x00FF7F,  # green
        }.get(proposal.get("urgency", "medium"), 0xFFD700)

        embed = {
            "title": f"🎯 제안: {proposal.get('title', '마케팅 제안')}",
            "color": urgency_color,
            "fields": [
                {
                    "name": "📊 발견 신호",
                    "value": proposal.get("signal", "없음"),
                    "inline": False,
                },
                {
                    "name": "💡 제안 액션",
                    "value": proposal.get("action", "없음"),
                    "inline": False,
                },
                {
                    "name": "⏰ 긴급도",
                    "value": proposal.get("urgency", "medium"),
                    "inline": True,
                },
                {
                    "name": "📈 예상 임팩트",
                    "value": proposal.get("impact", "미정"),
                    "inline": True,
                },
            ],
            "footer": {
                "text": f"✅ 승인 | ✏️ 수정 | ❌ 거부  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC"
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if proposal.get("content_draft"):
            embed["fields"].append(
                {
                    "name": "📝 콘텐츠 초안",
                    "value": proposal["content_draft"][:1000],  # Discord limit
                    "inline": False,
                }
            )

        return self._post({"embeds": [embed]})

    def send_daily_report(self, metrics: dict) -> bool:
        """Send daily marketing metrics report."""
        embed = {
            "title": "📊 위트 마케팅 일일 리포트",
            "color": 0x4169E1,
            "fields": [
                {
                    "name": "👥 수집 리드",
                    "value": str(metrics.get("leads_collected", 0)),
                    "inline": True,
                },
                {
                    "name": "💡 생성 제안",
                    "value": str(metrics.get("proposals_made", 0)),
                    "inline": True,
                },
                {
                    "name": "✅ 승인 제안",
                    "value": str(metrics.get("proposals_approved", 0)),
                    "inline": True,
                },
                {
                    "name": "📢 발행 콘텐츠",
                    "value": str(metrics.get("contents_published", 0)),
                    "inline": True,
                },
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return self._post({"content": "📅 **오늘의 마케팅 현황**", "embeds": [embed]})

    def send_weekly_report(self, metrics: dict) -> bool:
        """Send weekly marketing summary report."""
        embed = {
            "title": "📈 위트 마케팅 주간 리포트",
            "color": 0x9932CC,
            "description": f"총 리드: {metrics.get('total_leads', 0)} | 총 제안: {metrics.get('total_proposals', 0)} | 발행: {metrics.get('total_published', 0)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return self._post({"content": "📊 **주간 마케팅 리포트**", "embeds": [embed]})

    def send_alert(self, alert_type: str, message: str) -> bool:
        """Send an urgent alert to Discord."""
        prefix = {
            "hot_lead": "🔥",
            "error": "⚠️",
            "market_change": "📢",
            "urgent": "🚨",
        }.get(alert_type, "📣")
        return self.send_message(f"{prefix} **{alert_type.upper()}**: {message}")

    def send_test(self) -> bool:
        """Send a test message to verify webhook connection."""
        return self.send_message("🤖 WEET Director: 연결 테스트 성공!")

    def send_consultation_alert(self, lead_context: str) -> bool:
        return self.send_alert("hot_lead", lead_context)

    def _post(self, payload: dict) -> bool:
        """POST payload to Discord webhook. Returns True on success."""
        if (
            not self.webhook_url
            or self.webhook_url == "https://discord.com/api/webhooks/placeholder"
        ):
            # Silently skip in test/dev mode
            return True
        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                return response.status_code in (200, 204)
        except Exception:
            return False
