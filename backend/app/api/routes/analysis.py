"""
Analysis endpoints for the agent pipeline
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, UploadFile, File
from typing import Dict, Any, Optional

from app.models.analysis import AnalysisRequest, AnalysisResponse
from app.models.dataset import CreateDatasetRequest, CreateDatasetResponse
from app.services.agent_pipeline import AgentPipelineService
from app.database.supabase_client import get_supabase_client
from app.utils.enhanced_file_parser import EnhancedFileParser
from app.utils.memory_manager import get_memory_manager, RequestPriority
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_dataset(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    Analyze dataset using the 3-agent pipeline
    This endpoint receives client-parsed data and runs the AI analysis
    """
    try:
        # Validate input data
        if not request.data or len(request.data) == 0:
            raise HTTPException(
                status_code=400,
                detail="No data provided. Please upload a file with data."
            )

        if len(request.data) > 50000:  # Increased limit with streaming support
            raise HTTPException(
                status_code=400,
                detail="Dataset too large. Please upload a file with fewer than 50,000 rows."
            )

        # Create dataset record
        dataset_id = str(uuid.uuid4())
        supabase = get_supabase_client()

        # For testing: Create test user or use existing one
        import os
        
        # Check if we're in a testing environment
        environment = os.getenv('ENVIRONMENT', 'development')
        
        if environment in ['development', 'test']:
            # For testing, try to use an existing user or create one
            test_user_id = None
            
            try:
                # Try to create a simple test user
                result = supabase.auth.admin.create_user({
                    "email": "test@test.com", 
                    "password": "password123",
                    "email_confirm": True
                })
                
                if hasattr(result, 'user') and result.user:
                    test_user_id = result.user.id
                    logger.info(f"Created test user: {test_user_id}")
                elif hasattr(result, 'data'):
                    test_user_id = result.data.id  
                    logger.info(f"Created test user: {test_user_id}")
                    
            except Exception as e:
                # If creation fails, user might already exist - try to find it
                logger.warning(f"User creation failed: {e}")
                try:
                    users = supabase.auth.admin.list_users()
                    users_data = users.data if hasattr(users, 'data') else users
                    if users_data and len(users_data) > 0:
                        # Use the first available user for testing
                        test_user_id = users_data[0].id
                        logger.info(f"Using existing user for testing: {test_user_id}")
                except Exception as list_err:
                    logger.error(f"Could not list users: {list_err}")
                    # Last resort: use NULL (this might fail if NOT NULL constraint exists)
                    test_user_id = None
            
            user_id_to_use = test_user_id
        else:
            # Production: this would come from authentication
            user_id_to_use = "00000000-0000-0000-0000-000000000000"  # This needs proper auth
        
        # Insert dataset record
        dataset_data = {
            "id": dataset_id,
            "user_id": user_id_to_use,
            "filename": request.filename or "dataset.csv",
            "file_size": len(str(request.data)),
            "file_type": request.file_type or "csv",
            "processing_status": "processing",
            "sample_data": request.data[:10],  # Store first 10 rows as sample
            "metadata": request.options
        }

        result = supabase.table("datasets").insert(dataset_data).execute()
        logger.info(f"Created dataset record: {dataset_id}")

        # Initialize pipeline service
        pipeline_service = AgentPipelineService()

        # Run analysis in background with memory management
        background_tasks.add_task(
            pipeline_service.analyze_dataset_with_memory_management,
            request.data,
            dataset_id
        )

        # Return immediate response with dataset ID
        return AnalysisResponse(
            success=True,
            dataset_id=dataset_id,
            recommendations=[],  # Will be populated when analysis completes
            data_profile=None,  # Will be populated when analysis completes
            processing_time_ms=0,
            message="Analysis started. Use the status endpoint to check progress."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/analyze-file", response_model=AnalysisResponse)
async def analyze_file_upload(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    priority: str = "normal"
):
    """
    Analyze uploaded file using streaming processing and memory management
    This endpoint handles file uploads directly with optimized processing
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="No file provided"
            )
        
        # Check file size
        file_content = await file.read()
        file_size_mb = len(file_content) / (1024 * 1024)
        
        if file_size_mb > 500:  # 500MB limit
            raise HTTPException(
                status_code=400,
                detail="File too large. Maximum size is 500MB."
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Create dataset ID
        dataset_id = str(uuid.uuid4())
        
        # Parse priority
        priority_map = {
            "low": RequestPriority.LOW,
            "normal": RequestPriority.NORMAL,
            "high": RequestPriority.HIGH
        }
        request_priority = priority_map.get(priority.lower(), RequestPriority.NORMAL)
        
        # Initialize enhanced file parser
        file_parser = EnhancedFileParser()
        
        # Parse file with streaming support
        parse_result = await file_parser.parse_file(
            file=file,
            request_id=dataset_id,
            priority=request_priority
        )
        
        # Create dataset record
        supabase = get_supabase_client()
        
        # Get test user (same logic as above)
        import os
        environment = os.getenv('ENVIRONMENT', 'development')
        
        if environment in ['development', 'test']:
            test_user_id = None
            try:
                result = supabase.auth.admin.create_user({
                    "email": "test@test.com", 
                    "password": "password123",
                    "email_confirm": True
                })
                
                if hasattr(result, 'user') and result.user:
                    test_user_id = result.user.id
                elif hasattr(result, 'data'):
                    test_user_id = result.data.id  
                    
            except Exception as e:
                logger.warning(f"User creation failed: {e}")
                try:
                    users = supabase.auth.admin.list_users()
                    users_data = users.data if hasattr(users, 'data') else users
                    if users_data and len(users_data) > 0:
                        test_user_id = users_data[0].id
                except Exception:
                    test_user_id = None
            
            user_id_to_use = test_user_id
        else:
            user_id_to_use = "00000000-0000-0000-0000-000000000000"
        
        # Insert dataset record with streaming metadata
        dataset_data = {
            "id": dataset_id,
            "user_id": user_id_to_use,
            "filename": file.filename,
            "file_size": len(file_content),
            "file_type": parse_result['metadata'].get('file_type', 'unknown'),
            "processing_status": "processing",
            "sample_data": parse_result['data'][:10],  # Store first 10 rows as sample
            "metadata": {
                **parse_result['metadata'],
                "processing_stats": parse_result.get('processing_stats', {}),
                "streaming_enabled": True
            }
        }

        result = supabase.table("datasets").insert(dataset_data).execute()
        logger.info(f"Created dataset record with streaming: {dataset_id}")

        # Initialize pipeline service
        pipeline_service = AgentPipelineService()

        # Run analysis in background with memory management
        if background_tasks:
            background_tasks.add_task(
                pipeline_service.analyze_dataset_with_memory_management,
                parse_result['data'],
                dataset_id
            )

        # Return immediate response
        return AnalysisResponse(
            success=True,
            dataset_id=dataset_id,
            recommendations=[],
            data_profile=None,
            processing_time_ms=0,
            message=f"File processed with streaming. Analysis started for {len(parse_result['data'])} rows (sampled from {parse_result['metadata']['original_rows']} rows)."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File analysis request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"File analysis failed: {str(e)}"
        )


@router.get("/status/{dataset_id}")
async def get_analysis_status(dataset_id: str):
    """Get the current analysis status for a dataset"""
    try:
        pipeline_service = AgentPipelineService()
        status = await pipeline_service.get_analysis_status(dataset_id)
        return status

    except Exception as e:
        logger.error(f"Failed to get analysis status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get status: {str(e)}"
        )


@router.get("/results/{dataset_id}", response_model=AnalysisResponse)
async def get_analysis_results(dataset_id: str):
    """Get the complete analysis results for a dataset"""
    try:
        pipeline_service = AgentPipelineService()
        results = await pipeline_service.get_analysis_results(dataset_id)

        if not results:
            raise HTTPException(
                status_code=404,
                detail="Analysis results not found or analysis not completed"
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


@router.get("/memory-status")
async def get_memory_status():
    """Get current memory usage and queue status"""
    try:
        memory_manager = get_memory_manager()
        return {
            "memory_usage": memory_manager.get_memory_usage(),
            "queue_status": memory_manager.get_queue_status(),
            "system_status": "healthy" if memory_manager.get_memory_pressure() < 0.8 else "under_pressure"
        }
    except Exception as e:
        logger.error(f"Failed to get memory status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get memory status: {str(e)}"
        )


@router.get("/")
async def analysis_info():
    """Get information about the analysis API"""
    return {
        "message": "Auto Visualization Agent Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "POST /analyze": "Start dataset analysis using the 3-agent pipeline",
            "POST /analyze-file": "Upload and analyze file with streaming support",
            "GET /status/{dataset_id}": "Get analysis progress status",
            "GET /results/{dataset_id}": "Get complete analysis results",
            "GET /memory-status": "Get memory usage and queue status"
        },
        "supported_formats": ["CSV", "JSON", "Excel", "TSV"],
        "max_rows": 50000,
        "max_file_size": "500MB",
        "features": ["Streaming Processing", "Memory Management", "Request Queuing"],
        "agents": ["Enhanced Data Profiler", "Chart Recommender", "Validation Agent"]
    }