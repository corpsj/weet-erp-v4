from datetime import datetime
from typing import cast
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from app.core.notification_service import NotificationService


def _make_mock_supabase() -> MagicMock:
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "notif-uuid"}]
    )
    return mock_sb


def _get_insert_payload(mock_sb: MagicMock) -> dict[str, object]:
    return mock_sb.table.return_value.insert.call_args[0][0]


def test_send_message_inserts_report_message() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_message("테스트 메시지")

    assert result is True
    mock_sb.table.assert_called_once_with("marketing_notifications")
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "report"
    assert payload["type"] == "message"
    assert payload["severity"] == 3
    assert payload["title"] == "테스트 메시지"
    assert payload["body"] == "테스트 메시지"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None


def test_send_proposal_inserts_expected_payload() -> None:
    mock_sb = _make_mock_supabase()

    proposal = {
        "title": "귀촌 보조금 기사 급증",
        "signal": "네이버 뉴스 3건",
        "action": "블로그 글 작성",
        "urgency": "high",
        "impact": "리드 발굴 +20%",
        "content_draft": "초안 내용",
    }

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_proposal(proposal)

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "proposal"
    assert payload["type"] == "proposal.submitted"
    assert payload["severity"] == 2
    assert payload["title"] == "귀촌 보조금 기사 급증"
    assert payload["body"] == "초안 내용"
    assert payload["action_path"] == "/marketing/proposals"
    assert payload["dedupe_key"] is None


def test_send_daily_report_inserts_expected_payload() -> None:
    mock_sb = _make_mock_supabase()
    now = datetime.now(ZoneInfo("Asia/Seoul"))

    metrics = {
        "leads_collected": 5,
        "proposals_made": 2,
        "proposals_approved": 1,
        "contents_published": 1,
    }

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_daily_report(metrics)

    assert result is True
    payload = _get_insert_payload(mock_sb)
    title = cast(str, payload["title"])
    body = cast(str, payload["body"])
    assert payload["category"] == "report"
    assert payload["type"] == "report.daily"
    assert payload["severity"] == 3
    assert title.startswith("일일 마케팅 리포트 (")
    assert "리드 5건" in body
    assert payload["action_path"] == "/marketing"
    assert payload["dedupe_key"] == f"daily_report_{now.strftime('%Y-%m-%d')}"


def test_send_weekly_report_inserts_expected_payload() -> None:
    mock_sb = _make_mock_supabase()
    now = datetime.now(ZoneInfo("Asia/Seoul"))

    metrics = {
        "total_leads": 12,
        "total_proposals": 6,
        "total_published": 4,
    }

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_weekly_report(metrics)

    assert result is True
    payload = _get_insert_payload(mock_sb)
    title = cast(str, payload["title"])
    body = cast(str, payload["body"])
    assert payload["category"] == "report"
    assert payload["type"] == "report.weekly"
    assert payload["severity"] == 3
    assert title.startswith("주간 마케팅 리포트 (")
    assert "총 리드: 12" in body
    assert payload["action_path"] == "/marketing"
    assert payload["dedupe_key"] == f"weekly_report_{now.strftime('%Y-%W')}"


def test_send_alert_hot_lead_category_and_severity() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_alert("hot_lead", "핫리드 발생")

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "lead"
    assert payload["type"] == "alert.hot_lead"
    assert payload["severity"] == 2
    assert payload["title"] == "HOT_LEAD: 핫리드 발생"
    assert payload["body"] == "핫리드 발생"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None


def test_send_alert_error_category_and_severity() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_alert("error", "에러 발생")

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "error"
    assert payload["type"] == "alert.error"
    assert payload["severity"] == 2
    assert payload["title"] == "ERROR: 에러 발생"
    assert payload["body"] == "에러 발생"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None


def test_send_alert_market_change_category_and_severity() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_alert("market_change", "시장 변화")

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "market"
    assert payload["type"] == "alert.market_change"
    assert payload["severity"] == 3
    assert payload["title"] == "MARKET_CHANGE: 시장 변화"
    assert payload["body"] == "시장 변화"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None


def test_send_alert_urgent_category_and_severity() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_alert("urgent", "긴급 대응")

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "market"
    assert payload["type"] == "alert.urgent"
    assert payload["severity"] == 1
    assert payload["title"] == "URGENT: 긴급 대응"
    assert payload["body"] == "긴급 대응"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None


def test_send_consultation_alert_inserts_hot_lead_alert() -> None:
    mock_sb = _make_mock_supabase()

    with patch("app.core.notification_service.get_supabase", return_value=mock_sb):
        svc = NotificationService()
        result = svc.send_consultation_alert("@hotlead (score: 35)")

    assert result is True
    payload = _get_insert_payload(mock_sb)
    assert payload["category"] == "lead"
    assert payload["type"] == "alert.hot_lead"
    assert payload["severity"] == 2
    assert payload["title"] == "HOT_LEAD: @hotlead (score: 35)"
    assert payload["body"] == "@hotlead (score: 35)"
    assert payload["action_path"] is None
    assert payload["dedupe_key"] is None
