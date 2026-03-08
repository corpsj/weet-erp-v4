from unittest.mock import AsyncMock, MagicMock

from app.orchestrator.runner import TaskRunner


async def test_run_success() -> None:
    runner = TaskRunner()
    coro = AsyncMock(return_value=None)

    result = await runner.run("market_scan", coro)

    assert result.success is True
    assert result.error is None
    assert result.task_name == "market_scan"
    assert coro.await_count == 1


async def test_run_dry_run_skips_coro() -> None:
    runner = TaskRunner(dry_run=True)
    coro = AsyncMock(return_value=None)

    result = await runner.run("market_scan", coro)

    assert result.success is True
    assert coro.await_count == 0


async def test_run_connection_error_retries_and_fails() -> None:
    runner = TaskRunner()
    coro = AsyncMock(side_effect=ConnectionError("lmstudio offline"))

    result = await runner.run("suggestion_run", coro)

    assert result.success is False
    assert "lmstudio offline" in str(result.error)
    assert coro.await_count == runner.MAX_RETRIES


async def test_run_rate_limit_stops_immediately() -> None:
    runner = TaskRunner()
    coro = AsyncMock(side_effect=RuntimeError("rate limit"))

    result = await runner.run("lead_hunt", coro)

    assert result.success is False
    assert "rate limit" in str(result.error)
    assert coro.await_count == 1


async def test_run_sends_notifier_alert_on_failure() -> None:
    notifier = MagicMock()
    runner = TaskRunner(notifier=notifier)
    coro = AsyncMock(side_effect=RuntimeError("rate limit"))

    result = await runner.run("lead_hunt", coro)

    assert result.success is False
    notifier.send_alert.assert_called_once()


async def test_get_log_returns_results() -> None:
    runner = TaskRunner()
    coro = AsyncMock(return_value=None)

    await runner.run("daily_reset", coro)
    await runner.run("market_scan", coro)

    log = runner.get_log()
    assert len(log) == 2
    assert [item.task_name for item in log] == ["daily_reset", "market_scan"]
