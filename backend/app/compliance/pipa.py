"""PIPA (개인정보보호법) compliance module for WEET Director."""

from datetime import datetime, timedelta, timezone
from typing import Optional


class PICACompliance:
    """PIPA (개인정보보호법) compliance module for WEET Director."""

    RETENTION_DAYS = 365  # 1 year

    def __init__(self, db_session=None):
        self.db_session = db_session

    def generate_privacy_policy(self) -> str:
        """Generate Korean privacy policy text."""
        return """# 개인정보처리방침

## 1. 개인정보 수집 항목
- 소셜 미디어 사용자명 (Instagram, Naver, YouTube)
- 프로필 공개 정보 (바이오, 팔로워 수)
- 플랫폼 활동 내역 (댓글, 좋아요, 팔로우)

## 2. 개인정보 수집 목적
마케팅 리드 관리 및 고객 관계 관리 (CRM)

## 3. 개인정보 보유 기간
수집일로부터 1년 (365일) 후 자동 삭제 또는 익명화

## 4. 제3자 제공
개인정보를 제3자에게 제공하지 않습니다.

## 5. 개인정보 처리 위탁
개인정보 처리를 외부에 위탁하지 않습니다.

## 6. 정보주체의 권리
- 개인정보 열람 요청
- 개인정보 삭제 요청
- 개인정보 처리 정지 요청

## 7. 개인정보 보호책임자
(주)위트 마케팅팀 | 연락처: 010-9645-2348

## 8. 시행일
본 방침은 시스템 운영 시작일부터 적용됩니다.
"""

    async def check_data_retention(self, leads: list) -> list[int]:
        """Return list of lead IDs that exceed retention period.

        Args:
            leads: list of Lead ORM objects or dicts with 'id' and 'created_at'
        Returns:
            list of lead IDs to delete/anonymize
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.RETENTION_DAYS)
        expired_ids = []
        for lead in leads:
            if isinstance(lead, dict):
                created_at = lead.get("created_at")
            else:
                created_at = getattr(lead, "created_at", None)

            if created_at is None:
                continue

            # Handle timezone-naive datetimes
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            if created_at < cutoff:
                lead_id = (
                    lead.get("id")
                    if isinstance(lead, dict)
                    else getattr(lead, "id", None)
                )
                if lead_id is not None:
                    expired_ids.append(lead_id)

        return expired_ids

    def anonymize_lead(self, lead: dict) -> dict:
        """Anonymize lead personal data in-place.

        Replaces username with anonymized version, clears metadata.
        Returns the anonymized lead dict.
        """
        anonymized = dict(lead)
        lead_id = lead.get("id", "unknown")
        anonymized["username"] = f"anonymized_{lead_id}"
        anonymized["metadata_"] = {}
        anonymized["source"] = "anonymized"
        return anonymized

    def export_lead_data(self, lead: dict) -> dict:
        """Export lead data for data subject request (정보주체 요청).

        Returns dict with all stored data about the lead.
        """
        return {
            "id": lead.get("id"),
            "platform": lead.get("platform"),
            "username": lead.get("username"),
            "score": lead.get("score"),
            "persona_type": lead.get("persona_type"),
            "journey_stage": lead.get("journey_stage"),
            "source": lead.get("source"),
            "created_at": str(lead.get("created_at", "")),
            "retention_expires_at": str(
                (lead.get("created_at") or datetime.now(timezone.utc))
                + timedelta(days=self.RETENTION_DAYS)
            ),
        }
