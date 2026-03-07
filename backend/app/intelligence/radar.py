"""Market Radar — scans multiple channels for market signals relevant to WEET."""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from app.clients.naver import NaverClient
from app.clients.youtube import YouTubeClient
from app.core.discord_bot import DiscordBot
from app.db.session import AsyncSessionLocal
from app.db.models import MarketSignal

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
    keywords: list = field(default_factory=list)
    collected_at: datetime = field(default_factory=datetime.utcnow)


class MarketRadar:
    """Scans Naver + YouTube for market signals relevant to WEET modular housing."""

    def __init__(self):
        self.naver = NaverClient()
        self.youtube = YouTubeClient()
        self.discord = DiscordBot()

    async def scan_news(self, keywords: list[str] = None) -> list[Signal]:
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

    async def scan_blogs(self, keywords: list[str] = None) -> list[Signal]:
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

    async def scan_cafes(self, keywords: list[str] = None) -> list[Signal]:
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

    async def scan_youtube(self, keywords: list[str] = None) -> list[Signal]:
        """Scan YouTube for trending videos on modular housing topics."""
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
            self.discord.send_alert("urgent", f"🚨 시장 신호: {sig.title}")

        return signals

    async def _save_signals(self, signals: list[Signal]):
        """Save signals to database."""
        try:
            async with AsyncSessionLocal() as session:
                for signal in signals:
                    db_signal = MarketSignal(
                        source=signal.source,
                        signal_type=signal.signal_type,
                        title=signal.title[:500],
                        summary=signal.summary[:2000] if signal.summary else "",
                        urgency=signal.urgency,
                        sentiment=signal.sentiment,
                        keywords=signal.keywords,
                        url=signal.url[:1000] if signal.url else "",
                    )
                    session.add(db_signal)
                await session.commit()
        except Exception:
            pass  # DB errors shouldn't crash radar
