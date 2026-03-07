"""TDD tests for all WEET Director API routes.

Uses a MockSupabase client to simulate Supabase REST API without
network calls. Routes call get_supabase() which returns this mock.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from httpx import ASGITransport, AsyncClient

from app.api.main import app


# ── Mock Supabase Client ────────────────────────────────────────────


class MockQueryBuilder:
    """Simulates Supabase table query builder chain."""

    def __init__(self, table_name: str, store: dict):
        self._table = table_name
        self._store = store
        self._rows = list(store.get(table_name, []))
        self._count_mode = None
        self._insert_data = None
        self._update_data = None
        self._upsert_data = None

    def select(self, *args, count=None):
        self._count_mode = count
        return self

    def insert(self, data):
        self._insert_data = data
        return self

    def update(self, data):
        self._update_data = data
        return self

    def upsert(self, data, **kwargs):
        self._upsert_data = data
        return self

    def eq(self, field, value):
        self._rows = [r for r in self._rows if r.get(field) == value]
        return self

    def neq(self, field, value):
        self._rows = [r for r in self._rows if r.get(field) != value]
        return self

    def gte(self, field, value):
        return self

    def in_(self, field, values):
        self._rows = [r for r in self._rows if r.get(field) in values]
        return self

    def order(self, field, desc=False):
        reverse = desc
        self._rows.sort(key=lambda r: r.get(field, ""), reverse=reverse)
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def single(self):
        return self

    def execute(self):
        result = MagicMock()

        if self._insert_data is not None:
            data = self._insert_data
            if isinstance(data, dict):
                data = [data]
            table_rows = self._store.setdefault(self._table, [])
            for row in data:
                row_copy = dict(row)
                row_copy.setdefault("id", len(table_rows) + 1)
                row_copy.setdefault(
                    "created_at", datetime.now(timezone.utc).isoformat()
                )
                table_rows.append(row_copy)
            result.data = data
            result.count = len(data)
            return result

        if self._update_data is not None:
            for row in self._rows:
                row.update(self._update_data)
            result.data = self._rows
            result.count = len(self._rows)
            return result

        if self._upsert_data is not None:
            table_rows = self._store.setdefault(self._table, [])
            data = self._upsert_data
            if isinstance(data, dict):
                data = [data]
            for row in data:
                row_copy = dict(row)
                row_copy.setdefault("id", len(table_rows) + 1)
                table_rows.append(row_copy)
            result.data = data
            result.count = len(data)
            return result

        result.data = self._rows
        result.count = len(self._rows) if self._count_mode else None
        return result


class MockSupabase:
    """In-memory Supabase mock for route tests."""

    def __init__(self):
        self._store: dict[str, list[dict]] = {}

    def table(self, name: str) -> MockQueryBuilder:
        return MockQueryBuilder(name, self._store)

    def seed(self, table: str, rows: list[dict]) -> None:
        """Seed a table with initial data."""
        self._store[table] = [dict(r) for r in rows]


# ── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def mock_sb():
    """Create fresh in-memory mock Supabase."""
    return MockSupabase()


@pytest.fixture
async def client(mock_sb):
    """Create test HTTP client with mocked Supabase.

    Patches get_supabase in every route module that imports it,
    because Python caches the reference at import time.
    """
    with (
        patch("app.db.session.get_supabase", return_value=mock_sb),
        patch("app.api.routes.dashboard.get_supabase", return_value=mock_sb),
        patch("app.api.routes.leads.get_supabase", return_value=mock_sb),
        patch("app.api.routes.proposals.get_supabase", return_value=mock_sb),
        patch("app.api.routes.content.get_supabase", return_value=mock_sb),
        patch("app.api.routes.signals.get_supabase", return_value=mock_sb),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c


# ── Dashboard ────────────────────────────────────────────────────────


async def test_dashboard_overview_empty_db(client):
    """GET /api/dashboard/overview on empty DB returns zeros."""
    resp = await client.get("/api/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_leads"] == 0
    assert data["pending_proposals"] == 0
    assert data["published_content"] == 0
    assert "channel_stats" in data


async def test_dashboard_metrics(client):
    """GET /api/dashboard/metrics returns period."""
    resp = await client.get("/api/dashboard/metrics?period=daily")
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "daily"
    assert isinstance(data["data"], list)


# ── Leads ────────────────────────────────────────────────────────────


async def test_leads_list_empty(client):
    """GET /api/leads on empty DB returns empty list."""
    resp = await client.get("/api/leads")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_leads_detail_not_found(client):
    """GET /api/leads/999 returns 404."""
    resp = await client.get("/api/leads/999")
    assert resp.status_code == 404


async def test_leads_detail_found(client, mock_sb):
    """GET /api/leads/{id} returns lead after seeding."""
    mock_sb.seed(
        "marketing_leads",
        [
            {
                "id": "1",
                "platform": "instagram",
                "username": "testuser",
                "score": 80,
                "journey_stage": "awareness",
            }
        ],
    )
    resp = await client.get("/api/leads/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["score"] == 80


async def test_leads_patch(client, mock_sb):
    """PATCH /api/leads/{id} updates stage and score."""
    mock_sb.seed(
        "marketing_leads",
        [
            {
                "id": "1",
                "platform": "naver_cafe",
                "username": "patchme",
                "score": 10,
                "journey_stage": "awareness",
            }
        ],
    )
    resp = await client.patch(
        "/api/leads/1",
        json={"journey_stage": "consideration", "score": 50},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["journey_stage"] == "consideration"
    assert data["score"] == 50


# ── Proposals ────────────────────────────────────────────────────────


async def test_proposals_list(client):
    """GET /api/proposals on empty DB returns empty list."""
    resp = await client.get("/api/proposals")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_proposals_approve(client, mock_sb):
    """POST /api/proposals/{id}/approve sets status=approved."""
    mock_sb.seed(
        "marketing_proposals",
        [{"id": "1", "title": "Test Proposal", "status": "pending"}],
    )
    resp = await client.post("/api/proposals/1/approve")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"


async def test_proposals_reject(client, mock_sb):
    """POST /api/proposals/{id}/reject sets status=rejected with reason."""
    mock_sb.seed(
        "marketing_proposals",
        [{"id": "1", "title": "Reject Me", "status": "pending"}],
    )
    resp = await client.post(
        "/api/proposals/1/reject",
        json={"reason": "Not relevant"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data.get("rejection_reason") == "Not relevant"


async def test_proposals_modify(client, mock_sb):
    """POST /api/proposals/{id}/modify updates content_draft."""
    mock_sb.seed(
        "marketing_proposals",
        [
            {
                "id": "1",
                "title": "Modify Me",
                "content_draft": "old draft",
                "status": "pending",
            }
        ],
    )
    resp = await client.post(
        "/api/proposals/1/modify",
        json={"content_draft": "new draft"},
    )
    assert resp.status_code == 200
    assert resp.json()["content_draft"] == "new draft"


# ── Content ──────────────────────────────────────────────────────────


async def test_content_list(client):
    """GET /api/content on empty DB returns empty list."""
    resp = await client.get("/api/content")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_content_publish(client, mock_sb):
    """POST /api/content/{id}/publish sets status=published."""
    mock_sb.seed(
        "marketing_contents",
        [{"id": "1", "channel": "blog", "body": "Hello world", "status": "draft"}],
    )
    resp = await client.post("/api/content/1/publish")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "published"


# ── Signals ──────────────────────────────────────────────────────────


async def test_signals_list(client):
    """GET /api/signals on empty DB returns empty list."""
    resp = await client.get("/api/signals")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_signals_trends(client, mock_sb):
    """GET /api/signals/trends returns keyword frequency."""
    mock_sb.seed(
        "marketing_signals",
        [
            {
                "id": 1,
                "source": "naver_news",
                "title": "Test",
                "urgency": "low",
                "keywords": ["이동식주택", "모듈러"],
            }
        ],
    )
    resp = await client.get("/api/signals/trends")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["trends"], list)


# ── System ───────────────────────────────────────────────────────────


async def test_system_status(client):
    """GET /api/system/status returns system status."""
    resp = await client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "scheduler" in data
    assert data["scheduler"] == "running"


async def test_system_radar_run(client):
    """POST /api/system/radar/run triggers radar scan."""
    resp = await client.post("/api/system/radar/run")
    assert resp.status_code == 200
    assert resp.json()["status"] == "triggered"


async def test_system_suggestions_generate(client):
    """POST /api/system/suggestions/generate triggers generation."""
    resp = await client.post("/api/system/suggestions/generate")
    assert resp.status_code == 200
    assert resp.json()["status"] == "triggered"
