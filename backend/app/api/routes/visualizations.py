"""
Visualization management endpoints
"""

import logging
from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.database.supabase_client import get_supabase_client
from datetime import datetime
import uuid

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


@router.post("/")
async def create_visualization(request: CreateVisualizationRequest):
    """Create a new visualization"""
    try:
        supabase = get_supabase_client()

        # Verify dataset exists
        dataset_response = supabase.table("datasets").select("id").eq("id", request.dataset_id).execute()
        if not dataset_response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found"
            )

        # Create visualization
        visualization_data = {
            "id": str(uuid.uuid4()),
            "dataset_id": request.dataset_id,
            "user_id": "00000000-0000-0000-0000-000000000000",  # Anonymous user for now
            "chart_type": request.chart_type,
            "chart_config": request.chart_config,
            "title": request.title,
            "description": request.description,
            "is_shared": False
        }

        response = supabase.table("visualizations").insert(visualization_data).execute()

        return {
            "success": True,
            "visualization": response.data[0],
            "message": "Visualization created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create visualization: {str(e)}"
        )


@router.get("/")
async def list_visualizations(
    user_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    limit: int = 10,
    offset: int = 0
):
    """List visualizations with optional filtering"""
    try:
        supabase = get_supabase_client()

        query = supabase.table("visualizations").select("*")

        if user_id:
            query = query.eq("user_id", user_id)

        if dataset_id:
            query = query.eq("dataset_id", dataset_id)

        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return {
            "visualizations": response.data,
            "count": len(response.data),
            "offset": offset,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"Failed to list visualizations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list visualizations: {str(e)}"
        )


@router.get("/{visualization_id}")
async def get_visualization(visualization_id: str):
    """Get a specific visualization by ID"""
    try:
        supabase = get_supabase_client()

        response = supabase.table("visualizations").select("*").eq("id", visualization_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Visualization not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get visualization: {str(e)}"
        )


@router.put("/{visualization_id}")
async def update_visualization(visualization_id: str, request: UpdateVisualizationRequest):
    """Update a visualization"""
    try:
        supabase = get_supabase_client()

        # Check if visualization exists
        check_response = supabase.table("visualizations").select("id").eq("id", visualization_id).execute()
        if not check_response.data:
            raise HTTPException(
                status_code=404,
                detail="Visualization not found"
            )

        # Prepare update data
        update_data = {"updated_at": datetime.now().isoformat()}

        if request.chart_config is not None:
            update_data["chart_config"] = request.chart_config

        if request.title is not None:
            update_data["title"] = request.title

        if request.description is not None:
            update_data["description"] = request.description

        if request.is_shared is not None:
            update_data["is_shared"] = request.is_shared

        # Update visualization
        response = supabase.table("visualizations").update(update_data).eq("id", visualization_id).execute()

        return {
            "success": True,
            "visualization": response.data[0],
            "message": "Visualization updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update visualization: {str(e)}"
        )


@router.delete("/{visualization_id}")
async def delete_visualization(visualization_id: str):
    """Delete a visualization"""
    try:
        supabase = get_supabase_client()

        # Check if visualization exists
        check_response = supabase.table("visualizations").select("id").eq("id", visualization_id).execute()
        if not check_response.data:
            raise HTTPException(
                status_code=404,
                detail="Visualization not found"
            )

        # Delete visualization
        supabase.table("visualizations").delete().eq("id", visualization_id).execute()

        return {"message": "Visualization deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete visualization: {str(e)}"
        )


@router.get("/shared/{share_token}")
async def get_shared_visualization(share_token: str):
    """Get a shared visualization by token"""
    try:
        supabase = get_supabase_client()

        response = supabase.table("visualizations").select("*").eq("share_token", share_token).eq("is_shared", True).execute()

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Shared visualization not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get shared visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get shared visualization: {str(e)}"
        )


@router.post("/{visualization_id}/share")
async def share_visualization(visualization_id: str):
    """Enable sharing for a visualization"""
    try:
        supabase = get_supabase_client()

        # Check if visualization exists
        check_response = supabase.table("visualizations").select("id").eq("id", visualization_id).execute()
        if not check_response.data:
            raise HTTPException(
                status_code=404,
                detail="Visualization not found"
            )

        # Update to enable sharing (trigger will generate share_token)
        response = supabase.table("visualizations").update({
            "is_shared": True,
            "updated_at": datetime.now().isoformat()
        }).eq("id", visualization_id).execute()

        return {
            "success": True,
            "visualization": response.data[0],
            "share_url": f"/visualizations/shared/{response.data[0]['share_token']}",
            "message": "Visualization sharing enabled"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to share visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to share visualization: {str(e)}"
        )