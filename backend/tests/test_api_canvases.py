"""
Canvas endpoint tests — focused on the join_canvas bug fix.

Supabase is mocked so that maybe_single().execute() can return None (as
supabase-py 2.28.0 does when no row matches), verifying the endpoints handle
this correctly without crashing.
"""

import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.auth import get_user_id


USER_A = str(uuid.uuid4())   # canvas owner
USER_B = str(uuid.uuid4())   # collaborator (non-owner)
CANVAS_ID = str(uuid.uuid4())
SHARE_TOKEN = "abc123" * 10  # 60-char fake token


def _make_supabase(canvas_row=None, owner_row=None):
    """Return a mock Supabase client for join_canvas tests.

    The join_canvas route calls supabase twice on 'canvases':
      1. token lookup  → canvas_row (None simulates supabase-py 2.28.0 no-match)
      2. owner check   → owner_row
    """
    client = MagicMock()
    call_count = {"n": 0}
    rows = [canvas_row, owner_row]

    def _table(name):
        t = MagicMock()
        t.select.return_value = t
        t.insert.return_value = t
        t.update.return_value = t
        t.delete.return_value = t
        t.upsert.return_value = t
        t.eq.return_value = t
        t.order.return_value = t
        t.range.return_value = t
        t.limit.return_value = t
        t.single.return_value = t
        t.maybe_single.return_value = t

        if name == "canvases":
            def _execute():
                idx = call_count["n"]
                call_count["n"] += 1
                row = rows[idx] if idx < len(rows) else None
                return None if row is None else MagicMock(data=row)
            t.execute.side_effect = _execute
        else:
            t.execute.return_value = MagicMock(data=[])
        return t

    client.table.side_effect = _table
    return client


# ---------------------------------------------------------------------------
# join_canvas — non-owner path (the original crash site)
# ---------------------------------------------------------------------------

def test_join_canvas_non_owner_success():
    """Non-owner joining via valid token returns 200 (owner_check returns None)."""
    from main import app

    supabase = _make_supabase(
        canvas_row={"id": CANVAS_ID, "share_permission": "view"},
        owner_row=None,   # supabase-py returns None for non-owners — the original bug
    )

    async def _user():
        return USER_B

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.canvases.get_supabase_client", return_value=supabase):
            r = TestClient(app, raise_server_exceptions=False).post(
                "/api/canvases/join", json={"token": SHARE_TOKEN}
            )
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["canvas_id"] == CANVAS_ID
    assert body["permission"] == "view"


def test_join_canvas_invalid_token_returns_404():
    """Joining with an unknown token returns 404, not 500."""
    from main import app

    supabase = _make_supabase(canvas_row=None)  # token lookup returns None

    async def _user():
        return USER_B

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.canvases.get_supabase_client", return_value=supabase):
            r = TestClient(app, raise_server_exceptions=False).post(
                "/api/canvases/join", json={"token": "bad-token"}
            )
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    assert r.status_code == 404


def test_join_canvas_owner_skips_collaborator_upsert():
    """Owner joining via share link gets 200 and no collaborator row is upserted."""
    from main import app

    supabase = _make_supabase(
        canvas_row={"id": CANVAS_ID, "share_permission": "edit"},
        owner_row={"id": CANVAS_ID},  # owner check finds a row
    )

    async def _user():
        return USER_A

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.canvases.get_supabase_client", return_value=supabase):
            r = TestClient(app, raise_server_exceptions=False).post(
                "/api/canvases/join", json={"token": SHARE_TOKEN}
            )
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    assert r.status_code == 200
    # Verify the canvas_collaborators table was never touched for the owner path
    collab_calls = [
        call for call in supabase.table.call_args_list
        if call.args and call.args[0] == "canvas_collaborators"
    ]
    assert not collab_calls, "owner path must not touch canvas_collaborators table"
