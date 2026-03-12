"""
Tests for canvas_ws.py — WebSocket endpoint and DB helper functions.

Approach:
- DB helper functions (validate_jwt, get_canvas_permission, load_canvas_elements,
  upsert_element, insert_element, patch_element, delete_element) are tested with
  mocked Supabase/admin clients.
- The WS endpoint is tested via starlette's TestClient WebSocket support, with
  ConnectionManager, LockManager, and Redis all replaced by mocks.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from starlette.testclient import TestClient
from fastapi import FastAPI

import app.api.ws.canvas_ws as ws_module
from app.api.ws.canvas_ws import (
    validate_jwt,
    get_canvas_permission,
    get_user_display,
    load_canvas_elements,
    upsert_element,
    insert_element,
    patch_element,
    delete_element,
    router,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_supabase_table(data=None, single_data=None):
    """Returns a mock supabase client whose .table() chain returns given data."""
    table = MagicMock()
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.upsert.return_value = table
    table.delete.return_value = table
    table.eq.return_value = table
    table.execute.return_value = MagicMock(data=data if data is not None else [])
    table.maybe_single.return_value = table
    if single_data is not None:
        table.execute.return_value = MagicMock(data=single_data)
    client = MagicMock()
    client.table.return_value = table
    return client, table


def make_admin_client(user_id=None):
    admin = MagicMock()
    user = MagicMock()
    user.id = user_id
    resp = MagicMock()
    resp.user = user if user_id else None
    admin.auth.get_user.return_value = resp
    return admin


# ---------------------------------------------------------------------------
# validate_jwt
# ---------------------------------------------------------------------------

async def test_validate_jwt_valid():
    admin = make_admin_client("user-123")
    with patch("app.api.ws.canvas_ws.get_supabase_admin_client", return_value=admin):
        uid = await validate_jwt("valid-token")
    assert uid == "user-123"


async def test_validate_jwt_invalid():
    admin = make_admin_client(None)
    with patch("app.api.ws.canvas_ws.get_supabase_admin_client", return_value=admin):
        uid = await validate_jwt("bad-token")
    assert uid is None


async def test_validate_jwt_exception():
    admin = MagicMock()
    admin.auth.get_user.side_effect = Exception("network error")
    with patch("app.api.ws.canvas_ws.get_supabase_admin_client", return_value=admin):
        uid = await validate_jwt("token")
    assert uid is None


# ---------------------------------------------------------------------------
# get_canvas_permission
# ---------------------------------------------------------------------------

async def test_get_canvas_permission_owner():
    client, _ = make_supabase_table(single_data={"owner_id": "u1"})
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        perm = await get_canvas_permission("c1", "u1")
    assert perm == "owner"


async def test_get_canvas_permission_collab_edit():
    canvas_client, canvas_table = make_supabase_table(single_data={"owner_id": "owner"})
    collab_table = MagicMock()
    collab_table.select.return_value = collab_table
    collab_table.eq.return_value = collab_table
    collab_table.maybe_single.return_value = collab_table
    collab_table.execute.return_value = MagicMock(data={"permission": "edit"})

    def table_router(name):
        if name == "canvases":
            return canvas_table
        return collab_table

    canvas_client.table.side_effect = table_router
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=canvas_client):
        perm = await get_canvas_permission("c1", "u2")
    assert perm == "edit"


async def test_get_canvas_permission_no_canvas():
    client, _ = make_supabase_table(single_data=None)
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        perm = await get_canvas_permission("c1", "u1")
    assert perm is None


async def test_get_canvas_permission_no_collab():
    canvas_client, canvas_table = make_supabase_table(single_data={"owner_id": "owner"})
    collab_table = MagicMock()
    collab_table.select.return_value = collab_table
    collab_table.eq.return_value = collab_table
    collab_table.maybe_single.return_value = collab_table
    collab_table.execute.return_value = MagicMock(data=None)

    def table_router(name):
        if name == "canvases":
            return canvas_table
        return collab_table

    canvas_client.table.side_effect = table_router
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=canvas_client):
        perm = await get_canvas_permission("c1", "u2")
    assert perm is None


# ---------------------------------------------------------------------------
# get_user_display
# ---------------------------------------------------------------------------

async def test_get_user_display_from_profile():
    client, _ = make_supabase_table(
        single_data={"display_name": "Alice", "avatar_color": "#FF0000"}
    )
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        result = await get_user_display("user-abc")
    assert result == {"display_name": "Alice", "color": "#FF0000"}


async def test_get_user_display_fallback():
    client, _ = make_supabase_table(single_data=None)
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        result = await get_user_display("abcd1234")
    assert result["display_name"] == "User-abcd"
    assert result["color"] == "#4F46E5"


async def test_get_user_display_exception_fallback():
    client = MagicMock()
    client.table.side_effect = Exception("db error")
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        result = await get_user_display("abcd1234")
    assert result["display_name"] == "User-abcd"


# ---------------------------------------------------------------------------
# DB helpers — load / upsert / insert / patch / delete
# ---------------------------------------------------------------------------

async def test_load_canvas_elements():
    elements = [{"id": "e1"}, {"id": "e2"}]
    client, _ = make_supabase_table(data=elements)
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        result = await load_canvas_elements("c1")
    assert result == elements


async def test_load_canvas_elements_empty():
    client, _ = make_supabase_table(data=None)
    client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=None)
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        result = await load_canvas_elements("c1")
    assert result == []


async def test_upsert_element():
    client, table = make_supabase_table()
    element = {
        "id": "e1", "type": "chart",
        "position": {"x": 0, "y": 0},
        "size": {"width": 400, "height": 300},
        "data": {"chartType": "bar"},
        "zIndex": 1,
    }
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await upsert_element("c1", element)
    table.upsert.assert_called_once()
    upserted = table.upsert.call_args.args[0]
    assert upserted["id"] == "e1"
    assert upserted["canvas_id"] == "c1"
    assert upserted["element_type"] == "chart"


async def test_upsert_element_uses_element_type_key():
    """element_type key (from DB) should also be accepted."""
    client, table = make_supabase_table()
    element = {
        "id": "e1", "element_type": "table",
        "position": {"x": 0, "y": 0},
        "size": {"width": 400, "height": 300},
        "z_index": 2,
    }
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await upsert_element("c1", element)
    upserted = table.upsert.call_args.args[0]
    assert upserted["element_type"] == "table"
    assert upserted["z_index"] == 2


async def test_insert_element():
    client, table = make_supabase_table()
    element = {
        "id": "e1", "type": "chart",
        "position": {"x": 0, "y": 0},
        "size": {"width": 400, "height": 300},
    }
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await insert_element("c1", element, "user1")
    table.insert.assert_called_once()
    inserted = table.insert.call_args.args[0]
    assert inserted["created_by"] == "user1"
    assert inserted["canvas_id"] == "c1"


async def test_patch_element_position():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await patch_element("e1", {"position": {"x": 10, "y": 20}})
    table.update.assert_called_once_with({"position": {"x": 10, "y": 20}})
    table.eq.assert_called_once_with("id", "e1")


async def test_patch_element_data_only():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await patch_element("e1", {"data": {"chartType": "pie"}})
    table.update.assert_called_once_with({"data": {"chartType": "pie"}})


async def test_patch_element_camel_case_zindex():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await patch_element("e1", {"zIndex": 5})
    table.update.assert_called_once_with({"z_index": 5})


async def test_patch_element_type_maps_to_element_type():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await patch_element("e1", {"type": "text"})
    table.update.assert_called_once_with({"element_type": "text"})


async def test_patch_element_unknown_key_ignored():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await patch_element("e1", {"unknownField": "value"})
    # No known keys → update never called
    table.update.assert_not_called()


async def test_delete_element():
    client, table = make_supabase_table()
    with patch("app.api.ws.canvas_ws.get_supabase_client", return_value=client):
        await delete_element("e1")
    table.delete.assert_called_once()
    table.eq.assert_called_once_with("id", "e1")


# ---------------------------------------------------------------------------
# WebSocket endpoint — integration via TestClient
# ---------------------------------------------------------------------------

def make_ws_test_app():
    """Create a minimal FastAPI app with only the WS router mounted."""
    app = FastAPI()
    app.include_router(router)
    return app


def make_mock_manager(presence=None, locks=None):
    mgr = AsyncMock()
    mgr.connect = AsyncMock()
    mgr.disconnect = AsyncMock()
    mgr.broadcast = AsyncMock()
    mgr.send_to_user = AsyncMock()
    mgr.get_presence = AsyncMock(return_value=presence or [])
    return mgr


def make_mock_lock_mgr(locks=None):
    lm = AsyncMock()
    lm.acquire = AsyncMock(return_value=True)
    lm.release = AsyncMock(return_value=True)
    lm.renew = AsyncMock(return_value=True)
    lm.get_holder = AsyncMock(return_value=None)
    lm.release_all_for_user = AsyncMock(return_value=[])
    lm.get_all_locks = AsyncMock(return_value=locks or {})
    return lm


def ws_patches(user_id="u1", permission="owner", elements=None, locks=None, presence=None):
    """Returns a context manager that patches all external dependencies."""
    mock_redis = AsyncMock()
    mock_redis.hset = AsyncMock()
    mock_manager = make_mock_manager(presence=presence or [{"user_id": "u1"}], locks=locks)
    mock_lock_mgr = make_mock_lock_mgr(locks=locks)

    return {
        "validate_jwt": patch("app.api.ws.canvas_ws.validate_jwt", new=AsyncMock(return_value=user_id)),
        "get_canvas_permission": patch("app.api.ws.canvas_ws.get_canvas_permission", new=AsyncMock(return_value=permission)),
        "get_user_display": patch("app.api.ws.canvas_ws.get_user_display", new=AsyncMock(return_value={"display_name": "Alice", "color": "#F00"})),
        "load_canvas_elements": patch("app.api.ws.canvas_ws.load_canvas_elements", new=AsyncMock(return_value=elements or [])),
        "_get_redis": patch("app.api.ws.canvas_ws._get_redis", new=AsyncMock(return_value=mock_redis)),
        "_get_manager": patch("app.api.ws.canvas_ws._get_manager", new=AsyncMock(return_value=mock_manager)),
        "_get_lock_manager": patch("app.api.ws.canvas_ws._get_lock_manager", new=AsyncMock(return_value=mock_lock_mgr)),
        "_manager": patch("app.api.ws.canvas_ws._manager", mock_manager),
        "_lock_manager": patch("app.api.ws.canvas_ws._lock_manager", mock_lock_mgr),
        "_redis": patch("app.api.ws.canvas_ws._redis", mock_redis),
        "_manager_obj": mock_manager,
        "_lock_mgr_obj": mock_lock_mgr,
        "_redis_obj": mock_redis,
    }


class PatchContext:
    """Helper to enter/exit multiple patches at once and expose mock objects."""
    def __init__(self, patches_dict):
        self._patches = {k: v for k, v in patches_dict.items() if not k.startswith("_") or k in ("_manager", "_lock_manager", "_redis")}
        self._mocks = {k: v for k, v in patches_dict.items() if k.endswith("_obj")}
        self._entered = []

    def __enter__(self):
        for k, p in self._patches.items():
            self._entered.append(p.__enter__())
        return self

    def __exit__(self, *args):
        for p in reversed(list(self._patches.values())):
            p.__exit__(*args)


def run_ws_test(handler, user_id="u1", permission="owner", elements=None, locks=None, presence=None):
    """
    Convenience: sets up all patches, creates a test client, runs `handler(client, mocks)`.
    mocks = dict with _manager_obj, _lock_mgr_obj, _redis_obj.
    """
    p = ws_patches(user_id=user_id, permission=permission, elements=elements, locks=locks, presence=presence)
    patches_to_enter = {k: v for k, v in p.items() if hasattr(v, '__enter__')}
    mocks = {k: v for k, v in p.items() if k.endswith("_obj")}

    entered = []
    try:
        for patch_cm in patches_to_enter.values():
            patch_cm.__enter__()
            entered.append(patch_cm)

        app = make_ws_test_app()
        client = TestClient(app, raise_server_exceptions=True)
        handler(client, mocks)
    finally:
        for patch_cm in reversed(entered):
            patch_cm.__exit__(None, None, None)


# ---------------------------------------------------------------------------
# WS endpoint — auth / permission
# ---------------------------------------------------------------------------

def test_ws_rejects_missing_token():
    app = make_ws_test_app()
    client = TestClient(app, raise_server_exceptions=False)
    with pytest.raises(Exception):
        # No token param → FastAPI 422 unprocessable
        with client.websocket_connect("/ws/canvas/c1"):
            pass


def test_ws_rejects_invalid_jwt():
    p = ws_patches(user_id=None)
    patches_to_enter = {k: v for k, v in p.items() if hasattr(v, '__enter__')}
    entered = []
    try:
        for patch_cm in patches_to_enter.values():
            patch_cm.__enter__()
            entered.append(patch_cm)

        app = make_ws_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/canvas/c1?token=bad"):
                pass
    finally:
        for patch_cm in reversed(entered):
            patch_cm.__exit__(None, None, None)


def test_ws_rejects_no_permission():
    p = ws_patches(permission=None)
    patches_to_enter = {k: v for k, v in p.items() if hasattr(v, '__enter__')}
    entered = []
    try:
        for patch_cm in patches_to_enter.values():
            patch_cm.__enter__()
            entered.append(patch_cm)

        app = make_ws_test_app()
        client = TestClient(app, raise_server_exceptions=False)
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/canvas/c1?token=tok"):
                pass
    finally:
        for patch_cm in reversed(entered):
            patch_cm.__exit__(None, None, None)


# ---------------------------------------------------------------------------
# WS endpoint — canvas_state on join
# ---------------------------------------------------------------------------

def test_ws_sends_canvas_state_on_join():
    elements = [{"id": "e1", "type": "chart"}]
    locks = {"e1": "u2"}
    presence = [{"user_id": "u1", "display_name": "Alice", "color": "#F00"}]

    def handler(client, mocks):
        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "canvas_state"
            assert msg["elements"] == elements
            assert msg["locks"] == locks
            assert isinstance(msg["presence"], list)

    run_ws_test(handler, elements=elements, locks=locks, presence=presence)


# ---------------------------------------------------------------------------
# WS endpoint — message dispatch
# ---------------------------------------------------------------------------

def test_ws_cursor_move_broadcast():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()  # canvas_state
            ws.send_json({"type": "cursor_move", "x": 100, "y": 200})
        # After disconnect, broadcast should have been called for cursor_update
        # (called as part of message handling)
        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("cursor_update" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_lock_request_granted():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.acquire.return_value = True

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()  # canvas_state
            ws.send_json({"type": "element_lock_request", "element_id": "e1"})

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("lock_granted" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_lock_request_denied():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.acquire.return_value = False
        lm.get_holder.return_value = "u2"

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()  # canvas_state
            ws.send_json({"type": "element_lock_request", "element_id": "e1"})

        mgr.send_to_user.assert_awaited()
        args = mgr.send_to_user.await_args
        msg = args.args[2]
        assert msg["type"] == "lock_denied"
        assert msg["locked_by"] == "u2"

    run_ws_test(handler)


def test_ws_element_lock_renew():
    def handler(client, mocks):
        lm = mocks["_lock_mgr_obj"]

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()
            ws.send_json({"type": "element_lock_renew", "element_id": "e1"})

        lm.renew.assert_awaited_with("c1", "e1", "u1")

    run_ws_test(handler)


def test_ws_element_unlock():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.release.return_value = True

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()
            ws.send_json({"type": "element_unlock", "element_id": "e1"})

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("lock_released" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_move_broadcast():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()
            ws.send_json({"type": "element_move", "element_id": "e1", "position": {"x": 5, "y": 10}})

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("element_moved" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_commit():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.release.return_value = True

        with patch("app.api.ws.canvas_ws.upsert_element", new=AsyncMock()) as mock_upsert:
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({
                    "type": "element_commit",
                    "element_id": "e1",
                    "id": "e1",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 400, "height": 300},
                })

            mock_upsert.assert_awaited_once()
            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert any("element_committed" in c for c in calls)
            assert any("lock_released" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_commit_broadcasts_lock_released_only_when_held():
    """lock_released should only broadcast when release returns True."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.release.return_value = False  # lock not held by this user

        with patch("app.api.ws.canvas_ws.upsert_element", new=AsyncMock()):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({
                    "type": "element_commit",
                    "element_id": "e1",
                    "id": "e1",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 400, "height": 300},
                })

            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert not any("lock_released" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_add():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        element = {
            "id": "e1", "type": "chart",
            "position": {"x": 0, "y": 0},
            "size": {"width": 400, "height": 300},
        }
        with patch("app.api.ws.canvas_ws.insert_element", new=AsyncMock()) as mock_insert:
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({"type": "element_add", "element": element})

            mock_insert.assert_awaited_once()
            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert any("element_added" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_add_broadcasts_even_if_db_fails():
    """Element add should broadcast even if insert_element raises."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        element = {"id": "e1", "type": "chart", "position": {"x": 0, "y": 0}, "size": {"width": 400, "height": 300}}
        with patch("app.api.ws.canvas_ws.insert_element", new=AsyncMock(side_effect=Exception("db error"))):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({"type": "element_add", "element": element})

            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert any("element_added" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_remove():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with patch("app.api.ws.canvas_ws.delete_element", new=AsyncMock()) as mock_delete:
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({"type": "element_remove", "element_id": "e1"})

            mock_delete.assert_awaited_once_with("e1")
            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert any("element_removed" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_update():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with patch("app.api.ws.canvas_ws.patch_element", new=AsyncMock()) as mock_patch:
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({
                    "type": "element_update",
                    "element_id": "e1",
                    "updates": {"data": {"chartType": "line"}},
                })

            mock_patch.assert_awaited_once_with("e1", {"data": {"chartType": "line"}})
            calls = [str(c) for c in mgr.broadcast.await_args_list]
            assert any("element_updated" in c for c in calls)

    run_ws_test(handler)


# ---------------------------------------------------------------------------
# WS endpoint — view-only user
# ---------------------------------------------------------------------------

def test_ws_view_only_ignores_mutation_messages():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()
            # All mutation messages should be silently ignored
            for msg_type, extra in [
                ("element_lock_request", {"element_id": "e1"}),
                ("element_move", {"element_id": "e1", "position": {"x": 0, "y": 0}}),
                ("element_add", {"element": {"id": "e1", "type": "chart", "position": {"x": 0, "y": 0}, "size": {"width": 400, "height": 300}}}),
                ("element_remove", {"element_id": "e1"}),
                ("element_update", {"element_id": "e1", "updates": {}}),
                ("element_commit", {"element_id": "e1", "id": "e1", "position": {"x": 0, "y": 0}, "size": {"width": 400, "height": 300}}),
                ("element_unlock", {"element_id": "e1"}),
                ("element_lock_renew", {"element_id": "e1"}),
            ]:
                ws.send_json({"type": msg_type, **extra})

        lm.acquire.assert_not_awaited()
        lm.release.assert_not_awaited()
        lm.renew.assert_not_awaited()

    run_ws_test(handler, permission="view")


# ---------------------------------------------------------------------------
# WS endpoint — disconnect cleanup
# ---------------------------------------------------------------------------

def test_ws_disconnect_releases_locks_and_broadcasts_presence():
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.release_all_for_user.return_value = ["e1", "e2"]

        with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
            ws.receive_json()
            # Close the connection

        lm.release_all_for_user.assert_awaited_once_with("c1", "u1")
        mgr.disconnect.assert_awaited_once_with("c1", "u1")

        # lock_released should have been broadcast for each released element
        calls = [str(c) for c in mgr.broadcast.await_args_list]
        lock_released_calls = [c for c in calls if "lock_released" in c]
        assert len(lock_released_calls) >= 2

        # presence_update should have been broadcast
        assert any("presence_update" in c for c in calls)

    run_ws_test(handler)


# ---------------------------------------------------------------------------
# Lazy singleton initialisation (_get_redis / _get_manager / _get_lock_manager)
# ---------------------------------------------------------------------------

async def test_get_redis_lazy_init():
    """_get_redis creates a new AsyncRedis instance when _redis is None."""
    import app.api.ws.canvas_ws as m
    orig = m._redis
    m._redis = None
    try:
        with patch("app.api.ws.canvas_ws.AsyncRedis") as mock_cls:
            fake = AsyncMock()
            mock_cls.from_url.return_value = fake
            result = await m._get_redis()
            assert result is fake
            mock_cls.from_url.assert_called_once()
            # Second call reuses the cached instance
            result2 = await m._get_redis()
            assert result2 is fake
            assert mock_cls.from_url.call_count == 1
    finally:
        m._redis = orig


async def test_get_manager_lazy_init():
    """_get_manager creates a new ConnectionManager when _manager is None."""
    import app.api.ws.canvas_ws as m
    orig_mgr, orig_redis = m._manager, m._redis
    m._manager = None
    fake_redis = AsyncMock()
    m._redis = fake_redis
    try:
        result = await m._get_manager()
        assert isinstance(result, __import__('app.services.connection_manager', fromlist=['ConnectionManager']).ConnectionManager)
        assert m._manager is result
        # Second call returns cached
        result2 = await m._get_manager()
        assert result2 is result
    finally:
        m._manager = orig_mgr
        m._redis = orig_redis


async def test_get_lock_manager_lazy_init():
    """_get_lock_manager creates a new LockManager when _lock_manager is None."""
    import app.api.ws.canvas_ws as m
    orig_lm, orig_redis = m._lock_manager, m._redis
    m._lock_manager = None
    fake_redis = AsyncMock()
    m._redis = fake_redis
    try:
        result = await m._get_lock_manager()
        assert isinstance(result, __import__('app.services.lock_manager', fromlist=['LockManager']).LockManager)
        assert m._lock_manager is result
        result2 = await m._get_lock_manager()
        assert result2 is result
    finally:
        m._lock_manager = orig_lm
        m._redis = orig_redis


# ---------------------------------------------------------------------------
# Exception handlers in the WS endpoint and message dispatch
# ---------------------------------------------------------------------------

def test_ws_message_handler_exception_is_caught():
    """If _handle_message raises, the connection stays alive and processes next message."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with patch("app.api.ws.canvas_ws._handle_message", new=AsyncMock(side_effect=Exception("boom"))):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()  # canvas_state
                ws.send_json({"type": "cursor_move", "x": 0, "y": 0})
                # Connection should still be open — can send another message
                ws.send_json({"type": "cursor_move", "x": 1, "y": 1})

    run_ws_test(handler)


def test_ws_element_commit_db_error_still_broadcasts():
    """upsert_element failure during element_commit does not prevent the broadcast."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]
        lm = mocks["_lock_mgr_obj"]
        lm.release.return_value = False

        with patch("app.api.ws.canvas_ws.upsert_element", new=AsyncMock(side_effect=Exception("db error"))):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({
                    "type": "element_commit",
                    "element_id": "e1",
                    "id": "e1",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 400, "height": 300},
                })

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("element_committed" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_remove_db_error_still_broadcasts():
    """delete_element failure during element_remove does not prevent the broadcast."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with patch("app.api.ws.canvas_ws.delete_element", new=AsyncMock(side_effect=Exception("db error"))):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({"type": "element_remove", "element_id": "e1"})

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("element_removed" in c for c in calls)

    run_ws_test(handler)


def test_ws_element_update_db_error_still_broadcasts():
    """patch_element failure during element_update does not prevent the broadcast."""
    def handler(client, mocks):
        mgr = mocks["_manager_obj"]

        with patch("app.api.ws.canvas_ws.patch_element", new=AsyncMock(side_effect=Exception("db error"))):
            with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                ws.receive_json()
                ws.send_json({
                    "type": "element_update",
                    "element_id": "e1",
                    "updates": {"data": {"chartType": "line"}},
                })

        calls = [str(c) for c in mgr.broadcast.await_args_list]
        assert any("element_updated" in c for c in calls)

    run_ws_test(handler)


def test_ws_outer_exception_closes_cleanly():
    """Non-WebSocketDisconnect exception during setup hits the outer except block."""
    def handler(client, mocks):
        # load_canvas_elements is called after accept() — having it raise triggers
        # the outer `except Exception` handler; server closes the WS with code 1011
        with patch("app.api.ws.canvas_ws.load_canvas_elements",
                   new=AsyncMock(side_effect=RuntimeError("unexpected db failure"))):
            try:
                with client.websocket_connect("/ws/canvas/c1?token=tok") as ws:
                    ws.receive_json()  # server closed — will raise WebSocketDisconnect
            except Exception:
                pass  # expected

    run_ws_test(handler)
