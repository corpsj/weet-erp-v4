"""Market Radar — scans multiple channels for market signals relevant to WEET."""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional
from app.clients.naver import NaverClient
from app.clients.youtube import YouTubeClient
from app.core.config import Settings
from app.core.llm import LLMService
from app.core.notification_service import NotificationService
from app.db.session import get_supabase

logger = logging.getLogger(__name__)

# WEET 마케팅 키워드 세트
DEMAND_KEYWORDS = [
    "이동식주택",
    "모듈러주택",
    "농막",
    "컨테이너하우스",
    "세컨하우스",
    "전원주택",
    "귀촌",
]
POLICY_KEYWORDS = ["귀촌 보조금", "농촌 지원", "이동식건축물", "건축 허가"]
TREND_KEYWORDS = ["미니멀라이프", "전원생활", "소형주택", "1인가구"]
ALL_KEYWORDS = DEMAND_KEYWORDS + POLICY_KEYWORDS + TREND_KEYWORDS


@dataclass
class Signal:
    source: str  # naver_news, naver_blog, naver_cafe, youtube
    signal_type: str  # demand, policy, trend, competitor
    title: str
    summary: str
    url: str = ""
    urgency: str = "low"  # critical, high, medium, low
    sentiment: str = "neutral"
    keywords: list[str] = field(default_factory=list)
    collected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class MarketRadar:
    """Scans Naver + YouTube for market signals relevant to WEET modular housing."""

    def __init__(self):
        self.settings = Settings()
        self.naver = NaverClient()
        self.youtube = YouTubeClient()
        self.notifier = NotificationService()
        self._llm: Optional[LLMService] = None

    async def scan_news(self, keywords: Optional[list[str]] = None) -> list[Signal]:
        """Scan Naver news for policy changes, subsidies, trends."""
        keywords = keywords or DEMAND_KEYWORDS[:3]
        signals = []
        for keyword in keywords[:2]:  # rate limit protection
            try:
                items = await self.naver.search_news(keyword, display=5)
                for item in items:
                    signals.append(
                        Signal(
                            source="naver_news",
                            signal_type="demand",
                            title=item.title.replace("<b>", "").replace("</b>", ""),
                            summary=item.description.replace("<b>", "").replace(
                                "</b>", ""
                            ),
                            url=item.link,
                            keywords=[keyword],
                        )
                    )
            except Exception:
                continue  # graceful degradation
        return signals

    async def scan_blogs(self, keywords: Optional[list[str]] = None) -> list[Signal]:
        """Scan Naver blogs for competitor content and trends."""
        keywords = keywords or DEMAND_KEYWORDS[:2]
        signals = []
        for keyword in keywords[:2]:
            try:
                items = await self.naver.search_blog(keyword, display=5)
                for item in items:
                    signals.append(
                        Signal(
                            source="naver_blog",
                            signal_type="trend",
                            title=item.title.replace("<b>", "").replace("</b>", ""),
                            summary=item.description.replace("<b>", "").replace(
                                "</b>", ""
                            ),
                            url=item.link,
                            keywords=[keyword],
                        )
                    )
            except Exception:
                continue
        return signals

    async def scan_cafes(self, keywords: Optional[list[str]] = None) -> list[Signal]:
        """Scan Naver cafe posts for questions and interest."""
        keywords = keywords or DEMAND_KEYWORDS[:2]
        signals = []
        for keyword in keywords[:2]:
            try:
                items = await self.naver.search_cafearticle(keyword, display=5)
                for item in items:
                    signals.append(
                        Signal(
                            source="naver_cafe",
                            signal_type="demand",
                            title=item.title.replace("<b>", "").replace("</b>", ""),
                            summary=item.description.replace("<b>", "").replace(
                                "</b>", ""
                            ),
                            url=item.link,
                            keywords=[keyword],
                        )
                    )
            except Exception:
                continue
        return signals

    async def scan_youtube(self, keywords: Optional[list[str]] = None) -> list[Signal]:
        """Scan YouTube for trending videos on modular housing topics."""
        if not self.settings.youtube.api_key or self.settings.youtube.api_key in (
            "",
            "your_youtube_api_key_here",
        ):
            logger.warning("YouTube API key not configured, skipping YouTube scan")
            return []
        keywords = keywords or ["이동식주택", "모듈러주택"]
        signals = []
        for keyword in keywords[:1]:  # YouTube quota is expensive (100 units/search)
            try:
                videos = await self.youtube.search_videos(keyword, max_results=5)
                for video in videos:
                    signals.append(
                        Signal(
                            source="youtube",
                            signal_type="trend",
                            title=video.title,
                            summary=f"조회수: {video.view_count} | 채널: {video.channel_title}",
                            url=f"https://youtube.com/watch?v={video.video_id}",
                            keywords=[keyword],
                        )
                    )
            except Exception:
                continue
        return signals

    async def run_full_scan(self) -> list[Signal]:
        """Run all scanners concurrently, save to DB, alert critical signals."""
        results = await asyncio.gather(
            self.scan_news(),
            self.scan_blogs(),
            self.scan_cafes(),
            self.scan_youtube(),
            return_exceptions=True,
        )
        signals = []
        for result in results:
            if isinstance(result, list):
                signals.extend(result)

        # Save to DB
        await self._save_signals(signals)

        # Alert critical signals
        critical = [s for s in signals if s.urgency == "critical"]
        for sig in critical:
            self.notifier.send_alert("urgent", f"🚨 시장 신호: {sig.title}")

        return signals

    async def _save_signals(self, signals: list[Signal]):
        """Save signals to Supabase via REST API."""
        deduplicated = self._deduplicate(signals)
        removed_duplicates = len(signals) - len(deduplicated)
        filtered_by_relevance = 0

        try:
            sb = get_supabase()
        except Exception:
            logger.exception("Failed to get Supabase client for radar signal save")
            return

        saved_count = 0
        for signal in deduplicated:
            relevance_score = self._assess_relevance(signal)
            if relevance_score < 0.5:
                filtered_by_relevance += 1
                continue

            try:
                sb.table("marketing_signals").insert(
                    {
                        "source": signal.source,
                        "signal_type": signal.signal_type,
                        "title": signal.title[:500],
                        "summary": signal.summary[:2000] if signal.summary else "",
                        "urgency": signal.urgency,
                        "sentiment": signal.sentiment,
                        "keywords": signal.keywords,
                        "url": signal.url[:1000] if signal.url else "",
                    }
                ).execute()
                saved_count += 1
            except Exception:
                logger.exception("Failed to save radar signal: %s", signal.title)

        logger.info(
            "Radar signal save complete: %s deduplicated, %s relevance-filtered, %s saved",
            removed_duplicates,
            filtered_by_relevance,
            saved_count,
        )

    def _deduplicate(self, signals: list[Signal]) -> list[Signal]:
        deduplicated: list[Signal] = []
        seen_urls: set[str] = set()

        for signal in signals:
            normalized_url = (signal.url or "").strip()
            if normalized_url:
                if normalized_url in seen_urls:
                    continue
                seen_urls.add(normalized_url)

            normalized_title = (signal.title or "").strip().lower()
            if normalized_title:
                is_near_duplicate = False
                for kept in deduplicated:
                    kept_title = (kept.title or "").strip().lower()
                    if not kept_title:
                        continue
                    if (
                        SequenceMatcher(None, normalized_title, kept_title).ratio()
                        > 0.8
                    ):
                        is_near_duplicate = True
                        break
                if is_near_duplicate:
                    continue

            deduplicated.append(signal)

        return deduplicated

    def _assess_relevance(self, signal: Signal) -> float:
        valid_urgency = {"critical", "high", "medium", "low"}
        valid_sentiment = {"positive", "negative", "neutral"}

        try:
            if self._llm is None:
                self._llm = LLMService()

            text = f"제목: {signal.title}\n요약: {signal.summary}"
            task = (
                "이 시장 신호가 이동식주택/모듈러주택 사업에 얼마나 관련이 있는가? "
                "JSON 형식으로만 응답: "
                '{"urgency":"critical|high|medium|low","sentiment":"positive|negative|neutral",'
                '"relevance_score":0.0-1.0,"reason":"..."}'
            )
            result = self._llm.analyze(text, task)

            if not isinstance(result, dict) or result.get("error"):
                raise ValueError(f"Invalid LLM response: {result}")

            urgency = str(result.get("urgency", "")).strip().lower()
            sentiment = str(result.get("sentiment", "")).strip().lower()
            signal.urgency = urgency if urgency in valid_urgency else "medium"
            signal.sentiment = sentiment if sentiment in valid_sentiment else "neutral"

            relevance_score = float(result.get("relevance_score", 0.0))
            return max(0.0, min(1.0, relevance_score))
        except Exception:
            logger.exception("Failed to assess signal relevance for: %s", signal.title)
            signal.urgency = "medium"
            signal.sentiment = "neutral"
            return 0.7
