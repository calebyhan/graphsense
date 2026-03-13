"""
Shared pytest fixtures for backend tests.

These tests use FastAPI's TestClient with mocked Supabase and Gemini dependencies
so they run without real credentials.
"""

# Set clean env vars BEFORE any app imports trigger get_settings() at module level.
# This overrides Doppler values that may contain inline comments (e.g. "true  # comment").
import os
os.environ.update({
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SECRET_KEY": "test-secret-key",
    "GEMINI_API_KEY": "test-gemini-key",
    "DEBUG": "false",
    "MAX_FILE_SIZE": "104857600",
    "REDIS_URL": "redis://localhost:6379/0",
})

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.core.config import get_settings
get_settings.cache_clear()


@pytest.fixture
def mock_supabase():
    """Supabase client where every table call succeeds with empty data."""
    client = MagicMock()
    table = MagicMock()
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.delete.return_value = table
    table.eq.return_value = table
    table.gte.return_value = table
    table.order.return_value = table
    table.range.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[])
    client.table.return_value = table
    return client


@pytest.fixture
def mock_redis():
    """Redis client with no cached dedup entries by default."""
    redis = MagicMock()
    redis.get.return_value = None
    redis.setex.return_value = True
    return redis


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear in-memory rate limiter state between tests to prevent 429s."""
    from app.core.limiter import limiter
    storage = getattr(limiter, "_storage", None)
    if storage is not None and hasattr(storage, "reset"):
        storage.reset()
    yield
    if storage is not None and hasattr(storage, "reset"):
        storage.reset()


@pytest.fixture
def app(mock_supabase, mock_redis):
    """FastAPI test app with Supabase, Redis, and Celery mocked out."""
    with (
        # Patch at usage sites — required because routes use `from X import fn`
        patch("app.api.routes.analysis.get_supabase_client", return_value=mock_supabase),
        patch("app.api.routes.visualizations.get_supabase_client", return_value=mock_supabase),
        # PipelineOrchestrator stores supabase at __init__ time; patch before lazy init
        patch("app.services.pipeline_orchestrator.get_supabase_client", return_value=mock_supabase),
        # Reset lazy orchestrator so each test gets a fresh instance with the mocked client
        patch("app.api.routes.analysis._orchestrator", None),
        # Mock Redis to avoid real connections and control dedup behaviour
        patch("app.api.routes.analysis._redis", mock_redis),
        # Patch run_analysis at its import site in the routes module
        patch("app.api.routes.analysis.run_analysis") as mock_task,
    ):
        mock_task.delay = MagicMock()
        from main import app as _app
        yield _app


@pytest.fixture
def client(app):
    return TestClient(app)


# ── Small CSV-like dataset used across tests ──────────────────────────────────

SAMPLE_DATA = [
    {"name": "Alice", "age": 30, "salary": 70000, "dept": "Engineering"},
    {"name": "Bob",   "age": 25, "salary": 55000, "dept": "Marketing"},
    {"name": "Carol", "age": 35, "salary": 90000, "dept": "Engineering"},
    {"name": "Dave",  "age": 28, "salary": 62000, "dept": "Sales"},
    {"name": "Eve",   "age": 32, "salary": 75000, "dept": "Engineering"},
]
