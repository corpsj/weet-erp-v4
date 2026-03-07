"""Configuration management using Pydantic BaseSettings."""

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import ClassVar


class OllamaConfig(BaseModel):
    """Ollama LLM service configuration."""

    host: str = "http://localhost:11434"
    model_primary: str = "qwen3.5:35b"
    model_fast: str = "qwen3.5:9b"
    model_embed: str = "qwen3-embedding:8b"
    model_quality: str = "qwen3.5:122b"


class NaverConfig(BaseModel):
    """Naver API configuration."""

    client_id: str
    client_secret: str


class YouTubeConfig(BaseModel):
    """YouTube API configuration."""

    api_key: str


class DiscordConfig(BaseModel):
    """Discord webhook and bot configuration."""

    webhook_url: str = ""
    bot_token: str = ""
    channel_id: str = "1474571842772537585"


class InstagramConfig(BaseModel):
    """Instagram account configuration."""

    username: str = ""
    password: str = ""
    session_dir: str = "backend/.sessions"


class SchedulerConfig(BaseModel):
    """Scheduler and rate limiting configuration."""

    operating_hours_start: int = 7  # KST
    operating_hours_end: int = 23  # KST
    daily_likes_limit: int = 150
    daily_follows_limit: int = 50
    daily_comments_limit: int = 30
    daily_dms_limit: int = 15


class OpenClawSettings(BaseModel):
    gateway_ws_url: str = "ws://127.0.0.1:18789/gateway"
    api_key: str = ""


class Settings(BaseSettings):
    """Main application settings."""

    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env", env_nested_delimiter="__", extra="ignore"
    )

    ollama: OllamaConfig = OllamaConfig()
    naver: NaverConfig = NaverConfig(client_id="", client_secret="")
    youtube: YouTubeConfig = YouTubeConfig(api_key="")
    discord: DiscordConfig = DiscordConfig()
    instagram: InstagramConfig = InstagramConfig()
    scheduler: SchedulerConfig = SchedulerConfig()
    openclaw: OpenClawSettings = OpenClawSettings()
