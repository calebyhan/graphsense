"""
Configuration settings for the GraphSense backend
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    environment: str = "development"
    debug: bool = False  # Override with DEBUG=true in .env for local dev

    # API Configuration
    api_title: str = "GraphSense API"
    api_version: str = "1.0.0"

    # Supabase Configuration
    supabase_url: str
    supabase_secret_key: str  # Dashboard → Settings → API → Secret key (sb_secret_...)
    supabase_publishable_key: str = ""  # Dashboard → Settings → API → Publishable key (sb_publishable_...)

    # Google Gemini API
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_temperature: float = 0.1
    gemini_max_tokens: int = 4096

    # File Upload Configuration
    max_file_size: int = 104857600  # 100MB
    max_rows: int = 10000
    upload_dir: str = "/app/uploads"
    allowed_extensions: List[str] = ["csv", "json", "xlsx", "xls", "tsv"]

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ]

    # Logging
    log_level: str = "info"
    log_format: str = "json"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Agent Configuration
    agent_timeout: int = 300  # 5 minutes
    max_concurrent_agents: int = 3
    retry_attempts: int = 3

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()