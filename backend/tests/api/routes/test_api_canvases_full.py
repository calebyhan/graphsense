"""
Canvas endpoint tests — full coverage for all routes.

Each test creates its own TestClient with isolated mocks to avoid state leakage.
"""

import uuid
from contextlib import contextmanager, ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.core.auth import get_user_id


USER_A = str(uuid.uuid4())   # canvas owner
USER_B = str(uuid.uuid4())   # collaborator
CANVAS_ID = str(uuid.uuid4())
COLLAB_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_table(responses=None):
    """Flexible mock table supporting a fixed response or a sequence."""
    t = MagicMock()
    for m in ["select", "insert", "update", "delete", "upsert", "eq", "in_",
              "gte", "neq", "order", "range", "limit", "single", "maybe_single"]:
        getattr(t, m).return_value = t
    if responses is not None:
        t.execute.side_effect = iter(responses)
    else:
        t.execute.return_value = MagicMock(data=[])
    sb = MagicMock()
    sb.table.return_value = t
    return sb, t


def _make_admin():
    """Mock admin supabase client for user-lookup calls."""
    admin = MagicMock()
    user = MagicMock()
    user.email = "owner@example.com"
    resp = MagicMock()
    resp.user = user
    admin.auth.admin.get_user_by_id.return_value = resp
    return admin


@contextmanager
def _ctx(user_id, responses=None, admin=None):
    """TestClient with mocked auth and supabase for canvas routes."""
    from main import app
    sb, t = _make_table(responses)

    async def _user():
        return user_id

    app.dependency_overrides[get_user_id] = _user
    patches = [patch("app.api.routes.canvases.get_supabase_client", return_value=sb)]
    if admin is not None:
        patches.append(patch(
            "app.database.supabase_client.get_supabase_admin_client",
            return_value=admin,
        ))
    try:
        with ExitStack() as stack:
            for p in patches:
                stack.enter_context(p)
            yield TestClient(app, raise_server_exceptions=False), sb, t
    finally:
        app.dependency_overrides.pop(get_user_id, None)


# ---------------------------------------------------------------------------
# require_user — unauthenticated request
# ---------------------------------------------------------------------------

def test_canvas_requires_auth():
    """Any canvas endpoint without auth → 401."""
    from main import app
    sb, _ = _make_table()
    with patch("app.api.routes.canvases.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).get("/api/canvases")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/canvases — list_canvases
# ---------------------------------------------------------------------------

def test_list_canvases_returns_list():
    canvas_row = {
        "id": CANVAS_ID, "name": "My Canvas", "description": None,
        "share_permission": None, "created_at": "2024-01-01", "updated_at": "2024-01-01",
    }
    responses = [
        MagicMock(data=[canvas_row]),        # canvases query
        MagicMock(data=[{"canvas_id": CANVAS_ID}]),  # canvas_datasets count
    ]
    with _ctx(USER_A, responses=responses) as (client, _, _t):
        r = client.get("/api/canvases")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["id"] == CANVAS_ID
    assert body[0]["dataset_count"] == 1
    assert body[0]["has_share_link"] is False


def test_list_canvases_empty():
    with _ctx(USER_A, responses=[MagicMock(data=[])]) as (client, _, _t):
        r = client.get("/api/canvases")
    assert r.status_code == 200
    assert r.json() == []


# ---------------------------------------------------------------------------
# GET /api/canvases/shared — list_shared_canvases
# ---------------------------------------------------------------------------

def test_list_shared_canvases():
    canvas_data = {
        "id": CANVAS_ID, "name": "Shared", "description": None,
        "owner_id": USER_A, "updated_at": "2024-01-01",
    }
    collab_row = {
        "canvas_id": CANVAS_ID,
        "permission": "view",
        "joined_at": "2024-01-01",
        "canvases": canvas_data,
    }
    responses = [
        MagicMock(data=[collab_row]),          # canvas_collaborators join query
        MagicMock(data=[{"canvas_id": CANVAS_ID}]),  # canvas_datasets count
    ]
    admin = _make_admin()
    with _ctx(USER_B, responses=responses, admin=admin) as (client, _, _t):
        r = client.get("/api/canvases/shared")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["id"] == CANVAS_ID
    assert body[0]["permission"] == "view"


def test_list_shared_canvases_empty():
    with _ctx(USER_B, responses=[MagicMock(data=[])]) as (client, _, _t):
        r = client.get("/api/canvases/shared")
    assert r.status_code == 200
    assert r.json() == []


# ---------------------------------------------------------------------------
# POST /api/canvases — create_canvas
# ---------------------------------------------------------------------------

def test_create_canvas():
    new_canvas = {
        "id": CANVAS_ID, "owner_id": USER_A, "name": "New Canvas",
        "description": None, "share_permission": None,
        "created_at": "2024-01-01", "updated_at": "2024-01-01",
    }
    with _ctx(USER_A, responses=[MagicMock(data=[new_canvas])]) as (client, _, _t):
        r = client.post("/api/canvases", json={"name": "New Canvas"})
    assert r.status_code == 201
    assert r.json()["id"] == CANVAS_ID
    assert r.json()["has_share_link"] is False


# ---------------------------------------------------------------------------
# POST /api/canvases/join — join_canvas (no permission stored)
# ---------------------------------------------------------------------------

def _make_join_supabase(canvas_row, owner_row=None):
    """Sequences two maybe_single().execute() calls on the canvases table."""
    sb = MagicMock()
    call_count = {"n": 0}
    rows = [canvas_row, owner_row]

    def _table(name):
        t = MagicMock()
        for m in ["select", "insert", "update", "delete", "upsert", "eq",
                  "order", "range", "limit", "single", "maybe_single"]:
            getattr(t, m).return_value = t
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

    sb.table.side_effect = _table
    return sb


def test_join_canvas_no_share_permission():
    """Canvas exists but share_permission is None → 422."""
    from main import app

    supabase = _make_join_supabase(
        canvas_row={"id": CANVAS_ID, "share_permission": None},
        owner_row=None,
    )

    async def _user():
        return USER_B

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.canvases.get_supabase_client", return_value=supabase):
            r = TestClient(app, raise_server_exceptions=False).post(
                "/api/canvases/join", json={"token": "sometoken"}
            )
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/canvases/{canvas_id} — get_canvas
# ---------------------------------------------------------------------------

def _owner_check_response(owner_id):
    return MagicMock(data={"owner_id": owner_id})


def test_get_canvas_as_owner():
    """Owner gets full canvas data including share_token."""
    canvas_detail = {
        "id": CANVAS_ID, "name": "C", "description": None,
        "owner_id": USER_A, "share_token": "tok123",
        "share_permission": "view", "created_at": "2024-01-01", "updated_at": "2024-01-01",
    }
    responses = [
        _owner_check_response(USER_A),   # get_canvas_permission → canvases (owner check)
        MagicMock(data=canvas_detail),   # canvas detail query
        MagicMock(data=[]),              # canvas_datasets
    ]
    with _ctx(USER_A, responses=responses) as (client, _, _t):
        r = client.get(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == CANVAS_ID
    assert "share_token" in body


def test_get_canvas_as_collaborator_hides_share_token():
    """Collaborator sees canvas data but not share_token."""
    collab_perm = MagicMock(data={"permission": "view"})
    canvas_detail = {
        "id": CANVAS_ID, "name": "C", "description": None,
        "owner_id": USER_A, "share_token": "tok123",
        "share_permission": "view", "created_at": "2024-01-01", "updated_at": "2024-01-01",
    }
    responses = [
        MagicMock(data={"owner_id": USER_A}),  # get_canvas_permission: canvas owner_id (not USER_B)
        collab_perm,                           # get_canvas_permission: collaborator lookup
        MagicMock(data=canvas_detail),         # canvas detail
        MagicMock(data=[]),                    # canvas_datasets
    ]
    with _ctx(USER_B, responses=responses) as (client, _, _t):
        r = client.get(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 200
    assert "share_token" not in r.json()


def test_get_canvas_no_access():
    """User with no permission → 403."""
    responses = [
        MagicMock(data={"owner_id": USER_A}),  # canvas lookup — different owner
        MagicMock(data=None),                  # no collaborator row
    ]
    with _ctx(USER_B, responses=responses) as (client, _, _t):
        r = client.get(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 403


def test_get_canvas_not_found_after_permission():
    """Canvas not found in detail query after permission passes → 404."""
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        responses = [
            MagicMock(data=None),  # canvas single() returns no data
        ]
        with _ctx(USER_A, responses=responses) as (client, _, _t):
            r = client.get(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/canvases/{canvas_id} — update_canvas
# ---------------------------------------------------------------------------

def test_update_canvas_success():
    updated = {
        "id": CANVAS_ID, "name": "Renamed", "description": None,
        "owner_id": USER_A, "share_permission": None,
    }
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=[updated])]) as (client, _, _t):
            r = client.patch(f"/api/canvases/{CANVAS_ID}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_update_canvas_no_fields():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A) as (client, _, _t):
            r = client.patch(f"/api/canvases/{CANVAS_ID}", json={})
    assert r.status_code == 400


def test_update_canvas_no_permission():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="view")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.patch(f"/api/canvases/{CANVAS_ID}", json={"name": "X"})
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id} — delete_canvas
# ---------------------------------------------------------------------------

def test_delete_canvas_success():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=[])]) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 204


def test_delete_canvas_not_owner():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="edit")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/canvases/{canvas_id}/share — generate_share_link
# ---------------------------------------------------------------------------

def test_generate_share_link_success():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=[])]) as (client, _, _t):
            r = client.post(f"/api/canvases/{CANVAS_ID}/share", json={"permission": "view"})
    assert r.status_code == 200
    body = r.json()
    assert "share_token" in body
    assert body["share_permission"] == "view"


def test_generate_share_link_not_owner():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="edit")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.post(f"/api/canvases/{CANVAS_ID}/share", json={"permission": "view"})
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id}/share — revoke_share_link
# ---------------------------------------------------------------------------

def test_revoke_share_link_success():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=[])]) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}/share")
    assert r.status_code == 204


def test_revoke_share_link_not_owner():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="view")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}/share")
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/canvases/{canvas_id}/collaborators — list_collaborators
# ---------------------------------------------------------------------------

def test_list_collaborators_success():
    collab_rows = [{"user_id": COLLAB_ID, "permission": "view", "joined_at": "2024-01-01"}]
    admin = _make_admin()
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=collab_rows)], admin=admin) as (client, _, _t):
            r = client.get(f"/api/canvases/{CANVAS_ID}/collaborators")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["user_id"] == COLLAB_ID


def test_list_collaborators_not_owner():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="view")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.get(f"/api/canvases/{CANVAS_ID}/collaborators")
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id}/collaborators/{collab_user_id}
# ---------------------------------------------------------------------------

def test_remove_collaborator_success():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        with _ctx(USER_A, responses=[MagicMock(data=[])]) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}/collaborators/{COLLAB_ID}")
    assert r.status_code == 204


def test_remove_collaborator_not_owner():
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="edit")):
        with _ctx(USER_B) as (client, _, _t):
            r = client.delete(f"/api/canvases/{CANVAS_ID}/collaborators/{COLLAB_ID}")
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# get_canvas_permission — direct coverage of helper (lines 36-57)
# ---------------------------------------------------------------------------

def test_get_canvas_permission_owner():
    """Owner path in get_canvas_permission: GET canvas returns 200 with share_token visible."""
    canvas_detail = {
        "id": CANVAS_ID, "name": "C", "description": None,
        "owner_id": USER_A, "share_token": "tok",
        "share_permission": None, "created_at": "2024-01-01", "updated_at": "2024-01-01",
    }
    responses = [
        _owner_check_response(USER_A),
        MagicMock(data=canvas_detail),
        MagicMock(data=[]),
    ]
    with _ctx(USER_A, responses=responses) as (client, _, _t):
        r = client.get(f"/api/canvases/{CANVAS_ID}")
    assert r.status_code == 200
    assert "share_token" in r.json()


def test_get_canvas_permission_canvas_not_found():
    """Canvas not in DB (maybe_single returns None) → get_canvas returns 403 (covers lines 41-42)."""
    from main import app
    sb, t = _make_table()
    t.execute.return_value = None  # maybe_single returning None → canvas not found

    async def _user():
        return USER_A

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.canvases.get_supabase_client", return_value=sb):
            r = TestClient(app, raise_server_exceptions=False).get(f"/api/canvases/{CANVAS_ID}")
    finally:
        app.dependency_overrides.pop(get_user_id, None)
    assert r.status_code == 403


def test_list_shared_canvases_null_owner_id():
    """Shared canvas with owner_id=None hits the get_owner_email null-guard and returns 200 with owner email as None."""
    canvas_data = {
        "id": CANVAS_ID, "name": "Shared", "description": None,
        "owner_id": None,
        "updated_at": "2024-01-01",
    }
    collab_row = {
        "canvas_id": CANVAS_ID, "permission": "view",
        "joined_at": "2024-01-01", "canvases": canvas_data,
    }
    responses = [
        MagicMock(data=[collab_row]),
        MagicMock(data=[]),
    ]
    admin = _make_admin()
    with _ctx(USER_B, responses=responses, admin=admin) as (client, _, _t):
        r = client.get("/api/canvases/shared")
    assert r.status_code == 200


def test_list_shared_canvases_admin_exception():
    """Admin email lookup raising an exception → graceful None (lines 147-148)."""
    canvas_data = {
        "id": CANVAS_ID, "name": "Shared", "description": None,
        "owner_id": USER_A, "updated_at": "2024-01-01",
    }
    collab_row = {
        "canvas_id": CANVAS_ID, "permission": "view",
        "joined_at": "2024-01-01", "canvases": canvas_data,
    }
    responses = [
        MagicMock(data=[collab_row]),
        MagicMock(data=[]),
    ]
    admin = MagicMock()
    admin.auth.admin.get_user_by_id.side_effect = RuntimeError("auth service down")
    with _ctx(USER_B, responses=responses, admin=admin) as (client, _, _t):
        r = client.get("/api/canvases/shared")
    assert r.status_code == 200
    assert r.json()[0]["owner"]["email"] is None
