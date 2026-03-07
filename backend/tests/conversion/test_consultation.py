import pytest
from unittest.mock import MagicMock, patch

from app.conversion.consultation import (
    ConsultationService,
    DEFAULT_DM_TEMPLATE,
    PERSONA_DM_TEMPLATES,
    VALID_CHANNELS,
    VALID_STATUSES,
)


@pytest.fixture
def service() -> ConsultationService:
    with patch(
        "app.conversion.consultation.NotificationService", return_value=MagicMock()
    ):
        return ConsultationService()


def test_create_consultation_success(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "test-uuid"}]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.create_consultation(
            lead_id="lead-1",
            request_channel="dm_response",
        )

    assert result == "test-uuid"


def test_create_consultation_invalid_channel_defaults(
    service: ConsultationService,
) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "test-uuid"}]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        _ = service.create_consultation(lead_id="lead-1", request_channel="invalid")

    payload = mock_sb.table.return_value.insert.call_args[0][0]
    assert payload["request_channel"] == "dm_response"


def test_update_consultation_status_scheduled(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "cons-1"}]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.update_consultation_status("cons-1", "scheduled")

    assert result is True
    payload = mock_sb.table.return_value.update.call_args[0][0]
    assert payload["status"] == "scheduled"
    assert "scheduled_at" in payload


def test_update_consultation_status_completed(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "cons-1"}]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.update_consultation_status("cons-1", "completed")

    assert result is True
    payload = mock_sb.table.return_value.update.call_args[0][0]
    assert payload["status"] == "completed"
    assert "completed_at" in payload


def test_update_consultation_status_invalid(service: ConsultationService) -> None:
    result = service.update_consultation_status("cons-1", "not-valid")

    assert result is False


def test_list_consultations_with_status_filter(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    expected = [{"id": "c-1", "status": "requested"}]

    query = mock_sb.table.return_value.select.return_value.order.return_value.limit.return_value
    query.eq.return_value.execute.return_value = MagicMock(data=expected)

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.list_consultations(status="requested", limit=5)

    assert result == expected
    query.eq.assert_called_once_with("status", "requested")


def test_list_consultations_no_filter(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    expected = [{"id": "c-2", "status": "scheduled"}]

    query = mock_sb.table.return_value.select.return_value.order.return_value.limit.return_value
    query.execute.return_value = MagicMock(data=expected)

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.list_consultations(limit=10)

    assert result == expected
    query.eq.assert_not_called()


def test_get_consultation_found(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    row = {"id": "cons-1", "status": "requested"}
    chain = mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value
    chain.execute.return_value = MagicMock(data=[row])

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.get_consultation("cons-1")

    assert result == row


def test_get_consultation_not_found(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    chain = mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value
    chain.execute.return_value = MagicMock(data=[])

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.get_consultation("cons-1")

    assert result is None


def test_get_persona_dm_price_sensitive(service: ConsultationService) -> None:
    message = service.get_persona_dm("alice", "price_sensitive")
    assert message == PERSONA_DM_TEMPLATES["price_sensitive"].format(username="alice")


def test_get_persona_dm_lifestyle(service: ConsultationService) -> None:
    message = service.get_persona_dm("alice", "lifestyle")
    assert message == PERSONA_DM_TEMPLATES["lifestyle"].format(username="alice")


def test_get_persona_dm_practical(service: ConsultationService) -> None:
    message = service.get_persona_dm("alice", "practical")
    assert message == PERSONA_DM_TEMPLATES["practical"].format(username="alice")


def test_get_persona_dm_design(service: ConsultationService) -> None:
    message = service.get_persona_dm("alice", "design")
    assert message == PERSONA_DM_TEMPLATES["design"].format(username="alice")


def test_get_persona_dm_unknown_persona(service: ConsultationService) -> None:
    message = service.get_persona_dm("alice", "unknown_persona")
    assert message == DEFAULT_DM_TEMPLATE.format(username="alice")


def test_send_conversion_discord_alert(service: ConsultationService) -> None:
    mock_discord = MagicMock()
    with patch(
        "app.conversion.consultation.NotificationService", return_value=mock_discord
    ):
        service = ConsultationService()

    lead = {
        "username": "hotlead",
        "score": 35,
        "persona_type": "lifestyle",
        "journey_stage": "decide",
        "metadata": {
            "encounters": 4,
            "sources": ["instagram", "naver"],
            "by_competitor": {"comp-a": {"count": 2}},
        },
    }

    service.send_conversion_discord_alert(lead, "cons-uuid")

    mock_discord.send_alert.assert_called_once()
    alert_type, message = mock_discord.send_alert.call_args[0]
    assert alert_type == "hot_lead"
    assert "@hotlead" in message
    assert "cons-uuid" in message


def test_create_consultation_returns_none_on_empty_data(
    service: ConsultationService,
) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.create_consultation(
            lead_id="lead-1",
            request_channel="dm_response",
        )

    assert result is None


def test_update_consultation_status_with_notes(service: ConsultationService) -> None:
    mock_sb = MagicMock()
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "cons-1"}]
    )

    with patch("app.conversion.consultation.get_supabase", return_value=mock_sb):
        result = service.update_consultation_status(
            "cons-1", "scheduled", notes="내일 오후 2시 방문 예정"
        )

    assert result is True
    payload = mock_sb.table.return_value.update.call_args[0][0]
    assert payload["notes"] == "내일 오후 2시 방문 예정"
    assert payload["status"] == "scheduled"


def test_constants_expose_expected_values() -> None:
    assert "scheduled" in VALID_STATUSES
    assert "dm_response" in VALID_CHANNELS
