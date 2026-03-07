"""TDD tests for all WEET Director API routes."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.main import app
from app.db.models import Base, Content, Lead, MarketSignal, Proposal
from app.db.session import get_session

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_session():
    """Create in-memory SQLite session for testing."""
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(test_session):
    """Create test HTTP client with overridden DB session."""

    async def _override():
        yield test_session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


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


async def test_leads_detail_found(client, test_session):
    """GET /api/leads/{id} returns lead after creation."""
    lead = Lead(platform="instagram", username="testuser", score=80)
    test_session.add(lead)
    await test_session.commit()
    await test_session.refresh(lead)

    resp = await client.get(f"/api/leads/{lead.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["score"] == 80


async def test_leads_patch(client, test_session):
    """PATCH /api/leads/{id} updates stage and score."""
    lead = Lead(
        platform="naver_cafe", username="patchme", score=10, journey_stage="awareness"
    )
    test_session.add(lead)
    await test_session.commit()
    await test_session.refresh(lead)

    resp = await client.patch(
        f"/api/leads/{lead.id}",
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


async def test_proposals_approve(client, test_session):
    """POST /api/proposals/{id}/approve sets status=approved."""
    proposal = Proposal(title="Test Proposal", status="pending")
    test_session.add(proposal)
    await test_session.commit()
    await test_session.refresh(proposal)

    resp = await client.post(f"/api/proposals/{proposal.id}/approve")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["approved_at"] is not None


async def test_proposals_reject(client, test_session):
    """POST /api/proposals/{id}/reject sets status=rejected with reason."""
    proposal = Proposal(title="Reject Me", status="pending")
    test_session.add(proposal)
    await test_session.commit()
    await test_session.refresh(proposal)

    resp = await client.post(
        f"/api/proposals/{proposal.id}/reject",
        json={"reason": "Not relevant"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == "Not relevant"


async def test_proposals_modify(client, test_session):
    """POST /api/proposals/{id}/modify updates content_draft."""
    proposal = Proposal(title="Modify Me", content_draft="old draft", status="pending")
    test_session.add(proposal)
    await test_session.commit()
    await test_session.refresh(proposal)

    resp = await client.post(
        f"/api/proposals/{proposal.id}/modify",
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


async def test_content_publish(client, test_session):
    """POST /api/content/{id}/publish sets status=published."""
    item = Content(channel="blog", body="Hello world", status="draft")
    test_session.add(item)
    await test_session.commit()
    await test_session.refresh(item)

    resp = await client.post(f"/api/content/{item.id}/publish")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "published"
    assert data["published_at"] is not None


# ── Signals ──────────────────────────────────────────────────────────


async def test_signals_list(client):
    """GET /api/signals on empty DB returns empty list."""
    resp = await client.get("/api/signals")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_signals_trends(client, test_session):
    """GET /api/signals/trends returns keyword frequency."""
    sig = MarketSignal(
        source="naver_news",
        title="Test",
        urgency="low",
        keywords=["이동식주택", "모듈러"],
    )
    test_session.add(sig)
    await test_session.commit()

    resp = await client.get("/api/signals/trends")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["trends"], list)
    assert len(data["trends"]) == 2


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
