"""Tests for configuration system."""

import os
import pytest
from app.core.config import Settings


@pytest.fixture
def env_setup(tmp_path):
    """Setup test environment with .env file."""
    env_file = tmp_path / ".env"
    env_file.write_text(
        "NAVER__CLIENT_ID=test_naver_id\n"
        "NAVER__CLIENT_SECRET=test_naver_secret\n"
        "YOUTUBE__API_KEY=test_yt_key\n"
        "DISCORD__WEBHOOK_URL=https://discord.com/api/webhooks/placeholder\n"
    )

    # Change to temp directory so Settings finds .env
    original_cwd = os.getcwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(original_cwd)


def test_settings_load_successfully(env_setup):
    """Test that settings load successfully with .env file."""
    settings = Settings()
    assert settings is not None
    assert isinstance(settings, Settings)


def test_lmstudio_model(env_setup):
    settings = Settings()
    assert settings.lmstudio.model == "huihui-qwen3.5-35b-a3b-abliterated-mlx"


def test_scheduler_daily_likes_limit(env_setup):
    """Test that scheduler.daily_likes_limit equals 150."""
    settings = Settings()
    assert settings.scheduler.daily_likes_limit == 150


def test_discord_channel_id(env_setup):
    """Test that discord.channel_id equals '1474571842772537585'."""
    settings = Settings()
    assert settings.discord.channel_id == "1474571842772537585"


def test_naver_config_from_env(env_setup):
    """Test that Naver config loads from environment variables."""
    settings = Settings()
    assert settings.naver.client_id == "test_naver_id"
    assert settings.naver.client_secret == "test_naver_secret"


def test_youtube_config_from_env(env_setup):
    """Test that YouTube config loads from environment variables."""
    settings = Settings()
    assert settings.youtube.api_key == "test_yt_key"


def test_discord_webhook_from_env(env_setup):
    """Test that Discord webhook URL loads from environment variables."""
    settings = Settings()
    assert (
        settings.discord.webhook_url == "https://discord.com/api/webhooks/placeholder"
    )


def test_scheduler_defaults(env_setup):
    """Test that scheduler has correct default values."""
    settings = Settings()
    assert settings.scheduler.operating_hours_start == 7
    assert settings.scheduler.operating_hours_end == 23
    assert settings.scheduler.daily_follows_limit == 50
    assert settings.scheduler.daily_comments_limit == 30
    assert settings.scheduler.daily_dms_limit == 15


def test_lmstudio_defaults(env_setup):
    settings = Settings()
    assert settings.lmstudio.base_url == "http://localhost:1234/v1"
    assert settings.lmstudio.model == "huihui-qwen3.5-35b-a3b-abliterated-mlx"
