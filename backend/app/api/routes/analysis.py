"""
Analysis endpoints using the new PipelineOrchestrator
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import uuid
import pandas as pd

from app.models.analysis import AnalysisResponse
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalysisRequest(BaseModel):
    """Request model for dataset analysis"""
    data: List[Dict[str, Any]]
    filename: Optional[str] = "dataset.csv"
    file_type: Optional[str] = "csv"
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

        # Create dataset record
        dataset_id = str(uuid.uuid4())
        supabase = get_supabase_client()
        
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
                "data_size_mb": round(data_size_estimate / (1024 * 1024), 2)
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