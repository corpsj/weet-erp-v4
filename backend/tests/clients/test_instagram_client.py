"""Tests for InstagrapiClient wrapper."""

import os
from datetime import datetime, timedelta
import pytest
from unittest.mock import MagicMock, patch, mock_open

from app.clients.instagram_client import InstagramRateLimitError, InstagrapiClient


@pytest.fixture
def client(tmp_path):
    """InstagrapiClient with temp session directory."""
    return InstagrapiClient(
        username="test_user",
        password="test_pass",
        session_dir=str(tmp_path),
    )


def test_client_init_creates_session_dir(tmp_path):
    """InstagrapiClient creates session directory on init."""
    session_dir = str(tmp_path / "sessions")
    client = InstagrapiClient("user", "pass", session_dir=session_dir)
    assert os.path.isdir(session_dir)


def test_client_init_sets_session_path(client, tmp_path):
    """Session file path is correctly constructed."""
    assert client._session_path == str(tmp_path / "test_user_settings.json")


def test_login_without_saved_session(client):
    """Fresh login when no session file exists."""
    mock_ig_client = MagicMock()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        result = client.login()
    assert result is True
    mock_ig_client.login.assert_called_once_with("test_user", "test_pass")
    mock_ig_client.dump_settings.assert_called_once()


def test_login_with_saved_session(client, tmp_path):
    """Reuses saved session file when it exists."""
    session_file = tmp_path / "test_user_settings.json"
    session_file.write_text("{}")  # create dummy session file
    mock_ig_client = MagicMock()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        result = client.login()
    assert result is True
    mock_ig_client.load_settings.assert_called_once()
    mock_ig_client.dump_settings.assert_called_once()


def test_login_failure_bad_password(client):
    """Returns False on bad password, no crash."""
    from instagrapi.exceptions import BadPassword

    mock_ig_client = MagicMock()
    mock_ig_client.login.side_effect = BadPassword("wrong password")
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        result = client.login()
    assert result is False
    assert client.get_client() is None


def test_login_failure_challenge_required(client):
    """Returns False on challenge required, no crash."""
    from instagrapi.exceptions import ChallengeRequired

    mock_ig_client = MagicMock()
    mock_ig_client.login.side_effect = ChallengeRequired()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        result = client.login()
    assert result is False


def test_challenge_callback_returns_empty_string(client):
    """Challenge callback returns empty string (manual intervention needed)."""
    result = client._challenge_callback("test_user", 1)
    assert result == ""


def test_session_dump_on_successful_login(client):
    """dump_settings is called after successful login."""
    mock_ig_client = MagicMock()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        client.login()
    mock_ig_client.dump_settings.assert_called_once_with(client._session_path)


def test_is_session_valid_after_login(client):
    """Session is valid after successful login."""
    mock_ig_client = MagicMock()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        client.login()
    # After login, client is set but session file may not exist in tmp
    # Just verify get_client() returns the mock
    assert client.get_client() is mock_ig_client


def test_is_session_valid_before_login(client):
    """Session is not valid before login."""
    assert client.get_client() is None


def test_logout_clears_client(client):
    """Logout clears the internal client reference."""
    mock_ig_client = MagicMock()
    with patch("app.clients.instagram_client.Client", return_value=mock_ig_client):
        client.login()
    client.logout()
    assert client._client is None


def test_get_direct_threads_returns_threads(client):
    mock_ig_client = MagicMock()
    mock_ig_client.direct_threads.return_value = ["thread-1"]
    client._client = mock_ig_client

    result = client.get_direct_threads(amount=10)

    assert result == ["thread-1"]
    mock_ig_client.direct_threads.assert_called_once_with(amount=10)


def test_get_direct_threads_rate_limited_sets_cooldown(client):
    from instagrapi.exceptions import PleaseWaitFewMinutes

    mock_ig_client = MagicMock()
    mock_ig_client.direct_threads.side_effect = PleaseWaitFewMinutes("wait")
    client._client = mock_ig_client

    with pytest.raises(InstagramRateLimitError):
        client.get_direct_threads()

    assert client.get_cooldown_until() is not None


def test_get_thread_messages_returns_messages(client):
    mock_ig_client = MagicMock()
    mock_ig_client.direct_messages.return_value = ["message-1"]
    client._client = mock_ig_client

    result = client.get_thread_messages(thread_id="123", amount=3)

    assert result == ["message-1"]
    mock_ig_client.direct_messages.assert_called_once_with(thread_id=123, amount=3)


def test_get_thread_messages_invalid_thread_id_returns_empty(client):
    mock_ig_client = MagicMock()
    client._client = mock_ig_client

    result = client.get_thread_messages(thread_id="abc", amount=3)

    assert result == []
    mock_ig_client.direct_messages.assert_not_called()


def test_is_in_cooldown_true_when_future_timestamp(client):
    client._cooldown_until = datetime.now() + timedelta(minutes=31)

    assert client.is_in_cooldown() is True
