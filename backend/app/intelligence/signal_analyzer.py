"""Signal Analyzer — uses LLM to analyze market signals and detect opportunities."""

from dataclasses import dataclass, field
from app.core.llm import LLMService
from app.core.prompts import MARKET_ANALYSIS_PROMPT
from app.intelligence.radar import Signal


@dataclass
class AnalyzedSignal:
    signal: Signal
    urgency: str = "low"
    sentiment: str = "neutral"
    keywords: list = field(default_factory=list)
    actionable: bool = False
    suggested_action: str = ""


@dataclass
class Opportunity:
    title: str
    signal_source: str
    rationale: str
    urgency: str = "medium"
    suggested_content_type: str = "blog"  # blog, instagram, cafe, youtube


class SignalAnalyzer:
    """Analyzes market signals using LLM to extract actionable opportunities."""

    def __init__(self):
        self.llm = LLMService()

    def analyze(self, signals: list[Signal]) -> list[AnalyzedSignal]:
        """Analyze signals with LLM. Uses fast model for batch processing."""
        analyzed = []
        for signal in signals:
            try:
                prompt = MARKET_ANALYSIS_PROMPT.format(
                    signal_text=f"{signal.title}: {signal.summary}"
                )
                result = self.llm.analyze(prompt, "market opportunity")
                analyzed.append(
                    AnalyzedSignal(
                        signal=signal,
                        urgency=result.get("urgency", "low"),
                        sentiment=result.get("sentiment", "neutral"),
                        keywords=result.get("keywords", signal.keywords),
                        actionable=result.get("actionable", False),
                        suggested_action=result.get("suggested_action", ""),
                    )
                )
            except Exception:
                # If LLM fails, keep signal with defaults
                analyzed.append(AnalyzedSignal(signal=signal))
        return analyzed

    def detect_opportunities(self, analyzed: list[AnalyzedSignal]) -> list[Opportunity]:
        """Extract actionable opportunities from analyzed signals."""
        opportunities = []
        for item in analyzed:
            if item.actionable or item.urgency in ("critical", "high"):
                opportunities.append(
                    Opportunity(
                        title=f"기회: {item.signal.title[:100]}",
                        signal_source=item.signal.source,
                        rationale=item.suggested_action
                        or f"{item.urgency} 긴급도 신호 감지",
                        urgency=item.urgency,
                        suggested_content_type=self._suggest_content_type(item.signal),
                    )
                )
        return opportunities

    def _suggest_content_type(self, signal: Signal) -> str:
        """Suggest the best content type based on signal source."""
        mapping = {
            "naver_news": "blog",
            "naver_blog": "instagram",
            "naver_cafe": "cafe",
            "youtube": "youtube",
        }
        return mapping.get(signal.source, "blog")
