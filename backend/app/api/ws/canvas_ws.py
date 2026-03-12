"""
WebSocket endpoint for real-time canvas collaboration.

Protocol: JSON messages with a `type` field. See overview.md for full spec.
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis as AsyncRedis

from app.core.config import get_settings
from app.database.supabase_client import get_supabase_client, get_supabase_admin_client
from app.services.connection_manager import ConnectionManager
from app.services.lock_manager import LockManager

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# Singletons — initialised lazily on first WS connection
_redis: Optional[AsyncRedis] = None
_manager: Optional[ConnectionManager] = None
_lock_manager: Optional[LockManager] = None


async def _get_redis() -> AsyncRedis:
    global _redis
    if _redis is None:
        _redis = AsyncRedis.from_url(settings.redis_url, decode_responses=False)
    return _redis


async def _get_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager(await _get_redis())
    return _manager


async def _get_lock_manager() -> LockManager:
    global _lock_manager
    if _lock_manager is None:
        _lock_manager = LockManager(await _get_redis())
    return _lock_manager


# ---------------------------------------------------------------------------
# Auth & permission helpers
# ---------------------------------------------------------------------------

async def validate_jwt(token: str) -> Optional[str]:
    """Validate Supabase JWT, return user_id or None."""
    try:
        admin = get_supabase_admin_client()
        response = await asyncio.to_thread(lambda: admin.auth.get_user(token))
        if response.user:
            return response.user.id
        return None
    except Exception:
        return None


async def get_canvas_permission(canvas_id: str, user_id: str) -> Optional[str]:
    """Returns 'owner', 'edit', 'view', or None."""
    supabase = get_supabase_client()
    canvas = await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .select("owner_id")
        .eq("id", canvas_id)
        .maybe_single()
        .execute()
    )
    if not canvas.data:
        return None
    if canvas.data["owner_id"] == user_id:
        return "owner"
    collab = await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .select("permission")
        .eq("canvas_id", canvas_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if collab.data:
        return collab.data["permission"]
    return None


async def get_user_display(user_id: str) -> dict:
    """Get display name and color from profiles table, with fallback."""
    supabase = get_supabase_client()
    try:
        profile = await asyncio.to_thread(
            lambda: supabase.table("profiles")
            .select("display_name, avatar_color")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if profile.data:
            return {
                "display_name": profile.data["display_name"],
                "color": profile.data["avatar_color"],
            }
    except Exception:
        pass
    # Fallback
    return {"display_name": f"User-{user_id[:4]}", "color": "#4F46E5"}


# ---------------------------------------------------------------------------
# DB operations for canvas elements
# ---------------------------------------------------------------------------

async def load_canvas_elements(canvas_id: str) -> list[dict]:
    supabase = get_supabase_client()
    result = await asyncio.to_thread(
        lambda: supabase.table("canvas_elements")
        .select("*")
        .eq("canvas_id", canvas_id)
        .execute()
    )
    return result.data or []


async def upsert_element(canvas_id: str, element: dict) -> None:
    supabase = get_supabase_client()
    await asyncio.to_thread(
        lambda: supabase.table("canvas_elements")
        .upsert({
            "id": element["id"],
            "canvas_id": canvas_id,
            "element_type": element.get("element_type", element.get("type", "chart")),
            "position": element["position"],
            "size": element["size"],
            "data": element.get("data"),
            "z_index": element.get("zIndex", element.get("z_index", 0)),
        })
        .execute()
    )


async def insert_element(canvas_id: str, element: dict, user_id: str) -> None:
    supabase = get_supabase_client()
    await asyncio.to_thread(
        lambda: supabase.table("canvas_elements")
        .insert({
            "id": element["id"],
            "canvas_id": canvas_id,
            "element_type": element.get("element_type", element.get("type", "chart")),
            "position": element["position"],
            "size": element["size"],
            "data": element.get("data"),
            "z_index": element.get("zIndex", element.get("z_index", 0)),
            "created_by": user_id,
        })
        .execute()
    )


async def patch_element(element_id: str, updates: dict) -> None:
    """Partial update — only touches the fields present in `updates`."""
    # Map frontend camelCase keys to DB column names
    column_map = {
        "position": "position",
        "size": "size",
        "data": "data",
        "zIndex": "z_index",
        "z_index": "z_index",
        "element_type": "element_type",
        "type": "element_type",
    }
    patch: dict = {}
    for key, value in updates.items():
        col = column_map.get(key)
        if col:
            patch[col] = value
    if not patch:
        return
    supabase = get_supabase_client()
    await asyncio.to_thread(
        lambda: supabase.table("canvas_elements")
        .update(patch)
        .eq("id", element_id)
        .execute()
    )


async def delete_element(element_id: str) -> None:
    supabase = get_supabase_client()
    await asyncio.to_thread(
        lambda: supabase.table("canvas_elements")
        .delete()
        .eq("id", element_id)
        .execute()
    )


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/canvas/{canvas_id}")
async def canvas_websocket(
    websocket: WebSocket,
    canvas_id: str,
    token: str = Query(...),
):
    # 1. Validate JWT
    user_id = await validate_jwt(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # 2. Check canvas permission
    permission = await get_canvas_permission(canvas_id, user_id)
    if not permission:
        await websocket.close(code=4003, reason="Forbidden")
        return

    # 3. Accept + register connection
    await websocket.accept()
    manager = await _get_manager()
    lock_mgr = await _get_lock_manager()
    await manager.connect(websocket, canvas_id, user_id)

    try:
        # 4. Build and send initial canvas state
        user_display = await get_user_display(user_id)

        # Update presence with display info
        import json
        redis = await _get_redis()
        await redis.hset(
            f"canvas:{canvas_id}:presence",
            user_id,
            json.dumps({
                "user_id": user_id,
                "display_name": user_display["display_name"],
                "color": user_display["color"],
            }),
        )

        elements = await load_canvas_elements(canvas_id)
        locks = await lock_mgr.get_all_locks(canvas_id)
        presence = await manager.get_presence(canvas_id)

        await websocket.send_json({
            "type": "canvas_state",
            "elements": elements,
            "locks": locks,
            "presence": presence,
        })

        # 5. Broadcast presence update to others
        await manager.broadcast(canvas_id, {
            "type": "presence_update",
            "users": presence,
        }, exclude_user=user_id)

        # 6. Message loop
        while True:
            data = await websocket.receive_json()
            try:
                await _handle_message(
                    websocket, canvas_id, user_id, permission, data,
                    manager, lock_mgr,
                )
            except Exception:
                logger.exception(
                    "Error handling message type=%s from user %s",
                    data.get("type"), user_id
                )

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for user %s in canvas %s", user_id, canvas_id)
        await websocket.close(code=1011)
    finally:
        await _handle_disconnect(canvas_id, user_id, manager, lock_mgr)


# ---------------------------------------------------------------------------
# Message dispatch
# ---------------------------------------------------------------------------

async def _handle_message(
    ws: WebSocket,
    canvas_id: str,
    user_id: str,
    permission: str,
    data: dict,
    manager: ConnectionManager,
    lock_mgr: LockManager,
) -> None:
    msg_type = data.get("type")
    is_readonly = permission == "view"

    if msg_type == "cursor_move":
        await manager.broadcast(canvas_id, {
            "type": "cursor_update",
            "user_id": user_id,
            "x": data["x"],
            "y": data["y"],
        }, exclude_user=user_id)

    elif msg_type == "element_lock_request":
        if is_readonly:
            return
        element_id = data["element_id"]
        acquired = await lock_mgr.acquire(canvas_id, element_id, user_id)
        if acquired:
            await manager.broadcast(canvas_id, {
                "type": "lock_granted",
                "element_id": element_id,
                "user_id": user_id,
            })
        else:
            holder = await lock_mgr.get_holder(canvas_id, element_id)
            await manager.send_to_user(canvas_id, user_id, {
                "type": "lock_denied",
                "element_id": element_id,
                "locked_by": holder,
            })

    elif msg_type == "element_lock_renew":
        if is_readonly:
            return
        await lock_mgr.renew(canvas_id, data["element_id"], user_id)

    elif msg_type == "element_unlock":
        if is_readonly:
            return
        released = await lock_mgr.release(canvas_id, data["element_id"], user_id)
        if released:
            await manager.broadcast(canvas_id, {
                "type": "lock_released",
                "element_id": data["element_id"],
            })

    elif msg_type == "element_move":
        if is_readonly:
            return
        await manager.broadcast(canvas_id, {
            "type": "element_moved",
            "element_id": data["element_id"],
            "position": data["position"],
            "user_id": user_id,
        }, exclude_user=user_id)

    elif msg_type == "element_commit":
        if is_readonly:
            return
        try:
            await upsert_element(canvas_id, data)
        except Exception:
            logger.exception("Failed to upsert element %s to DB", data.get("element_id"))
        released = await lock_mgr.release(canvas_id, data["element_id"], user_id)
        if released:
            await manager.broadcast(canvas_id, {
                "type": "lock_released",
                "element_id": data["element_id"],
            })
        await manager.broadcast(canvas_id, {
            "type": "element_committed",
            "element_id": data["element_id"],
            "position": data["position"],
            "size": data.get("size"),
            "data": data.get("data"),
            "user_id": user_id,
        }, exclude_user=user_id)

    elif msg_type == "element_add":
        if is_readonly:
            return
        element = data["element"]
        try:
            await insert_element(canvas_id, element, user_id)
        except Exception:
            logger.exception("Failed to persist element %s to DB", element.get("id"))
        # Always broadcast even if DB write failed so collaborators see the element
        await manager.broadcast(canvas_id, {
            "type": "element_added",
            "element": element,
            "user_id": user_id,
        }, exclude_user=user_id)

    elif msg_type == "element_remove":
        if is_readonly:
            return
        element_id = data["element_id"]
        holder = await lock_mgr.get_holder(canvas_id, element_id)
        if holder is not None and holder != user_id:
            logger.warning(
                "User %s attempted to remove element %s locked by %s",
                user_id, element_id, holder,
            )
            return
        await lock_mgr.release(canvas_id, element_id, user_id)
        try:
            await delete_element(element_id)
        except Exception:
            logger.exception("Failed to delete element %s from DB", element_id)
        await manager.broadcast(canvas_id, {
            "type": "element_removed",
            "element_id": element_id,
            "user_id": user_id,
        }, exclude_user=user_id)

    elif msg_type == "element_update":
        if is_readonly:
            return
        element_id = data["element_id"]
        holder = await lock_mgr.get_holder(canvas_id, element_id)
        if holder is not None and holder != user_id:
            logger.warning(
                "User %s attempted to update element %s locked by %s",
                user_id, element_id, holder,
            )
            return
        try:
            await patch_element(element_id, data["updates"])
        except Exception:
            logger.exception("Failed to patch element %s in DB", element_id)
        await manager.broadcast(canvas_id, {
            "type": "element_updated",
            "element_id": element_id,
            "updates": data["updates"],
            "user_id": user_id,
        }, exclude_user=user_id)


async def _handle_disconnect(
    canvas_id: str,
    user_id: str,
    manager: ConnectionManager,
    lock_mgr: LockManager,
) -> None:
    # 1. Remove from connection pool
    await manager.disconnect(canvas_id, user_id)

    # 2. Release all locks held by this user
    released_elements = await lock_mgr.release_all_for_user(canvas_id, user_id)

    # 3. Broadcast lock releases
    for element_id in released_elements:
        await manager.broadcast(canvas_id, {
            "type": "lock_released",
            "element_id": element_id,
        })

    # 4. Broadcast updated presence
    presence = await manager.get_presence(canvas_id)
    await manager.broadcast(canvas_id, {
        "type": "presence_update",
        "users": presence,
    })
