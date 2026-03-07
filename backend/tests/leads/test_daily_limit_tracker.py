"""Tests for DailyLimitTracker DB persistence (Task 4)."""

import pytest
from datetime import date
from unittest.mock import MagicMock

from app.leads.discovery import DailyLimitTracker


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    sb = MagicMock()
    # Default: no existing data in DB
    sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    return sb


def test_backward_compat_no_supabase():
    """DailyLimitTracker works in-memory without supabase_client."""
    tracker = DailyLimitTracker(likes=150, follows=50, comments=30, dms=15)
    tracker.record("likes")
    assert tracker.counts["likes"] == 1
    # No DB calls made
    tracker.record("follows")
    assert tracker.counts["follows"] == 1


def test_persist_counts_to_db(mock_supabase):
    """record() saves counts to DB when supabase_client provided."""
    tracker = DailyLimitTracker(supabase_client=mock_supabase)
    tracker.record("likes")
    tracker.record("likes")
    assert tracker.counts["likes"] == 2
    # Verify upsert was called
    mock_supabase.table.return_value.upsert.assert_called()


def test_load_counts_from_db(mock_supabase):
    """DailyLimitTracker loads existing counts from DB on init."""
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"value": {"likes": 42, "follows": 10, "comments": 5, "dms": 2}}
    ]
    tracker = DailyLimitTracker(supabase_client=mock_supabase)
    assert tracker.counts["likes"] == 42
    assert tracker.counts["follows"] == 10
    assert tracker.counts["comments"] == 5
    assert tracker.counts["dms"] == 2


def test_restart_preserves_counts(mock_supabase):
    """New DailyLimitTracker instance restores counts from DB."""
    # Simulate first instance recorded 50 likes
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"value": {"likes": 50, "follows": 0, "comments": 0, "dms": 0}}
    ]
    # New instance (simulating process restart)
    tracker2 = DailyLimitTracker(supabase_client=mock_supabase)
    assert tracker2.counts["likes"] == 50  # restored from DB


def test_daily_reset_clears_counts(mock_supabase):
    """reset() clears in-memory counts and saves to DB."""
    tracker = DailyLimitTracker(supabase_client=mock_supabase)
    tracker.counts["likes"] = 100
    tracker.reset()
    assert tracker.counts["likes"] == 0
    assert tracker.counts["follows"] == 0


def test_limit_exceeded_with_persisted_counts(mock_supabase):
    """Limit check works correctly with DB-loaded counts."""
    # Simulate 149 likes already recorded
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"value": {"likes": 149, "follows": 0, "comments": 0, "dms": 0}}
    ]
    tracker = DailyLimitTracker(likes=150, supabase_client=mock_supabase)
    assert tracker.counts["likes"] == 149
    tracker.record("likes")  # 150th — should succeed
    assert tracker.counts["likes"] == 150
    with pytest.raises(RuntimeError, match="limit exceeded"):
        tracker.record("likes")  # 151st — should fail


def test_remaining_with_persisted_counts(mock_supabase):
    """remaining() returns correct value with DB-loaded counts."""
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"value": {"likes": 100, "follows": 0, "comments": 0, "dms": 0}}
    ]
    tracker = DailyLimitTracker(likes=150, supabase_client=mock_supabase)
    assert tracker.remaining("likes") == 50
