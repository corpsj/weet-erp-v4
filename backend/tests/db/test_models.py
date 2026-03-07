"""TDD tests for WEET Director database models."""

import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Base,
    Lead,
    Proposal,
    Content,
    MarketSignal,
    LeadAction,
    DailyMetric,
    Setting,
)


# Test database setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def test_session(test_engine):
    """Create test database session."""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest.mark.asyncio
async def test_lead_crud(test_session):
    """Test Lead CRUD operations."""
    # Create
    lead = Lead(
        platform="instagram",
        username="test_user",
        score=10,
        persona_type="lifestyle",
        journey_stage="awareness",
        source="hashtag_user",
    )
    test_session.add(lead)
    await test_session.commit()
    await test_session.refresh(lead)

    assert lead.id is not None
    assert lead.username == "test_user"
    assert lead.score == 10

    # Read
    from sqlalchemy import select

    stmt = select(Lead).where(Lead.username == "test_user")
    result = await test_session.execute(stmt)
    fetched_lead = result.scalar_one()
    assert fetched_lead.username == "test_user"

    # Update
    fetched_lead.score = 25
    await test_session.commit()
    await test_session.refresh(fetched_lead)
    assert fetched_lead.score == 25

    # Verify timestamps
    assert fetched_lead.created_at is not None
    assert fetched_lead.updated_at is not None


@pytest.mark.asyncio
async def test_proposal_lifecycle(test_session):
    """Test Proposal lifecycle from pending to approved."""
    # Create pending proposal
    proposal = Proposal(
        title="Test Proposal",
        action_type="content",
        content_draft="Draft content here",
        status="pending",
    )
    test_session.add(proposal)
    await test_session.commit()
    await test_session.refresh(proposal)

    assert proposal.id is not None
    assert proposal.status == "pending"
    assert proposal.approved_at is None

    # Approve proposal
    from datetime import datetime

    proposal.status = "approved"
    proposal.approved_at = datetime.utcnow()
    await test_session.commit()
    await test_session.refresh(proposal)

    assert proposal.status == "approved"
    assert proposal.approved_at is not None

    # Verify rejection_reason is null for approved
    assert proposal.rejection_reason is None


@pytest.mark.asyncio
async def test_market_signal_creation(test_session):
    """Test MarketSignal creation and field validation."""
    signal = MarketSignal(
        source="naver_news",
        signal_type="trend",
        title="Market Trend Alert",
        summary="Summary of the market signal",
        urgency="high",
        sentiment="positive",
        keywords=["keyword1", "keyword2"],
        url="https://example.com/signal",
    )
    test_session.add(signal)
    await test_session.commit()
    await test_session.refresh(signal)

    assert signal.id is not None
    assert signal.source == "naver_news"
    assert signal.urgency == "high"
    assert signal.sentiment == "positive"
    assert len(signal.keywords) == 2
    assert signal.collected_at is not None


@pytest.mark.asyncio
async def test_daily_metric(test_session):
    """Test DailyMetric creation and unique date constraint."""
    # Create first metric
    metric1 = DailyMetric(
        date="2024-03-06",
        leads_collected=5,
        proposals_made=2,
        proposals_approved=1,
        contents_published=1,
    )
    test_session.add(metric1)
    await test_session.commit()
    await test_session.refresh(metric1)

    assert metric1.id is not None
    assert metric1.date == "2024-03-06"
    assert metric1.leads_collected == 5

    # Try to create duplicate date - should fail
    metric2 = DailyMetric(
        date="2024-03-06",
        leads_collected=3,
    )
    test_session.add(metric2)

    with pytest.raises(IntegrityError):
        await test_session.commit()


@pytest.mark.asyncio
async def test_lead_with_actions(test_session):
    """Test Lead with LeadAction relationship."""
    # Create lead
    lead = Lead(
        platform="youtube",
        username="content_creator",
        score=15,
    )
    test_session.add(lead)
    await test_session.commit()
    await test_session.refresh(lead)

    # Create actions
    action1 = LeadAction(
        lead_id=lead.id,
        action_type="like",
        details={"video_id": "abc123"},
    )
    action2 = LeadAction(
        lead_id=lead.id,
        action_type="comment",
        details={"comment": "Great content!"},
    )
    test_session.add(action1)
    test_session.add(action2)
    await test_session.commit()

    # Verify relationship
    from sqlalchemy import select

    stmt = select(Lead).where(Lead.id == lead.id)
    result = await test_session.execute(stmt)
    fetched_lead = result.scalar_one()

    # Load actions relationship
    await test_session.refresh(fetched_lead, ["actions"])
    assert len(fetched_lead.actions) == 2
    assert fetched_lead.actions[0].action_type in ["like", "comment"]


@pytest.mark.asyncio
async def test_content_model(test_session):
    """Test Content model creation."""
    content = Content(
        channel="instagram",
        title="Test Post",
        body="This is test content",
        status="draft",
        engagement_metrics={"likes": 0, "comments": 0},
        persona_target="lifestyle",
    )
    test_session.add(content)
    await test_session.commit()
    await test_session.refresh(content)

    assert content.id is not None
    assert content.channel == "instagram"
    assert content.status == "draft"
    assert content.published_at is None
    assert content.created_at is not None


@pytest.mark.asyncio
async def test_setting_model(test_session):
    """Test Setting model for key-value storage."""
    setting = Setting(
        key="api_key",
        value="secret_value_123",
    )
    test_session.add(setting)
    await test_session.commit()
    await test_session.refresh(setting)

    assert setting.key == "api_key"
    assert setting.value == "secret_value_123"
    assert setting.updated_at is not None

    # Update setting
    setting.value = "new_secret_value"
    await test_session.commit()
    await test_session.refresh(setting)
    assert setting.value == "new_secret_value"
