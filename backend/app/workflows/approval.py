from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Mapping, Optional, Protocol, Union, cast

from app.db.models import Proposal


class NotifierProtocol(Protocol):
    def send_proposal(self, proposal: dict[str, str]) -> bool: ...

    def send_alert(self, alert_type: str, message: str) -> bool: ...


class ExecutionResultProtocol(Protocol):
    success: bool


class ExecutorProtocol(Protocol):
    async def execute(
        self, proposal: Mapping[str, object]
    ) -> ExecutionResultProtocol: ...


class SessionProtocol(Protocol):
    def get(
        self,
        model: type[Proposal],
        proposal_id: int,
    ) -> Union[object, Awaitable[Optional[object]]]: ...

    def commit(self) -> Union[object, Awaitable[object]]: ...


@dataclass
class ApprovalResult:
    proposal_id: int
    action: str
    success: bool
    message: str = ""
    executed: bool = False


class ApprovalWorkflow:
    def __init__(
        self,
        notifier: NotifierProtocol,
        db_session: Optional[SessionProtocol] = None,
        executor: Optional[ExecutorProtocol] = None,
    ):
        self.notifier = notifier
        self.db_session = db_session
        self.executor = executor

    async def on_proposal_created(self, proposal: dict[str, object]) -> bool:
        payload = {
            "title": self._as_str(proposal.get("title")),
            "signal": self._as_str(
                proposal.get("rationale", proposal.get("signal", ""))
            ),
            "action": self._as_str(proposal.get("action_type")),
            "urgency": self._as_str(proposal.get("urgency", "medium")),
            "impact": self._as_str(
                proposal.get("expected_impact", proposal.get("impact", ""))
            ),
            "content_draft": self._as_str(proposal.get("content_draft")),
        }
        return bool(self.notifier.send_proposal(payload))

    async def on_reaction(
        self, proposal_id: int, reaction: str
    ) -> ApprovalResult:
        if reaction == "approve":
            updated = await self._update_proposal_status(
                proposal_id,
                "approved",
                approved_at=datetime.now(timezone.utc),
            )
            executed = False
            if updated and self.executor:
                proposal = await self._get_proposal_dict(proposal_id)
                execution = await self.executor.execute(proposal)
                executed = execution.success
            message = "제안 승인 처리 완료" if updated else "제안 승인 처리 실패"
            return ApprovalResult(
                proposal_id=proposal_id,
                action="approved",
                success=updated,
                message=message,
                executed=executed,
            )

        if reaction == "reject":
            updated = await self._update_proposal_status(proposal_id, "rejected")
            message = "제안 거부 처리 완료" if updated else "제안 거부 처리 실패"
            return ApprovalResult(
                proposal_id=proposal_id,
                action="rejected",
                success=updated,
                message=message,
            )

        if reaction == "modify":
            self.notifier.send_alert(
                "market_change",
                f"✏️ 수정 요청: 제안 #{proposal_id} 내용을 수정해 주세요.",
            )
            return ApprovalResult(
                proposal_id=proposal_id,
                action="modified",
                success=True,
                message="수정 요청 전달 완료",
            )

        return ApprovalResult(
            proposal_id=proposal_id,
            action="unknown",
            success=False,
            message=f"Unknown reaction: {reaction}",
        )

    async def on_dashboard_action(
        self,
        proposal_id: int,
        action: str,
        data: Optional[dict[str, object]] = None,
    ) -> ApprovalResult:
        payload = data or {}
        if action == "approve":
            result = await self.on_reaction(proposal_id, "approve")
            self.notifier.send_alert(
                "market_change",
                f"대시보드 승인: 제안 #{proposal_id}",
            )
            return result

        if action == "reject":
            reason = self._as_str(payload.get("reason"))
            updated = await self._update_proposal_status(
                proposal_id,
                "rejected",
                rejection_reason=reason if reason else None,
            )
            suffix = f" (사유: {reason})" if reason else ""
            self.notifier.send_alert(
                "market_change",
                f"대시보드 거부: 제안 #{proposal_id}{suffix}",
            )
            return ApprovalResult(
                proposal_id=proposal_id,
                action="rejected",
                success=updated,
                message="대시보드 거부 처리 완료"
                if updated
                else "대시보드 거부 처리 실패",
            )

        if action == "modify":
            result = await self.on_reaction(proposal_id, "modify")
            self.notifier.send_alert(
                "market_change",
                f"대시보드 수정 요청: 제안 #{proposal_id}",
            )
            return result

        return ApprovalResult(
            proposal_id=proposal_id,
            action="unknown",
            success=False,
            message=f"Unknown dashboard action: {action}",
        )

    async def _update_proposal_status(
        self,
        proposal_id: int,
        status: str,
        **kwargs: object,
    ) -> bool:
        if not self.db_session:
            return True
        proposal = await self._session_get(Proposal, proposal_id)
        if not proposal:
            return False
        setattr(proposal, "status", status)
        for key, value in kwargs.items():
            if value is not None:
                setattr(proposal, key, value)
        await self._maybe_await(self.db_session.commit())
        return True

    async def _get_proposal_dict(self, proposal_id: int) -> dict[str, object]:
        base: dict[str, object] = {"id": proposal_id}
        if not self.db_session:
            return base
        proposal = await self._session_get(Proposal, proposal_id)
        if not proposal:
            return base
        return {
            "id": getattr(proposal, "id", proposal_id),
            "title": getattr(proposal, "title", ""),
            "action_type": getattr(proposal, "action_type", "unknown"),
            "content_draft": getattr(proposal, "content_draft", ""),
            "urgency": getattr(proposal, "urgency", "medium"),
        }

    async def _session_get(
        self,
        model: type[Proposal],
        proposal_id: int,
    ) -> Optional[object]:
        if not self.db_session:
            return None
        value = self.db_session.get(model, proposal_id)
        return await self._maybe_await(value)

    async def _maybe_await(
        self,
        value: Union[object, Awaitable[Optional[object]]],
    ) -> Optional[object]:
        if hasattr(value, "__await__"):
            return await cast(Awaitable[Optional[object]], value)
        return cast(Optional[object], value)

    def _as_str(self, value: Optional[object]) -> str:
        if value is None:
            return ""
        return str(value)
