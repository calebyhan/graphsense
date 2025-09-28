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





@router.get("/")
async def datasets_info():
    """Get basic information about the datasets API"""
    return {
        "message": "Datasets API",
        "endpoints": {
            "GET /": "List datasets",
            "GET /{dataset_id}": "Get dataset details",
            "DELETE /{dataset_id}": "Delete dataset"
        }
    }