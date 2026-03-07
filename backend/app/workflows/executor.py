from dataclasses import dataclass
from typing import Mapping, Optional, Protocol


class NotifierProtocol(Protocol):
    def send_alert(self, alert_type: str, message: str) -> bool: ...


class GeneratedArticleProtocol(Protocol):
    body: str


class ContentGeneratorProtocol(Protocol):
    async def generate_blog_article(
        self,
        topic: str,
        keywords: list[str],
        persona: Optional[str] = None,
    ) -> GeneratedArticleProtocol: ...


@dataclass
class ExecutionResult:
    proposal_id: int
    success: bool
    action_type: str
    output: str = ""
    error: Optional[str] = None


class ActionExecutor:
    def __init__(
        self,
        notifier: Optional[NotifierProtocol] = None,
        content_generator: Optional[ContentGeneratorProtocol] = None,
        db_session: Optional[object] = None,
    ):
        self.notifier = notifier
        self.content_generator = content_generator
        self.db_session = db_session
        self._executed: list[int] = []

    async def execute(self, proposal: Mapping[str, object]) -> ExecutionResult:
        proposal_id = self._as_int(proposal.get("id"), default=0)

        if proposal_id in self._executed:
            return ExecutionResult(
                proposal_id=proposal_id,
                success=False,
                action_type=self._as_str(
                    proposal.get("action_type"), default="unknown"
                ),
                error="Already executed",
            )

        action_type = self._as_str(proposal.get("action_type"), default="unknown")

        try:
            if action_type == "content":
                output = await self._execute_content(proposal)
            elif action_type == "outreach":
                output = await self._execute_outreach(proposal)
            elif action_type == "strategy":
                output = await self._execute_strategy(proposal)
            elif action_type == "urgent":
                output = await self._execute_urgent(proposal)
            else:
                output = f"Unknown action type: {action_type}"

            self._executed.append(proposal_id)

            if self.notifier:
                self.notifier.send_alert(
                    "market_change",
                    f"✅ 실행 완료: {self._as_str(proposal.get('title'))}",
                )

            return ExecutionResult(
                proposal_id=proposal_id,
                success=True,
                action_type=action_type,
                output=output,
            )
        except Exception as exc:
            if self.notifier:
                self.notifier.send_alert(
                    "error",
                    f"❌ 실행 실패: {self._as_str(proposal.get('title'))} — {exc}",
                )
            return ExecutionResult(
                proposal_id=proposal_id,
                success=False,
                action_type=action_type,
                error=str(exc),
            )

    async def _execute_content(self, proposal: Mapping[str, object]) -> str:
        content_draft = self._as_str(proposal.get("content_draft"))
        if self.content_generator:
            topic = self._as_str(proposal.get("title"), default="콘텐츠 제안")
            article = await self.content_generator.generate_blog_article(
                topic=topic,
                keywords=[],
                persona=None,
            )
            return f"콘텐츠 생성 완료: {article.body[:50]}..."
        return f"콘텐츠 생성 완료: {content_draft[:50]}..."

    async def _execute_outreach(self, proposal: Mapping[str, object]) -> str:
        return f"아웃리치 메시지 생성: {self._as_str(proposal.get('title'))}"

    async def _execute_strategy(self, proposal: Mapping[str, object]) -> str:
        if self.notifier:
            self.notifier.send_alert(
                "market_change",
                f"전략 업데이트: {self._as_str(proposal.get('title'))}",
            )
        return f"전략 적용 완료: {self._as_str(proposal.get('title'))}"

    async def _execute_urgent(self, proposal: Mapping[str, object]) -> str:
        if self.notifier:
            self.notifier.send_alert(
                "urgent",
                f"🚨 긴급 알림: {self._as_str(proposal.get('title'))}",
            )
        return "긴급 알림 전송 완료"

    def is_executed(self, proposal_id: int) -> bool:
        return proposal_id in self._executed

    def _as_str(self, value: object, default: str = "") -> str:
        if value is None:
            return default
        return str(value)

    def _as_int(self, value: object, default: int = 0) -> int:
        if isinstance(value, int):
            return value
        try:
            return int(str(value))
        except Exception:
            return default
