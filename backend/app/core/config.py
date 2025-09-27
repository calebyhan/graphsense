"""
Configuration settings for the Auto Visualization Agent backend
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    environment: str = "development"
    debug: bool = True

    # API Configuration
    api_title: str = "Auto Visualization Agent API"
    api_version: str = "1.0.0"

    # Supabase Configuration
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str = ""

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

    # Security
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration: int = 3600  # 1 hour

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ]

    # Logging
    log_level: str = "info"
    log_format: str = "json"

    # Agent Configuration
    agent_timeout: int = 300  # 5 minutes
    max_concurrent_agents: int = 3
    retry_attempts: int = 3

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()