"""
Shared pytest fixtures for backend tests.

These tests use FastAPI's TestClient with mocked Supabase and Gemini dependencies
so they run without real credentials.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


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
def app(mock_supabase):
    """FastAPI test app with Supabase and Celery mocked out."""
    with (
        patch("app.database.supabase_client.get_supabase_client", return_value=mock_supabase),
        patch("app.worker.run_analysis") as mock_task,
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
