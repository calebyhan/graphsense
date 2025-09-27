"""
Health check endpoints
"""

from fastapi import APIRouter, HTTPException
from app.database.supabase_client import test_connection
import psutil
import time

router = APIRouter()


@router.get("/")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "auto-viz-backend"
    }


@router.get("/detailed")
async def detailed_health_check():
    """Detailed health check including dependencies"""
    try:
        # Test database connection
        db_healthy = await test_connection()

        # System metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "status": "healthy" if db_healthy else "degraded",
            "timestamp": time.time(),
            "service": "auto-viz-backend",
            "dependencies": {
                "supabase": "healthy" if db_healthy else "unhealthy"
            },
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "disk_percent": disk.percent,
                "available_memory_mb": memory.available // (1024 * 1024)
            }
        }

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")