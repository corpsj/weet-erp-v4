from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.channels.dm_monitor import DMMonitor, DMMonitorRateLimitError
from app.clients.instagram_client import InstagramRateLimitError


@pytest.mark.asyncio
async def test_check_new_dms_detects_consultation_keyword() -> None:
    wrapper = MagicMock()
    wrapper.is_in_cooldown.return_value = False
    wrapper.get_cooldown_until.return_value = None

    thread_user = MagicMock()
    thread_user.username = "house_lead"
    thread = MagicMock()
    thread.id = "101"
    thread.users = [thread_user]

    message_user = MagicMock()
    message_user.username = "house_lead"
    message = MagicMock()
    message.id = "msg-1"
    message.text = "가격 문의드립니다"
    message.user_id = 555
    message.user = message_user

    wrapper.get_direct_threads.return_value = [thread]
    wrapper.get_thread_messages.return_value = [message]

    client = MagicMock()
    client.user_id = 777
    wrapper.get_client.return_value = client

    monitor = DMMonitor(client_wrapper=wrapper)
    with patch.object(monitor, "_run_sync", new=AsyncMock(side_effect=lambda fn: fn())):
        result = await monitor.check_new_dms()

    assert len(result) == 1
    assert result[0]["username"] == "house_lead"
    assert result[0]["thread_id"] == "101"
    assert result[0]["message_id"] == "msg-1"
    assert result[0]["keyword_matched"] == "가격"


@pytest.mark.asyncio
async def test_check_new_dms_skips_outgoing_message() -> None:
    wrapper = MagicMock()
    wrapper.is_in_cooldown.return_value = False
    wrapper.get_cooldown_until.return_value = None

    thread = MagicMock()
    thread.id = "102"
    thread.users = []

    message = MagicMock()
    message.id = "msg-2"
    message.text = "견적 알려주세요"
    message.user_id = 1000
    message.user = MagicMock(username="our_account")

    wrapper.get_direct_threads.return_value = [thread]
    wrapper.get_thread_messages.return_value = [message]

    client = MagicMock()
    client.user_id = 1000
    wrapper.get_client.return_value = client

    monitor = DMMonitor(client_wrapper=wrapper)
    with patch.object(monitor, "_run_sync", new=AsyncMock(side_effect=lambda fn: fn())):
        result = await monitor.check_new_dms()

    assert result == []


@pytest.mark.asyncio
async def test_check_new_dms_raises_when_wrapper_cooldown_active() -> None:
    wrapper = MagicMock()
    wrapper.is_in_cooldown.return_value = True
    wrapper.get_cooldown_until.return_value = datetime.now() + timedelta(minutes=30)

    monitor = DMMonitor(client_wrapper=wrapper)

    with pytest.raises(DMMonitorRateLimitError):
        await monitor.check_new_dms()


@pytest.mark.asyncio
async def test_check_new_dms_converts_instagram_rate_limit_error() -> None:
    wrapper = MagicMock()
    wrapper.is_in_cooldown.return_value = False
    wrapper.get_cooldown_until.return_value = datetime.now() + timedelta(minutes=45)
    wrapper.get_direct_threads.side_effect = InstagramRateLimitError("wait")

    monitor = DMMonitor(client_wrapper=wrapper)
    with patch.object(monitor, "_run_sync", new=AsyncMock(side_effect=lambda fn: fn())):
        with pytest.raises(DMMonitorRateLimitError) as exc_info:
            await monitor.check_new_dms()

    assert exc_info.value.cooldown_until is not None
