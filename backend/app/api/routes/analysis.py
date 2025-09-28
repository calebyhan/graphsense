"""
Analysis endpoints using the new PipelineOrchestrator
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import uuid
import pandas as pd
import time

from app.models.analysis import AnalysisResponse
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()

# Global request deduplication cache
_active_requests: Dict[str, tuple[str, float]] = {}  # request_hash -> (dataset_id, timestamp)
REQUEST_CACHE_DURATION = 60  # seconds


class AnalysisRequest(BaseModel):
    """Request model for dataset analysis"""
    data: List[Dict[str, Any]]
    filename: Optional[str] = "dataset.csv"
    file_type: Optional[str] = "csv"
    dataset_id: Optional[str] = None  # If provided, use existing dataset instead of creating new one
    options: Optional[Dict[str, Any]] = {}


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_dataset(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks = None
):
    """
    Single analyze endpoint for dataset analysis using the new PipelineOrchestrator
    Accepts JSON data payload and runs comprehensive 3-agent analysis
    """
    try:
        # Global request deduplication using request signature
        import hashlib
        import json
        request_signature = hashlib.md5(
            json.dumps({
                "filename": request.filename or "",
                "data_length": len(request.data),
                "first_row": request.data[0] if request.data else {},
                "columns": sorted(request.data[0].keys()) if request.data else []
            }, sort_keys=True).encode()
        ).hexdigest()
        
        current_time = time.time()
        
        # Clean old requests from cache
        expired_keys = [k for k, (_, timestamp) in _active_requests.items() 
                       if current_time - timestamp > REQUEST_CACHE_DURATION]
        for key in expired_keys:
            del _active_requests[key]
        
        # Check if this exact request is already being processed
        if request_signature in _active_requests:
            existing_dataset_id, request_time = _active_requests[request_signature]
            logger.warning(f"Duplicate request detected for {request.filename}, returning existing dataset: {existing_dataset_id}")
            return AnalysisResponse(
                success=True,
                dataset_id=existing_dataset_id,
                message=f"Request already in progress (started {current_time - request_time:.1f}s ago)",
                processing_time_ms=0
            )
        # Validate request data
        if not request.data or len(request.data) == 0:
            raise HTTPException(
                status_code=400,
                detail="No data provided in request"
            )
        
        # Convert to DataFrame for validation
        try:
            df = pd.DataFrame(request.data)
            
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
            if len(request.data) > 50000:
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

        # Enhanced duplicate detection (prevent React Strict Mode duplicates)
        supabase = get_supabase_client()
        
        # Create a comprehensive content hash to identify exact duplicate requests
        import hashlib
        import json
        from datetime import datetime, timedelta
        
        # Hash based on filename, size, and first/last rows for uniqueness
        content_data = {
            "filename": request.filename or "",
            "row_count": len(request.data),
            "columns": sorted(request.data[0].keys()) if request.data else [],
            "first_row": request.data[0] if request.data else {},
            "last_row": request.data[-1] if request.data else {},
        }
        content_hash = hashlib.md5(
            json.dumps(content_data, sort_keys=True).encode()
        ).hexdigest()
        
        logger.info(f"Content hash for {request.filename}: {content_hash}")
        
        # Check for recent datasets with same content (within last 60 seconds)
        recent_time = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
        
        recent_datasets = supabase.table("datasets").select("id, filename, metadata").gte("created_at", recent_time).execute()
        
        # Enhanced duplicate detection
        duplicate_found = False
        existing_id = None
        for existing in recent_datasets.data:
            # Check exact filename match first
            if existing.get("filename") == request.filename:
                logger.warning(f"Exact filename match found for {request.filename}")
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
                message="Analysis already in progress for this dataset",
                processing_time_ms=0
            )

        # Use provided dataset_id or create new one
        if request.dataset_id:
            dataset_id = request.dataset_id
            logger.info(f"Using existing dataset ID: {dataset_id}")

            # Verify the dataset exists
            existing_dataset = supabase.table("datasets").select("id, processing_status").eq("id", dataset_id).execute()
            if not existing_dataset.data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Dataset with ID {dataset_id} not found"
                )

            # Skip dataset creation and go directly to analysis
            # Add to global request cache to prevent duplicates
            _active_requests[request_signature] = (dataset_id, current_time)
            logger.info(f"Added existing dataset to deduplication cache: {request_signature} -> {dataset_id}")

        else:
            # Create new dataset record
            dataset_id = str(uuid.uuid4())

            # Add to global request cache to prevent duplicates
            _active_requests[request_signature] = (dataset_id, current_time)
            logger.info(f"Added request to deduplication cache: {request_signature} -> {dataset_id}")

            # Calculate approximate data size
            data_size_estimate = len(str(request.data).encode('utf-8'))

            # Insert enhanced dataset record
            dataset_data = {
                "id": dataset_id,
                "user_id": None,  # No authentication for now
                "filename": request.filename,
                "file_size": data_size_estimate,
                "file_type": request.file_type,
                "processing_status": "processing",
                "sample_data": request.data[:10],  # Store first 10 rows as sample
                "metadata": {
                    "row_count": len(request.data),
                    "column_count": len(df.columns),
                    "columns": list(df.columns),
                    "data_size_mb": round(data_size_estimate / (1024 * 1024), 2),
                    "content_hash": content_hash
                }
            }

            result = supabase.table("datasets").insert(dataset_data).execute()
            logger.info(f"Created dataset record: {dataset_id} with {len(request.data)} rows and {len(df.columns)} columns")

        # Initialize new pipeline orchestrator
        orchestrator = PipelineOrchestrator()

        # Run analysis in background using new orchestrator
        if background_tasks:
            background_tasks.add_task(
                orchestrator.analyze_dataset,
                request.data,
                dataset_id
            )
        else:
            # If no background tasks, run synchronously (for testing)
            logger.warning("Running analysis synchronously - not recommended for production")
            try:
                result = await orchestrator.analyze_dataset(request.data, dataset_id)
                return result
            except Exception as sync_error:
                logger.error(f"Synchronous analysis failed: {sync_error}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Analysis failed: {str(sync_error)}"
                )

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
        orchestrator = PipelineOrchestrator()
        status = await orchestrator.get_status(dataset_id)
        
        if status.get("status") == "not_found":
            raise HTTPException(
                status_code=404,
                detail="Dataset not found"
            )
        
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
        orchestrator = PipelineOrchestrator()
        results = await orchestrator.get_results(dataset_id)

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