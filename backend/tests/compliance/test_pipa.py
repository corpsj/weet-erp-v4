"""Tests for PIPA compliance module."""

import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from app.compliance.pipa import PICACompliance


class TestPrivacyPolicy:
    """Tests for privacy policy generation."""

    def test_generate_privacy_policy_contains_required_sections(self):
        """Test that privacy policy contains all required sections."""
        compliance = PICACompliance()
        policy = compliance.generate_privacy_policy()

        # Check for required Korean sections
        assert "개인정보처리방침" in policy
        assert "보유 기간" in policy
        assert "제3자 제공" in policy
        assert "개인정보 수집 항목" in policy
        assert "개인정보 수집 목적" in policy
        assert "정보주체의 권리" in policy
        assert "개인정보 보호책임자" in policy

    def test_generate_privacy_policy_contains_retention_days(self):
        """Test that privacy policy mentions 365 days retention."""
        compliance = PICACompliance()
        policy = compliance.generate_privacy_policy()

        assert "365" in policy or "1년" in policy
        assert "자동 삭제" in policy or "익명화" in policy

    def test_generate_privacy_policy_contains_contact_info(self):
        """Test that privacy policy contains contact information."""
        compliance = PICACompliance()
        policy = compliance.generate_privacy_policy()

        assert "(주)위트" in policy
        assert "010-9645-2348" in policy


class TestDataRetention:
    """Tests for data retention checking."""

    @pytest.mark.asyncio
    async def test_check_data_retention_expired_lead(self):
        """Test that leads older than 365 days are marked as expired."""
        compliance = PICACompliance()

        # Create a lead that's 400 days old
        old_date = datetime.now(timezone.utc) - timedelta(days=400)
        leads = [
            {
                "id": 1,
                "platform": "instagram",
                "username": "test_user",
                "created_at": old_date,
            }
        ]

        expired_ids = await compliance.check_data_retention(leads)
        assert 1 in expired_ids

    @pytest.mark.asyncio
    async def test_check_data_retention_fresh_lead(self):
        """Test that fresh leads are not marked as expired."""
        compliance = PICACompliance()

        # Create a lead that's 30 days old
        fresh_date = datetime.now(timezone.utc) - timedelta(days=30)
        leads = [
            {
                "id": 2,
                "platform": "youtube",
                "username": "fresh_user",
                "created_at": fresh_date,
            }
        ]

        expired_ids = await compliance.check_data_retention(leads)
        assert 2 not in expired_ids

    @pytest.mark.asyncio
    async def test_check_data_retention_boundary_case(self):
        """Test boundary case: lead exactly at 365 days."""
        compliance = PICACompliance()

        # Create a lead that's exactly 365 days old
        boundary_date = datetime.now(timezone.utc) - timedelta(days=365)
        leads = [
            {
                "id": 3,
                "platform": "naver",
                "username": "boundary_user",
                "created_at": boundary_date,
            }
        ]

        expired_ids = await compliance.check_data_retention(leads)
        # At exactly 365 days, it should be considered expired (< cutoff)
        assert 3 in expired_ids

    @pytest.mark.asyncio
    async def test_check_data_retention_multiple_leads(self):
        """Test retention check with multiple leads."""
        compliance = PICACompliance()

        old_date = datetime.now(timezone.utc) - timedelta(days=400)
        fresh_date = datetime.now(timezone.utc) - timedelta(days=30)

        leads = [
            {
                "id": 1,
                "platform": "instagram",
                "username": "old_user",
                "created_at": old_date,
            },
            {
                "id": 2,
                "platform": "youtube",
                "username": "fresh_user",
                "created_at": fresh_date,
            },
            {
                "id": 3,
                "platform": "naver",
                "username": "another_old",
                "created_at": old_date,
            },
        ]

        expired_ids = await compliance.check_data_retention(leads)
        assert 1 in expired_ids
        assert 2 not in expired_ids
        assert 3 in expired_ids

    @pytest.mark.asyncio
    async def test_check_data_retention_handles_none_created_at(self):
        """Test that leads with None created_at are skipped."""
        compliance = PICACompliance()

        leads = [
            {"id": 1, "platform": "instagram", "username": "user1", "created_at": None},
            {
                "id": 2,
                "platform": "youtube",
                "username": "user2",
                "created_at": datetime.now(timezone.utc),
            },
        ]

        expired_ids = await compliance.check_data_retention(leads)
        assert 1 not in expired_ids
        assert 2 not in expired_ids

    @pytest.mark.asyncio
    async def test_check_data_retention_handles_timezone_naive(self):
        """Test that timezone-naive datetimes are handled correctly."""
        compliance = PICACompliance()

        # Create timezone-naive datetime
        old_date = datetime.now() - timedelta(days=400)
        leads = [
            {
                "id": 1,
                "platform": "instagram",
                "username": "user1",
                "created_at": old_date,
            }
        ]

        expired_ids = await compliance.check_data_retention(leads)
        assert 1 in expired_ids


class TestAnonymization:
    """Tests for lead anonymization."""

    def test_anonymize_lead_replaces_username(self):
        """Test that anonymize_lead replaces username with anonymized version."""
        compliance = PICACompliance()

        lead = {
            "id": 123,
            "platform": "instagram",
            "username": "original_username",
            "score": 85,
            "metadata_": {"key": "value"},
        }

        anonymized = compliance.anonymize_lead(lead)

        assert anonymized["username"].startswith("anonymized_")
        assert "123" in anonymized["username"]
        assert anonymized["username"] != "original_username"

    def test_anonymize_lead_clears_metadata(self):
        """Test that anonymize_lead clears metadata."""
        compliance = PICACompliance()

        lead = {
            "id": 456,
            "platform": "youtube",
            "username": "user456",
            "metadata_": {"sensitive": "data", "more": "info"},
        }

        anonymized = compliance.anonymize_lead(lead)

        assert anonymized["metadata_"] == {}

    def test_anonymize_lead_sets_source_to_anonymized(self):
        """Test that anonymize_lead sets source to 'anonymized'."""
        compliance = PICACompliance()

        lead = {
            "id": 789,
            "platform": "naver",
            "username": "user789",
            "source": "competitor_comment",
        }

        anonymized = compliance.anonymize_lead(lead)

        assert anonymized["source"] == "anonymized"

    def test_anonymize_lead_preserves_other_fields(self):
        """Test that anonymize_lead preserves non-sensitive fields."""
        compliance = PICACompliance()

        lead = {
            "id": 999,
            "platform": "instagram",
            "username": "user999",
            "score": 75,
            "persona_type": "lifestyle",
            "journey_stage": "awareness",
        }

        anonymized = compliance.anonymize_lead(lead)

        assert anonymized["id"] == 999
        assert anonymized["platform"] == "instagram"
        assert anonymized["score"] == 75
        assert anonymized["persona_type"] == "lifestyle"
        assert anonymized["journey_stage"] == "awareness"

    def test_anonymize_lead_does_not_modify_original(self):
        """Test that anonymize_lead returns a new dict without modifying original."""
        compliance = PICACompliance()

        lead = {
            "id": 111,
            "platform": "youtube",
            "username": "original_user",
            "metadata_": {"key": "value"},
        }

        original_username = lead["username"]
        original_metadata = lead["metadata_"]

        anonymized = compliance.anonymize_lead(lead)

        # Original should be unchanged
        assert lead["username"] == original_username
        assert lead["metadata_"] == original_metadata
        # Anonymized should be different
        assert anonymized["username"] != original_username


class TestDataExport:
    """Tests for data subject export requests."""

    def test_export_lead_data_contains_required_fields(self):
        """Test that export_lead_data contains all required fields."""
        compliance = PICACompliance()

        lead = {
            "id": 555,
            "platform": "instagram",
            "username": "export_user",
            "score": 80,
            "persona_type": "price_sensitive",
            "journey_stage": "consideration",
            "source": "hashtag_user",
            "created_at": datetime.now(timezone.utc),
        }

        exported = compliance.export_lead_data(lead)

        assert "id" in exported
        assert "platform" in exported
        assert "username" in exported
        assert "score" in exported
        assert "persona_type" in exported
        assert "journey_stage" in exported
        assert "source" in exported
        assert "created_at" in exported
        assert "retention_expires_at" in exported

    def test_export_lead_data_calculates_retention_expiry(self):
        """Test that export_lead_data calculates retention expiry correctly."""
        compliance = PICACompliance()

        created_date = datetime.now(timezone.utc)
        lead = {
            "id": 666,
            "platform": "youtube",
            "username": "expiry_user",
            "created_at": created_date,
        }

        exported = compliance.export_lead_data(lead)

        # Retention expires at created_at + 365 days
        assert "retention_expires_at" in exported
        assert exported["retention_expires_at"] != ""

    def test_export_lead_data_handles_missing_created_at(self):
        """Test that export_lead_data handles missing created_at gracefully."""
        compliance = PICACompliance()

        lead = {
            "id": 777,
            "platform": "naver",
            "username": "no_date_user",
        }

        exported = compliance.export_lead_data(lead)

        assert "retention_expires_at" in exported
        assert exported["retention_expires_at"] != ""

    def test_export_lead_data_preserves_all_values(self):
        """Test that export_lead_data preserves all lead values."""
        compliance = PICACompliance()

        lead = {
            "id": 888,
            "platform": "instagram",
            "username": "preserve_user",
            "score": 92,
            "persona_type": "design",
            "journey_stage": "decision",
            "source": "competitor_comment",
            "created_at": datetime.now(timezone.utc),
        }

        exported = compliance.export_lead_data(lead)

        assert exported["id"] == 888
        assert exported["platform"] == "instagram"
        assert exported["username"] == "preserve_user"
        assert exported["score"] == 92
        assert exported["persona_type"] == "design"
        assert exported["journey_stage"] == "decision"
        assert exported["source"] == "competitor_comment"


class TestComplianceInitialization:
    """Tests for PICACompliance initialization."""

    def test_pica_compliance_initializes_with_default_retention(self):
        """Test that PICACompliance initializes with correct retention days."""
        compliance = PICACompliance()
        assert compliance.RETENTION_DAYS == 365

    def test_pica_compliance_initializes_with_db_session(self):
        """Test that PICACompliance can be initialized with db_session."""
        mock_session = object()
        compliance = PICACompliance(db_session=mock_session)
        assert compliance.db_session is mock_session

    def test_pica_compliance_initializes_without_db_session(self):
        """Test that PICACompliance initializes without db_session."""
        compliance = PICACompliance()
        assert compliance.db_session is None
