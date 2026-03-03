"""
Visualization management endpoints — save, retrieve, share.
All database calls are wrapped with asyncio.to_thread to avoid blocking.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateVisualizationRequest(BaseModel):
    dataset_id: str
    chart_type: str
    chart_config: Dict[str, Any]
    title: Optional[str] = None
    description: Optional[str] = None


class UpdateVisualizationRequest(BaseModel):
    chart_config: Optional[Dict[str, Any]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_shared: Optional[bool] = None


# ── Shared route MUST come before /{visualization_id} to avoid conflict ──────

@router.get("/shared/{share_token}")
async def get_shared_visualization(share_token: str):
    """Return a publicly shared visualization by token (no auth required)."""
    supabase = get_supabase_client()
    response = await asyncio.to_thread(
        lambda: supabase.table("visualizations")
        .select("*")
        .eq("share_token", share_token)
        .eq("is_shared", True)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Shared visualization not found")
    return response.data[0]


# ── Standard CRUD ─────────────────────────────────────────────────────────────

@router.post("/")
async def create_visualization(
    body: CreateVisualizationRequest,
    user_id: str | None = Depends(get_user_id),
):
    """Create a new visualization linked to a dataset."""
    supabase = get_supabase_client()

    # Verify dataset exists
    ds = await asyncio.to_thread(
        lambda: supabase.table("datasets").select("id").eq("id", body.dataset_id).execute()
    )
    if not ds.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    row = {
        "id": str(uuid.uuid4()),
        "dataset_id": body.dataset_id,
        "user_id": user_id,
        "chart_type": body.chart_type,
        "chart_config": body.chart_config,
        "title": body.title,
        "description": body.description,
        "is_shared": False,
    }
    response = await asyncio.to_thread(
        lambda: supabase.table("visualizations").insert(row).execute()
    )
    return {"success": True, "visualization": response.data[0]}


@router.get("/")
async def list_visualizations(
    dataset_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    user_id: str | None = Depends(get_user_id),
):
    """List visualizations, optionally filtered by dataset."""
    supabase = get_supabase_client()

    def _query():
        q = supabase.table("visualizations").select("*")
        if user_id:
            q = q.eq("user_id", user_id)
        if dataset_id:
            q = q.eq("dataset_id", dataset_id)
        return q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    response = await asyncio.to_thread(_query)
    return {"visualizations": response.data, "count": len(response.data), "offset": offset, "limit": limit}


@router.get("/{visualization_id}")
async def get_visualization(visualization_id: str):
    """Get a specific visualization by ID."""
    supabase = get_supabase_client()
    response = await asyncio.to_thread(
        lambda: supabase.table("visualizations").select("*").eq("id", visualization_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Visualization not found")
    return response.data[0]


@router.put("/{visualization_id}")
async def update_visualization(
    visualization_id: str,
    body: UpdateVisualizationRequest,
    user_id: str | None = Depends(get_user_id),
):
    """Update chart config, title, description, or sharing state."""
    supabase = get_supabase_client()

    check = await asyncio.to_thread(
        lambda: supabase.table("visualizations").select("id, user_id").eq("id", visualization_id).execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Visualization not found")

    updates: Dict[str, Any] = {"updated_at": datetime.now().isoformat()}
    if body.chart_config is not None:
        updates["chart_config"] = body.chart_config
    if body.title is not None:
        updates["title"] = body.title
    if body.description is not None:
        updates["description"] = body.description
    if body.is_shared is not None:
        updates["is_shared"] = body.is_shared

    response = await asyncio.to_thread(
        lambda: supabase.table("visualizations").update(updates).eq("id", visualization_id).execute()
    )
    return {"success": True, "visualization": response.data[0]}


@router.delete("/{visualization_id}")
async def delete_visualization(
    visualization_id: str,
    user_id: str | None = Depends(get_user_id),
):
    """Delete a visualization."""
    supabase = get_supabase_client()

    check = await asyncio.to_thread(
        lambda: supabase.table("visualizations").select("id").eq("id", visualization_id).execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Visualization not found")

    await asyncio.to_thread(
        lambda: supabase.table("visualizations").delete().eq("id", visualization_id).execute()
    )
    return {"success": True, "message": "Visualization deleted"}


@router.post("/{visualization_id}/share")
async def share_visualization(
    visualization_id: str,
    user_id: str | None = Depends(get_user_id),
):
    """Enable sharing and return the public share URL."""
    supabase = get_supabase_client()

    check = await asyncio.to_thread(
        lambda: supabase.table("visualizations").select("id").eq("id", visualization_id).execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Visualization not found")

    response = await asyncio.to_thread(
        lambda: supabase.table("visualizations").update({
            "is_shared": True,
            "updated_at": datetime.now().isoformat(),
        }).eq("id", visualization_id).execute()
    )
    viz = response.data[0]
    return {
        "success": True,
        "visualization": viz,
        "share_token": viz.get("share_token"),
        "share_url": f"/shared/{viz.get('share_token')}",
    }
