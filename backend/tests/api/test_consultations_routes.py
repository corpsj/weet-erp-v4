from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.api.main import app

client = TestClient(app)


def test_list_consultations_empty() -> None:
    mock_svc = MagicMock()
    mock_svc.list_consultations.return_value = []

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.get("/api/consultations")

    assert response.status_code == 200
    assert response.json() == []


def test_create_consultation_success() -> None:
    mock_svc = MagicMock()
    mock_svc.create_consultation.return_value = "cons-uuid"

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.post(
            "/api/consultations",
            json={
                "lead_id": "lead-1",
                "request_channel": "dm_response",
                "persona_type": "lifestyle",
                "notes": "문의",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"id": "cons-uuid", "status": "requested"}


def test_create_consultation_failure() -> None:
    mock_svc = MagicMock()
    mock_svc.create_consultation.return_value = None

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.post(
            "/api/consultations",
            json={"lead_id": "lead-1", "request_channel": "dm_response"},
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to create consultation"


def test_get_consultation_found() -> None:
    mock_svc = MagicMock()
    mock_svc.get_consultation.return_value = {"id": "cons-1", "status": "requested"}

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.get("/api/consultations/cons-1")

    assert response.status_code == 200
    assert response.json()["id"] == "cons-1"


def test_get_consultation_not_found() -> None:
    mock_svc = MagicMock()
    mock_svc.get_consultation.return_value = None

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.get("/api/consultations/missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Consultation not found"


def test_update_consultation_success() -> None:
    mock_svc = MagicMock()
    mock_svc.update_consultation_status.return_value = True

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.patch(
            "/api/consultations/cons-1",
            json={"status": "scheduled", "notes": "예약 완료"},
        )

    assert response.status_code == 200
    assert response.json() == {"id": "cons-1", "status": "scheduled"}


def test_update_consultation_invalid_status() -> None:
    mock_svc = MagicMock()
    mock_svc.update_consultation_status.return_value = False

    with patch(
        "app.api.routes.consultations.ConsultationService", return_value=mock_svc
    ):
        response = client.patch(
            "/api/consultations/cons-1",
            json={"status": "invalid-status"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid status or not found"
