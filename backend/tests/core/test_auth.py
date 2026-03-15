"""
Tests for app/core/auth.py — get_user_id FastAPI dependency.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.core.auth import get_user_id


def test_no_authorization_returns_none():
    assert get_user_id(authorization=None) is None


def test_missing_bearer_prefix_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        get_user_id(authorization="Token abc123")
    assert exc_info.value.status_code == 401
    assert "format" in exc_info.value.detail.lower()


def test_valid_token_returns_user_id():
    mock_user = MagicMock()
    mock_user.id = "user-uuid-1234"
    mock_response = MagicMock()
    mock_response.user = mock_user

    mock_admin = MagicMock()
    mock_admin.auth.get_user.return_value = mock_response

    with patch("app.database.supabase_client.get_supabase_admin_client", return_value=mock_admin):
        result = get_user_id(authorization="Bearer valid-token")

    assert result == "user-uuid-1234"


def test_token_with_no_user_raises_401():
    mock_response = MagicMock()
    mock_response.user = None

    mock_admin = MagicMock()
    mock_admin.auth.get_user.return_value = mock_response

    with patch("app.database.supabase_client.get_supabase_admin_client", return_value=mock_admin):
        with pytest.raises(HTTPException) as exc_info:
            get_user_id(authorization="Bearer valid-token")

    assert exc_info.value.status_code == 401


def test_http_exception_from_supabase_is_reraised():
    mock_admin = MagicMock()
    mock_admin.auth.get_user.side_effect = HTTPException(status_code=403, detail="Forbidden")

    with patch("app.database.supabase_client.get_supabase_admin_client", return_value=mock_admin):
        with pytest.raises(HTTPException) as exc_info:
            get_user_id(authorization="Bearer some-token")

    assert exc_info.value.status_code == 403


def test_generic_exception_raises_401():
    mock_admin = MagicMock()
    mock_admin.auth.get_user.side_effect = RuntimeError("network failure")

    with patch("app.database.supabase_client.get_supabase_admin_client", return_value=mock_admin):
        with pytest.raises(HTTPException) as exc_info:
            get_user_id(authorization="Bearer bad-token")

    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()
