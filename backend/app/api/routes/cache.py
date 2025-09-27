"""
Cache Management API Routes
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.services.agent_pipeline import AgentPipelineService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cache", tags=["cache"])


@router.get("/metrics")
async def get_cache_metrics():
    """
    Get comprehensive cache performance metrics
    
    Returns:
        Cache metrics including hit rates, sizes, and optimization recommendations
    """
    try:
        pipeline = AgentPipelineService()
        metrics = await pipeline.get_cache_metrics()
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": metrics
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get cache metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve cache metrics: {str(e)}"
        )


@router.post("/clear")
async def clear_cache(
    cache_type: Optional[str] = Query(
        None, 
        description="Specific cache type to clear (fingerprint, ai_response, analysis, chart_config). If not specified, clears all caches."
    )
):
    """
    Clear cache(s)
    
    Args:
        cache_type: Optional specific cache type to clear
        
    Returns:
        Success status and message
    """
    try:
        pipeline = AgentPipelineService()
        result = await pipeline.clear_cache(cache_type)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": result
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.get("/status")
async def get_cache_status():
    """
    Get current cache status and sizes
    
    Returns:
        Current cache sizes and basic status information
    """
    try:
        pipeline = AgentPipelineService()
        cache = pipeline.cache
        
        cache_sizes = cache.get_cache_sizes()
        metrics = cache.get_cache_metrics()
        
        # Calculate overall hit rate
        total_hits = sum(m['hits'] for m in metrics.values())
        total_requests = sum(m['total_requests'] for m in metrics.values())
        overall_hit_rate = total_hits / total_requests if total_requests > 0 else 0.0
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": {
                    "cache_sizes": cache_sizes,
                    "overall_hit_rate": round(overall_hit_rate, 4),
                    "total_requests": total_requests,
                    "total_hits": total_hits,
                    "cache_types": list(cache_sizes.keys())
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve cache status: {str(e)}"
        )


@router.post("/optimize")
async def optimize_cache():
    """
    Analyze cache performance and get optimization recommendations
    
    Returns:
        Optimization analysis and recommendations
    """
    try:
        pipeline = AgentPipelineService()
        cache = pipeline.cache
        
        optimization_report = cache.optimize_cache_performance()
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": optimization_report
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to optimize cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize cache: {str(e)}"
        )