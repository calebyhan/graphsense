"""
Canvas collaboration endpoints — CRUD, sharing, and collaborator management.
"""

import asyncio
import logging
import secrets
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Auth dependency — requires authenticated user
# ---------------------------------------------------------------------------

async def require_user(user_id: Optional[str] = Depends(get_user_id)) -> str:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


# ---------------------------------------------------------------------------
# Permission helper
# ---------------------------------------------------------------------------

async def get_canvas_permission(canvas_id: str, user_id: str, supabase) -> Optional[str]:
    """Returns 'owner', 'edit', 'view', or None (no access)."""
    canvas = await asyncio.to_thread(
        lambda: supabase.table("canvases").select("owner_id").eq("id", canvas_id).maybe_single().execute()
    )
    canvas_data = canvas.data if canvas is not None else None
    if not canvas_data:
        logger.warning("get_canvas_permission: canvas %s not found", canvas_id)
        return None
    if canvas_data["owner_id"] == user_id:
        return "owner"
    collab = await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .select("permission")
        .eq("canvas_id", canvas_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    collab_data = collab.data if collab is not None else None
    if collab_data:
        return collab_data["permission"]
    logger.warning("get_canvas_permission: user %s has no access to canvas %s", user_id, canvas_id)
    return None


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class CreateCanvasRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateCanvasRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[Dict[str, Any]] = None


class ShareRequest(BaseModel):
    permission: Literal["view", "edit"]


class JoinRequest(BaseModel):
    token: str


# ---------------------------------------------------------------------------
# GET /api/canvases — list owned canvases
# ---------------------------------------------------------------------------

@router.get("", response_model=List[Dict[str, Any]])
async def list_canvases(user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    canvases = await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .select("id, name, description, share_permission, thumbnail, created_at, updated_at")
        .eq("owner_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )

    if not canvases.data:
        return []

    canvas_ids = [c["id"] for c in canvases.data]
    cd_rows = await asyncio.to_thread(
        lambda: supabase.table("canvas_datasets")
        .select("canvas_id")
        .in_("canvas_id", canvas_ids)
        .execute()
    )
    counts_map: Dict[str, int] = {}
    for row in (cd_rows.data or []):
        counts_map[row["canvas_id"]] = counts_map.get(row["canvas_id"], 0) + 1

    return [
        {
            **canvas,
            "has_share_link": canvas["share_permission"] is not None,
            "dataset_count": counts_map.get(canvas["id"], 0),
        }
        for canvas in canvases.data
    ]


# ---------------------------------------------------------------------------
# GET /api/canvases/shared — list canvases shared with me
# ---------------------------------------------------------------------------

@router.get("/shared", response_model=List[Dict[str, Any]])
async def list_shared_canvases(user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    collabs = await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .select("canvas_id, permission, joined_at, canvases(id, name, description, owner_id, thumbnail, updated_at)")
        .eq("user_id", user_id)
        .execute()
    )

    # Fetch owner emails via admin client (service role)
    from app.database.supabase_client import get_supabase_admin_client
    admin = get_supabase_admin_client()

    async def get_owner_email(owner_id: str) -> Optional[str]:
        try:
            resp = await asyncio.to_thread(
                lambda: admin.auth.admin.get_user_by_id(owner_id)
            )
            return resp.user.email if resp.user else None
        except Exception:
            return None

    rows_data = [(row, row.get("canvases") or {}) for row in collabs.data]

    # Batch dataset counts in a single query
    shared_canvas_ids = [canvas.get("id") for _, canvas in rows_data if canvas.get("id")]
    if shared_canvas_ids:
        cd_rows = await asyncio.to_thread(
            lambda: supabase.table("canvas_datasets")
            .select("canvas_id")
            .in_("canvas_id", shared_canvas_ids)
            .execute()
        )
        shared_counts_map: Dict[str, int] = {}
        for r in (cd_rows.data or []):
            shared_counts_map[r["canvas_id"]] = shared_counts_map.get(r["canvas_id"], 0) + 1
    else:
        shared_counts_map = {}

    # Fetch owner emails deduped — one call per unique non-null owner_id
    owner_ids_list = list({canvas.get("owner_id") for _, canvas in rows_data if canvas.get("owner_id") is not None})
    email_results = await asyncio.gather(*[get_owner_email(oid) for oid in owner_ids_list])
    owner_email_map: Dict[str, Optional[str]] = dict(zip(owner_ids_list, email_results))

    return [
        {
            "id": canvas.get("id"),
            "name": canvas.get("name"),
            "description": canvas.get("description"),
            "owner": {
                "id": canvas.get("owner_id"),
                "email": owner_email_map.get(canvas.get("owner_id")) if canvas.get("owner_id") is not None else None,
            },
            "permission": row["permission"],
            "dataset_count": shared_counts_map.get(canvas.get("id"), 0),
            "joined_at": row["joined_at"],
            "updated_at": canvas.get("updated_at"),
            "thumbnail": canvas.get("thumbnail"),
        }
        for row, canvas in rows_data
    ]


# ---------------------------------------------------------------------------
# POST /api/canvases — create canvas
# ---------------------------------------------------------------------------

@router.post("", status_code=201, response_model=Dict[str, Any])
async def create_canvas(body: CreateCanvasRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    result = await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .insert({"owner_id": user_id, "name": body.name, "description": body.description})
        .execute()
    )
    canvas = result.data[0]
    return {**canvas, "has_share_link": False, "dataset_count": 0}


# ---------------------------------------------------------------------------
# POST /api/canvases/join — join via share token
# (declared before /{canvas_id} routes so FastAPI matches the literal segment first)
# ---------------------------------------------------------------------------

@router.post("/join", response_model=Dict[str, Any])
async def join_canvas(body: JoinRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()

    # Look up canvas by token directly — the RPC relies on auth.uid() which is NULL
    # when using the service-role key, so we resolve the token and insert ourselves.
    canvas_result = await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .select("id, share_permission")
        .eq("share_token", body.token)
        .maybe_single()
        .execute()
    )
    canvas_result_data = canvas_result.data if canvas_result is not None else None
    if not canvas_result_data:
        raise HTTPException(status_code=404, detail="Invalid or expired share token")

    canvas_id = canvas_result_data["id"]
    permission = canvas_result_data["share_permission"]
    if not permission:
        raise HTTPException(status_code=422, detail="Share link has no associated permission")

    # Skip if already the owner
    owner_check = await asyncio.to_thread(
        lambda: supabase.table("canvases").select("id").eq("id", canvas_id).eq("owner_id", user_id).maybe_single().execute()
    )
    owner_check_data = owner_check.data if owner_check is not None else None
    if not owner_check_data:
        await asyncio.to_thread(
            lambda: supabase.table("canvas_collaborators")
            .upsert(
                {"canvas_id": canvas_id, "user_id": user_id, "permission": permission},
                on_conflict="canvas_id,user_id",
            )
            .execute()
        )

    return {"canvas_id": canvas_id, "permission": permission}


# ---------------------------------------------------------------------------
# GET /api/canvases/{canvas_id} — get canvas detail
# ---------------------------------------------------------------------------

@router.get("/{canvas_id}", response_model=Dict[str, Any])
async def get_canvas(canvas_id: str, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission is None:
        raise HTTPException(status_code=403, detail="Access denied")

    canvas = await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .select("id, name, description, owner_id, share_token, share_permission, thumbnail, created_at, updated_at")
        .eq("id", canvas_id)
        .single()
        .execute()
    )
    if not canvas.data:
        raise HTTPException(status_code=404, detail="Canvas not found")

    # Get datasets in canvas
    cd_rows = await asyncio.to_thread(
        lambda: supabase.table("canvas_datasets")
        .select("dataset_id, datasets(id, filename, processing_status, metadata, created_at)")
        .eq("canvas_id", canvas_id)
        .execute()
    )
    datasets = [row["datasets"] for row in cd_rows.data if row.get("datasets")]

    data: Dict[str, Any] = {
        **canvas.data,
        "permission": permission,
        "has_share_link": canvas.data["share_permission"] is not None,
        "datasets": datasets,
        "dataset_count": len(datasets),
    }
    # Only expose the raw share_token to the canvas owner
    if permission != "owner":
        data.pop("share_token", None)
    return data


# ---------------------------------------------------------------------------
# PATCH /api/canvases/{canvas_id} — update canvas
# ---------------------------------------------------------------------------

@router.patch("/{canvas_id}", response_model=Dict[str, Any])
async def update_canvas(canvas_id: str, body: UpdateCanvasRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission not in ("owner", "edit"):
        raise HTTPException(status_code=403, detail="Edit access required")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await asyncio.to_thread(
        lambda: supabase.table("canvases").update(updates).eq("id", canvas_id).execute()
    )
    return result.data[0]


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id} — delete canvas
# ---------------------------------------------------------------------------

@router.delete("/{canvas_id}", status_code=204)
async def delete_canvas(canvas_id: str, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    await asyncio.to_thread(
        lambda: supabase.table("canvases").delete().eq("id", canvas_id).execute()
    )


# ---------------------------------------------------------------------------
# POST /api/canvases/{canvas_id}/share — generate/replace share link
# ---------------------------------------------------------------------------

@router.post("/{canvas_id}/share", response_model=Dict[str, Any])
async def generate_share_link(canvas_id: str, body: ShareRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    new_token = secrets.token_hex(32)  # 64-char hex
    await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .update({"share_token": new_token, "share_permission": body.permission})
        .eq("id", canvas_id)
        .execute()
    )
    return {
        "share_token": new_token,
        "share_permission": body.permission,
        "share_url": f"/canvas/{canvas_id}?token={new_token}",
    }


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id}/share — revoke share link
# ---------------------------------------------------------------------------

@router.delete("/{canvas_id}/share", status_code=204)
async def revoke_share_link(canvas_id: str, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    await asyncio.to_thread(
        lambda: supabase.table("canvases")
        .update({"share_token": None, "share_permission": None})
        .eq("id", canvas_id)
        .execute()
    )


# ---------------------------------------------------------------------------
# GET /api/canvases/{canvas_id}/collaborators — list collaborators
# ---------------------------------------------------------------------------

@router.get("/{canvas_id}/collaborators", response_model=List[Dict[str, Any]])
async def list_collaborators(canvas_id: str, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    collabs = await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .select("user_id, permission, joined_at")
        .eq("canvas_id", canvas_id)
        .execute()
    )

    from app.database.supabase_client import get_supabase_admin_client
    admin = get_supabase_admin_client()

    responses = await asyncio.gather(
        *[asyncio.to_thread(lambda uid=row["user_id"]: admin.auth.admin.get_user_by_id(uid))
          for row in collabs.data],
        return_exceptions=True,
    )
    return [
        {**row, "email": resp.user.email if not isinstance(resp, Exception) and getattr(resp, "user", None) else None}
        for row, resp in zip(collabs.data, responses)
    ]


# ---------------------------------------------------------------------------
# DELETE /api/canvases/{canvas_id}/collaborators/{collab_user_id}
# ---------------------------------------------------------------------------

@router.delete("/{canvas_id}/collaborators/{collab_user_id}", status_code=204)
async def remove_collaborator(
    canvas_id: str,
    collab_user_id: str,
    user_id: str = Depends(require_user),
):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .delete()
        .eq("canvas_id", canvas_id)
        .eq("user_id", collab_user_id)
        .execute()
    )
