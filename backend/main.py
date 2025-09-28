"""
Auto Visualization Agent Backend
FastAPI application for the AI-powered data visualization platform
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.api.routes import datasets, analysis, visualizations, health
from app.database.supabase_client import get_supabase_client
# Removed old pipeline import - using new PipelineOrchestrator


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

    yield

    # Cleanup
    logger.info("Shutting down backend")
    


# Create FastAPI app
app = FastAPI(
    title="Auto Visualization Agent API",
    description="Simplified AI-powered data visualization platform with 3-agent pipeline",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.get("/", tags=["API Info"])
async def root():
    """Basic API information"""
    return {
        "message": "Auto Visualization Agent API",
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