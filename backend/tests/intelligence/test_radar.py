"""Tests for Market Radar signal collection."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.intelligence.radar import MarketRadar, Signal
from app.intelligence.signal_analyzer import SignalAnalyzer


@pytest.fixture
def mock_naver():
    from app.clients.naver import NewsItem, BlogItem, CafeItem

    client = AsyncMock()
    client.search_news.return_value = [
        NewsItem(
            title="이동식주택 인기 급증",
            link="https://news.naver.com/1",
            description="귀촌 수요 증가",
        ),
        NewsItem(
            title="모듈러주택 정부 지원",
            link="https://news.naver.com/2",
            description="보조금 확대",
        ),
    ]
    client.search_blog.return_value = [
        BlogItem(
            title="전원생활 블로그",
            link="https://blog.naver.com/1",
            description="귀촌 후기",
        ),
    ]
    client.search_cafearticle.return_value = [
        CafeItem(
            title="이동식주택 질문",
            link="https://cafe.naver.com/1",
            description="가격 문의",
        ),
    ]
    return client


@pytest.fixture
def mock_youtube():
    from app.clients.youtube import VideoItem

    client = AsyncMock()
    client.search_videos.return_value = [
        VideoItem(video_id="abc123", title="이동식주택 투어", channel_title="홈채널"),
    ]
    return client


@pytest.fixture
def radar(mock_naver, mock_youtube):
    r = MarketRadar()
    r.naver = mock_naver
    r.youtube = mock_youtube
    r.discord = MagicMock()
    return r


@pytest.mark.asyncio
async def test_scan_news_returns_signals(radar):
    signals = await radar.scan_news(["이동식주택"])
    assert len(signals) >= 1
    assert all(isinstance(s, Signal) for s in signals)
    assert all(s.source == "naver_news" for s in signals)


@pytest.mark.asyncio
async def test_scan_blogs_returns_signals(radar):
    signals = await radar.scan_blogs(["이동식주택"])
    assert len(signals) >= 1
    assert all(s.source == "naver_blog" for s in signals)


@pytest.mark.asyncio
async def test_scan_youtube_returns_signals(radar):
    signals = await radar.scan_youtube(["이동식주택"])
    assert len(signals) >= 1
    assert all(s.source == "youtube" for s in signals)


@pytest.mark.asyncio
async def test_run_full_scan_aggregates_all_sources(radar):
    with patch.object(radar, "_save_signals", new_callable=AsyncMock):
        signals = await radar.run_full_scan()
    assert len(signals) >= 3  # news + blog + cafe + youtube
    sources = {s.source for s in signals}
    assert "naver_news" in sources


@pytest.mark.asyncio
async def test_critical_signal_triggers_discord_alert(radar):
    critical_signal = Signal(
        source="naver_news",
        signal_type="policy",
        title="긴급: 이동식주택 규제 변화",
        summary="규제 변화 감지",
        urgency="critical",
    )
    with patch.object(radar, "scan_news", return_value=[critical_signal]):
        with patch.object(radar, "scan_blogs", return_value=[]):
            with patch.object(radar, "scan_cafes", return_value=[]):
                with patch.object(radar, "scan_youtube", return_value=[]):
                    with patch.object(radar, "_save_signals", new_callable=AsyncMock):
                        await radar.run_full_scan()
    radar.discord.send_alert.assert_called_once()
    alert_args = radar.discord.send_alert.call_args[0]
    assert "긴급: 이동식주택 규제 변화" in alert_args[1]


def test_signal_analyzer_detect_opportunities():
    llm_mock = MagicMock()
    llm_mock.analyze.return_value = {
        "urgency": "high",
        "sentiment": "positive",
        "actionable": True,
        "suggested_action": "블로그 작성",
        "keywords": ["귀촌"],
    }
    analyzer = SignalAnalyzer()
    analyzer.llm = llm_mock
    signal = Signal(
        source="naver_news",
        signal_type="demand",
        title="귀촌 인기",
        summary="수요 급증",
    )
    analyzed = analyzer.analyze([signal])
    assert len(analyzed) == 1
    assert analyzed[0].urgency == "high"
    assert analyzed[0].actionable is True
    opportunities = analyzer.detect_opportunities(analyzed)
    assert len(opportunities) >= 1
    assert opportunities[0].urgency == "high"
