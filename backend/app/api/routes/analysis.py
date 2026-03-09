"""
Analysis endpoints using the new PipelineOrchestrator
"""

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import redis as redis_lib
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.config import get_settings
from app.core.limiter import limiter
from app.database.supabase_client import get_supabase_client
from app.models.analysis import AnalysisResponse
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.worker import run_analysis

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()

# Redis client — shared across workers for cross-process deduplication
_redis = redis_lib.Redis.from_url(settings.redis_url, decode_responses=True)
DEDUP_TTL = 60  # seconds

# Lazy orchestrator — initialized on first use to avoid startup crash if DB is unconfigured
_orchestrator: Optional[PipelineOrchestrator] = None


def _get_orchestrator() -> PipelineOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = PipelineOrchestrator()
    return _orchestrator


class AnalysisRequest(BaseModel):
    """Request model for dataset analysis"""
    data: List[Dict[str, Any]]
    filename: Optional[str] = "dataset.csv"
    file_type: Optional[str] = "csv"
    dataset_id: Optional[str] = None  # If provided, use existing dataset instead of creating new one
    canvas_id: Optional[str] = None   # If provided, link dataset to this canvas after creation
    options: Optional[Dict[str, Any]] = {}


@router.post("/analyze", response_model=AnalysisResponse)
@limiter.limit("10/minute")
async def analyze_dataset(
    request: Request,
    body: AnalysisRequest,
    user_id: str | None = Depends(get_user_id),
):
    """
    Single analyze endpoint for dataset analysis using the new PipelineOrchestrator
    Accepts JSON data payload and runs comprehensive 3-agent analysis
    """
    try:
        # Cross-process deduplication via Redis
        request_signature = hashlib.md5(
            json.dumps({
                "filename": body.filename or "",
                "data_length": len(body.data),
                "first_row": body.data[0] if body.data else {},
                "columns": sorted(body.data[0].keys()) if body.data else [],
            }, sort_keys=True).encode()
        ).hexdigest()

        existing_dataset_id = _redis.get(f"dedup:{request_signature}")
        if existing_dataset_id:
            logger.warning(f"Duplicate request detected for {body.filename}, returning existing dataset: {existing_dataset_id}")
            return AnalysisResponse(
                success=True,
                dataset_id=existing_dataset_id,
                message="Request already in progress",
                processing_time_ms=0,
            )
        # Validate request data
        if not body.data or len(body.data) == 0:
            raise HTTPException(
                status_code=400,
                detail="No data provided in request"
            )
        
        # Convert to DataFrame for validation
        try:
            df = pd.DataFrame(body.data)
            
            # Validate DataFrame
            if df.empty:
                raise HTTPException(
                    status_code=400,
                    detail="Dataset contains no data"
                )
            
            if len(df.columns) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Dataset contains no columns"
                )
            
            # Enhanced row limit check
            if len(body.data) > 50000:
                raise HTTPException(
                    status_code=400,
                    detail="Dataset too large. Please provide fewer than 50,000 rows."
                )
                
        except HTTPException:
            raise
        except Exception as parse_error:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to process dataset: {str(parse_error)}"
            )

        supabase = get_supabase_client()

        # DB-level dedup: check for a recent dataset with the same content hash
        content_data = {
            "filename": body.filename or "",
            "row_count": len(body.data),
            "columns": sorted(body.data[0].keys()) if body.data else [],
            "first_row": body.data[0] if body.data else {},
            "last_row": body.data[-1] if body.data else {},
        }
        content_hash = hashlib.md5(
            json.dumps(content_data, sort_keys=True).encode()
        ).hexdigest()
        
        logger.info(f"Content hash for {body.filename}: {content_hash}")
        
        # Check for recent datasets with same content (within last 60 seconds)
        recent_time = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
        
        recent_datasets = await asyncio.to_thread(
            lambda: supabase.table("datasets").select("id, filename, metadata").gte("created_at", recent_time).execute()
        )
        
        # Enhanced duplicate detection
        duplicate_found = False
        existing_id = None
        for existing in recent_datasets.data:
            # Check exact filename match first
            if existing.get("filename") == body.filename:
                logger.warning(f"Exact filename match found for {body.filename}")
                duplicate_found = True
                existing_id = existing["id"]
                break
                
            # Also check content hash if we stored it in metadata
            if existing.get("metadata") and isinstance(existing["metadata"], dict):
                existing_hash = existing["metadata"].get("content_hash")
                if existing_hash == content_hash:
                    logger.warning(f"Content hash match found: {content_hash}")
                    duplicate_found = True
                    existing_id = existing["id"]
                    break
        
        if duplicate_found:
            # Return success but don't create duplicate
            logger.info(f"Returning existing dataset ID: {existing_id}")
            return AnalysisResponse(
                success=True,
                dataset_id=existing_id,
                recommendations=[],
                message="Analysis already in progress for this dataset",
                processing_time_ms=0
            )

        # Use provided dataset_id or create new one
        if body.dataset_id:
            dataset_id = body.dataset_id
            logger.info(f"Using existing dataset ID: {dataset_id}")

            # Verify the dataset exists
            existing_dataset = await asyncio.to_thread(
                lambda: supabase.table("datasets").select("id, processing_status").eq("id", dataset_id).execute()
            )
            if not existing_dataset.data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Dataset with ID {dataset_id} not found"
                )

            # Register in Redis so other workers skip this request
            _redis.setex(f"dedup:{request_signature}", DEDUP_TTL, dataset_id)
            logger.info(f"Added existing dataset to deduplication cache: {request_signature} -> {dataset_id}")

        else:
            # Create new dataset record
            dataset_id = str(uuid.uuid4())

            # Register in Redis so other workers skip this request
            _redis.setex(f"dedup:{request_signature}", DEDUP_TTL, dataset_id)
            logger.info(f"Added request to deduplication cache: {request_signature} -> {dataset_id}")

            # Calculate approximate data size
            data_size_estimate = len(str(body.data).encode('utf-8'))

            # Insert enhanced dataset record
            dataset_data = {
                "id": dataset_id,
                "user_id": user_id,  # None for anonymous; populated when JWT is present
                "filename": body.filename,
                "file_size": data_size_estimate,
                "file_type": body.file_type,
                "processing_status": "processing",
                "sample_data": body.data[:10],  # Store first 10 rows as sample
                "metadata": {
                    "row_count": len(body.data),
                    "column_count": len(df.columns),
                    "columns": list(df.columns),
                    "data_size_mb": round(data_size_estimate / (1024 * 1024), 2),
                    "content_hash": content_hash
                }
            }

            await asyncio.to_thread(
                lambda: supabase.table("datasets").insert(dataset_data).execute()
            )
            logger.info(f"Created dataset record: {dataset_id} with {len(body.data)} rows and {len(df.columns)} columns")

        # Link dataset to canvas if canvas_id provided
        if body.canvas_id and not duplicate_found:
            from app.api.routes.canvases import get_canvas_permission
            perm = await get_canvas_permission(body.canvas_id, user_id or "", supabase)
            if perm not in ("owner", "edit"):
                raise HTTPException(status_code=403, detail="No edit access to this canvas")
            await asyncio.to_thread(
                lambda: supabase.table("canvas_datasets").insert({
                    "canvas_id": body.canvas_id,
                    "dataset_id": dataset_id,
                }).execute()
            )

        # Enqueue analysis as a Celery task (survives worker restarts)
        run_analysis.delay(body.data, dataset_id)
        logger.info(f"Enqueued analysis task for dataset {dataset_id}")

        # Return immediate response with dataset ID
        return AnalysisResponse(
            success=True,
            dataset_id=dataset_id,
            recommendations=[],  # Will be populated when analysis completes
            data_profile=None,  # Will be populated when analysis completes
            processing_time_ms=0,
            message="Analysis started successfully. Use the status endpoint to check progress."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/status/{dataset_id}")
async def get_analysis_status(dataset_id: str):
    """Get the current analysis status for a dataset using PipelineOrchestrator"""
    try:
        status = await _get_orchestrator().get_status(dataset_id)
        
        if status.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Dataset not found")

        if status.get("status") == "error":
            raise HTTPException(status_code=500, detail=status.get("error", "Internal error"))

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get status: {str(e)}"
        )


@router.get("/results/{dataset_id}", response_model=AnalysisResponse)
async def get_analysis_results(dataset_id: str):
    """Get the complete analysis results for a dataset using PipelineOrchestrator"""
    try:
        results = await _get_orchestrator().get_results(dataset_id)

        if not results:
            raise HTTPException(
                status_code=404,
                detail="Analysis results not found or analysis not completed yet"
            )

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis results: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get results: {str(e)}"
        )





@router.get("/")
async def analysis_info():
    """Get basic information about the analysis API"""
    return {
        "message": "Analysis API",
        "endpoints": {
            "POST /analyze": "Upload file and start analysis",
            "GET /status/{dataset_id}": "Get analysis status",
            "GET /results/{dataset_id}": "Get analysis results"
        }
    }