"""
Dataset management endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional

from app.models.dataset import Dataset, CreateDatasetRequest, CreateDatasetResponse
from app.database.supabase_client import get_supabase_client
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_datasets(
    user_id: Optional[str] = None,
    limit: int = 10,
    offset: int = 0
):
    """List datasets with pagination"""
    try:
        supabase = get_supabase_client()

        query = supabase.table("datasets").select("*")

        if user_id:
            query = query.eq("user_id", user_id)

        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return {
            "datasets": response.data,
            "count": len(response.data),
            "offset": offset,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"Failed to list datasets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list datasets: {str(e)}"
        )


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Get a specific dataset by ID"""
    try:
        supabase = get_supabase_client()

        response = supabase.table("datasets").select("*").eq("id", dataset_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dataset: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dataset: {str(e)}"
        )


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a dataset and all associated analyses"""
    try:
        supabase = get_supabase_client()

        # Check if dataset exists
        response = supabase.table("datasets").select("id").eq("id", dataset_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found"
            )

        # Delete dataset (cascading delete will handle related records)
        supabase.table("datasets").delete().eq("id", dataset_id).execute()

        return {"message": "Dataset deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete dataset: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete dataset: {str(e)}"
        )


@router.get("/{dataset_id}/analyses")
async def get_dataset_analyses(dataset_id: str):
    """Get all agent analyses for a dataset"""
    try:
        supabase = get_supabase_client()

        # Check if dataset exists
        dataset_response = supabase.table("datasets").select("id").eq("id", dataset_id).execute()

        if not dataset_response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found"
            )

        # Get all analyses
        analyses_response = supabase.table("agent_analyses").select("*").eq("dataset_id", dataset_id).order("created_at").execute()

        return {
            "dataset_id": dataset_id,
            "analyses": analyses_response.data,
            "count": len(analyses_response.data)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dataset analyses: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dataset analyses: {str(e)}"
        )


@router.get("/")
async def datasets_info():
    """Get information about the datasets API"""
    return {
        "message": "Auto Visualization Agent Datasets API",
        "version": "1.0.0",
        "endpoints": {
            "GET /": "List datasets with pagination",
            "GET /{dataset_id}": "Get specific dataset details",
            "DELETE /{dataset_id}": "Delete dataset and associated analyses",
            "GET /{dataset_id}/analyses": "Get all agent analyses for a dataset"
        },
        "note": "Dataset creation is handled through the analysis endpoint"
    }