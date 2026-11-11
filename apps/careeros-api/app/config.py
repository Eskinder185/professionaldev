"""Settings come only from environment variables or a gitignored .env file."""

import ipaddress
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CAREEROS_",
        env_file=str(SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Required: no defaults, so the service refuses to start without them instead of using a weak one.
    database_url: str
    api_token: SecretStr = Field(min_length=16)

    # Never "*": the API is private, and a wildcard origin with credentials is unsafe.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
    ]
    enable_docs: bool = False

    pool_size: int = Field(default=5, ge=1, le=50)
    pool_max_overflow: int = Field(default=5, ge=0, le=50)
    pool_recycle_seconds: int = Field(default=1800, ge=30)

    # ATS sync
    session_dir: Path = Path("/var/lib/careeros/sessions")

    # Local model for the interview simulator: any OpenAI-compatible server (LiteLLM, Ollama /v1, LM Studio).
    llm_base_url: str = "http://127.0.0.1:11434/v1"
    llm_model: str = ""
    llm_api_key: SecretStr | None = None  # LiteLLM proxies often want one; Ollama does not
    llm_timeout_seconds: float = Field(default=120, ge=5, le=900)
    # Job text and skill levels are sent to this server. Off-machine hosts need an explicit opt-in.
    llm_allow_remote: bool = False

    # The published-only, read-only portfolio endpoint. Off unless you turn it on.
    public_portfolio: bool = False
    public_rate_limit_per_minute: int = Field(default=60, ge=1, le=6000)

    @field_validator("database_url")
    @classmethod
    def _driver(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("database_url must start with postgresql+psycopg:// (SQLAlchemy + psycopg 3)")
        return value

    @field_validator("llm_base_url")
    @classmethod
    def _llm_url(cls, value: str) -> str:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            raise ValueError("llm_base_url must be an http(s) URL")
        return value.rstrip("/")

    def llm_host_is_local(self) -> bool:
        host = urlsplit(self.llm_base_url).hostname or ""
        if host == "localhost" or host.endswith(".localhost"):
            return True
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            return False  # a plain hostname could be anywhere; require llm_allow_remote
        return ip.is_loopback or ip.is_private

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: list[str]) -> list[str]:
        if any(origin.strip() == "*" for origin in value):
            raise ValueError("cors_origins must list exact origins, not '*'")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
