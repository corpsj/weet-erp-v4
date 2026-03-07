"""SQLAlchemy 2.0 async models for WEET Director."""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    Boolean,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class Lead(Base):
    """Lead model for tracking potential customers."""

    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)
    platform = Column(String(50), nullable=False)  # instagram, naver_cafe, youtube
    username = Column(String(200), nullable=False)
    score = Column(Integer, default=0)
    persona_type = Column(String(50))  # price_sensitive, lifestyle, practical, design
    journey_stage = Column(String(50), default="awareness")
    source = Column(String(100))  # competitor_comment, hashtag_user, etc.
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    actions = relationship(
        "LeadAction", back_populates="lead", cascade="all, delete-orphan"
    )


class Proposal(Base):
    """Proposal model for tracking action proposals."""

    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True)
    signal_id = Column(Integer, ForeignKey("market_signals.id"), nullable=True)
    title = Column(String(500), nullable=False)
    action_type = Column(String(50))  # content, outreach, strategy, urgent, calendar
    content_draft = Column(Text)
    status = Column(
        String(50), default="pending"
    )  # pending, approved, rejected, executed
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Content(Base):
    """Content model for tracking published content."""

    __tablename__ = "contents"

    id = Column(Integer, primary_key=True)
    channel = Column(
        String(50), nullable=False
    )  # blog, instagram, cafe, youtube, daangn, kakao
    title = Column(String(500))
    body = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft, approved, published
    engagement_metrics = Column(JSON, default=dict)
    persona_target = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)


class MarketSignal(Base):
    """Market signal model for tracking market opportunities."""

    __tablename__ = "market_signals"

    id = Column(Integer, primary_key=True)
    source = Column(
        String(100), nullable=False
    )  # naver_news, naver_blog, youtube, naver_cafe
    signal_type = Column(String(100))
    title = Column(String(500))
    summary = Column(Text)
    urgency = Column(String(20), default="low")  # critical, high, medium, low
    sentiment = Column(String(20))  # positive, negative, neutral
    keywords = Column(JSON, default=list)
    url = Column(String(1000))
    collected_at = Column(DateTime, default=datetime.utcnow)


class LeadAction(Base):
    """Lead action model for tracking interactions with leads."""

    __tablename__ = "lead_actions"

    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    action_type = Column(String(100))  # like, follow, comment, dm
    details = Column(JSON, default=dict)
    performed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    lead = relationship("Lead", back_populates="actions")


class DailyMetric(Base):
    """Daily metric model for tracking daily statistics."""

    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True)
    date = Column(String(20), nullable=False, unique=True)  # YYYY-MM-DD
    leads_collected = Column(Integer, default=0)
    proposals_made = Column(Integer, default=0)
    proposals_approved = Column(Integer, default=0)
    contents_published = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Setting(Base):
    """Setting model for storing application settings."""

    __tablename__ = "settings"

    key = Column(String(200), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
