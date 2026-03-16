"""
GraphSense Backend
FastAPI application for the AI-powered data visualization platform
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.logging_config import setup_logging
from app.api.routes import datasets, analysis, visualizations, health, canvases
from app.api.ws.canvas_ws import router as ws_router
from app.database.supabase_client import get_supabase_client


# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting backend")

    # Basic initialization
    try:
        # Test Supabase connection
        supabase = get_supabase_client()
        logger.info("Database connection established")

    except Exception as e:
        logger.error(f"Failed to initialize: {e}")
        raise

    from app.utils.memory_manager import initialize_memory_manager, shutdown_memory_manager
    await initialize_memory_manager()
    logger.info("Memory manager started")

    try:
        yield
    finally:
        try:
            await shutdown_memory_manager()
        except Exception as e:
            logger.exception("Error during memory manager shutdown: %s", e)
        logger.info("Shutting down backend")
    


# Create FastAPI app
app = FastAPI(
    title="GraphSense API",
    description="Simplified AI-powered data visualization platform with 3-agent pipeline",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Attach rate limiter to app state and register its 429 handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware — origins controlled by CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    health.router,
    prefix="/health",
    tags=["Health Check"]
)
app.include_router(
    analysis.router,
    prefix="/api/analysis",
    tags=["Analysis Pipeline"]
)
app.include_router(
    datasets.router,
    prefix="/api/datasets",
    tags=["Dataset Management"]
)
app.include_router(
    visualizations.router,
    prefix="/api/visualizations",
    tags=["Visualization Management"]
)
app.include_router(
    canvases.router,
    prefix="/api/canvases",
    tags=["Canvas Collaboration"]
)
app.include_router(
    ws_router,
    tags=["WebSocket"]
)


@app.get("/", tags=["API Info"])
async def root():
    """Basic API information"""
    return {
        "message": "GraphSense API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "POST /api/analysis/analyze": "Upload file and start analysis",
            "GET /api/analysis/status/{id}": "Check analysis status",
            "GET /api/analysis/results/{id}": "Get analysis results",
            "GET /health": "Health check"
        }
    }

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Global HTTP exception handler"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )