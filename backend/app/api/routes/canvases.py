"""
Canvas collaboration endpoints — CRUD, sharing, and collaborator management.
"""

import asyncio
import logging
import secrets
from typing import Any, Dict, List, Optional

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


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class CreateCanvasRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateCanvasRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ShareRequest(BaseModel):
    permission: str  # "view" or "edit"


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
        .select("id, name, description, share_permission, created_at, updated_at")
        .eq("owner_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )

    result = []
    for canvas in canvases.data:
        dataset_count = await asyncio.to_thread(
            lambda cid=canvas["id"]: supabase.table("canvas_datasets")
            .select("dataset_id", count="exact")
            .eq("canvas_id", cid)
            .execute()
        )
        result.append({
            **canvas,
            "has_share_link": canvas["share_permission"] is not None,
            "dataset_count": dataset_count.count or 0,
        })
    return result


# ---------------------------------------------------------------------------
# GET /api/canvases/shared — list canvases shared with me
# ---------------------------------------------------------------------------

@router.get("/shared", response_model=List[Dict[str, Any]])
async def list_shared_canvases(user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    collabs = await asyncio.to_thread(
        lambda: supabase.table("canvas_collaborators")
        .select("canvas_id, permission, joined_at, canvases(id, name, description, owner_id, updated_at)")
        .eq("user_id", user_id)
        .execute()
    )

    # Fetch owner emails via admin client (service role)
    from app.database.supabase_client import get_supabase_admin_client
    admin = get_supabase_admin_client()

    result = []
    for row in collabs.data:
        canvas = row.get("canvases") or {}
        owner_email = None
        if canvas.get("owner_id"):
            try:
                owner_resp = await asyncio.to_thread(
                    lambda oid=canvas["owner_id"]: admin.auth.admin.get_user_by_id(oid)
                )
                owner_email = owner_resp.user.email if owner_resp.user else None
            except Exception:
                pass

        dataset_count = await asyncio.to_thread(
            lambda cid=canvas.get("id"): supabase.table("canvas_datasets")
            .select("dataset_id", count="exact")
            .eq("canvas_id", cid)
            .execute()
        )

        result.append({
            "id": canvas.get("id"),
            "name": canvas.get("name"),
            "description": canvas.get("description"),
            "owner": {"id": canvas.get("owner_id"), "email": owner_email},
            "permission": row["permission"],
            "dataset_count": dataset_count.count or 0,
            "joined_at": row["joined_at"],
            "updated_at": canvas.get("updated_at"),
        })
    return result


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
    return {**canvas, "has_share_link": False}


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
        .select("id, name, description, owner_id, share_permission, created_at, updated_at")
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

    return {
        **canvas.data,
        "permission": permission,
        "has_share_link": canvas.data["share_permission"] is not None,
        "datasets": datasets,
    }


# ---------------------------------------------------------------------------
# PATCH /api/canvases/{canvas_id} — update canvas
# ---------------------------------------------------------------------------

@router.patch("/{canvas_id}", response_model=Dict[str, Any])
async def update_canvas(canvas_id: str, body: UpdateCanvasRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    permission = await get_canvas_permission(canvas_id, user_id, supabase)
    if permission not in ("owner", "edit"):
        raise HTTPException(status_code=403, detail="Edit access required")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
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
    if body.permission not in ("view", "edit"):
        raise HTTPException(status_code=400, detail="Permission must be 'view' or 'edit'")

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
# POST /api/canvases/join — join via share token
# ---------------------------------------------------------------------------

@router.post("/join", response_model=Dict[str, Any])
async def join_canvas(body: JoinRequest, user_id: str = Depends(require_user)):
    supabase = get_supabase_client()
    try:
        result = await asyncio.to_thread(
            lambda: supabase.rpc("join_canvas_via_token", {"p_token": body.token}).execute()
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="Invalid or expired share token")

    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid or expired share token")

    row = result.data[0]
    return {"canvas_id": row["canvas_id"], "permission": row["permission"]}


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

    result = []
    for row in collabs.data:
        email = None
        try:
            resp = await asyncio.to_thread(
                lambda uid=row["user_id"]: admin.auth.admin.get_user_by_id(uid)
            )
            email = resp.user.email if resp.user else None
        except Exception:
            pass
        result.append({**row, "email": email})
    return result


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
