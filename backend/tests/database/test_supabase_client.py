"""
Tests for app/database/supabase_client.py — 100% coverage.
"""

import pytest
from unittest.mock import MagicMock, patch


# ── Helpers ──────────────────────────────────────────────────────────────────

def _reset_singleton():
    """Reset the module-level singleton between tests."""
    import app.database.supabase_client as mod
    mod._supabase_client = None


# ── get_supabase_client ───────────────────────────────────────────────────────

def test_creates_client_on_first_call():
    _reset_singleton()
    mock_client = MagicMock()
    with patch("app.database.supabase_client.create_client", return_value=mock_client) as mock_create:
        from app.database.supabase_client import get_supabase_client
        result = get_supabase_client()

    assert result is mock_client
    mock_create.assert_called_once()


def test_returns_cached_client_on_second_call():
    _reset_singleton()
    mock_client = MagicMock()
    with patch("app.database.supabase_client.create_client", return_value=mock_client) as mock_create:
        from app.database.supabase_client import get_supabase_client
        first = get_supabase_client()
        second = get_supabase_client()

    assert first is second
    mock_create.assert_called_once()


def test_raises_on_create_client_failure():
    _reset_singleton()
    with patch("app.database.supabase_client.create_client", side_effect=RuntimeError("bad url")):
        from app.database.supabase_client import get_supabase_client
        with pytest.raises(RuntimeError, match="bad url"):
            get_supabase_client()


# ── get_supabase_admin_client ─────────────────────────────────────────────────

def test_admin_client_returns_same_as_regular():
    _reset_singleton()
    mock_client = MagicMock()
    with patch("app.database.supabase_client.create_client", return_value=mock_client):
        from app.database.supabase_client import get_supabase_admin_client, get_supabase_client
        regular = get_supabase_client()
        admin = get_supabase_admin_client()

    assert admin is regular


# ── test_connection ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connection_returns_true_on_success():
    _reset_singleton()
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    mock_client = MagicMock()
    mock_client.table.return_value = mock_table

    with patch("app.database.supabase_client.create_client", return_value=mock_client):
        from app.database.supabase_client import test_connection
        result = await test_connection()

    assert result is True


@pytest.mark.asyncio
async def test_connection_returns_false_on_exception():
    _reset_singleton()
    mock_client = MagicMock()
    mock_client.table.side_effect = Exception("connection refused")

    with patch("app.database.supabase_client.create_client", return_value=mock_client):
        from app.database.supabase_client import test_connection
        result = await test_connection()

    assert result is False
