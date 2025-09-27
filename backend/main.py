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
from app.api.routes import datasets, analysis, visualizations, health, cache
from app.database.supabase_client import get_supabase_client
from app.services.agent_pipeline import AgentPipelineService
from app.utils.memory_manager import initialize_memory_manager, shutdown_memory_manager

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting Auto Visualization Agent Backend")

    # Initialize services
    try:
        # Test Supabase connection
        supabase = get_supabase_client()
        logger.info("Supabase connection established")

        # Initialize memory manager
        memory_manager = await initialize_memory_manager()
        app.state.memory_manager = memory_manager
        logger.info("Memory manager initialized")

        # Initialize agent pipeline
        agent_service = AgentPipelineService()
        app.state.agent_service = agent_service
        logger.info("Agent pipeline service initialized")

    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

    yield

    # Cleanup
    logger.info("Shutting down Auto Visualization Agent Backend")
    
    # Shutdown memory manager
    try:
        await shutdown_memory_manager()
        logger.info("Memory manager shutdown complete")
    except Exception as e:
        logger.error(f"Error shutting down memory manager: {e}")

# Create FastAPI app
app = FastAPI(
    title="Auto Visualization Agent API",
    description="""
    ## AI-Powered Data Visualization Platform

    The Auto Visualization Agent API provides intelligent chart recommendations through a sophisticated 3-agent pipeline powered by Google Gemini.

    ### Features
    - **3-Agent AI Pipeline**: Enhanced Data Profiler → Chart Recommender → Validation Agent
    - **10 Chart Types**: Support for all major visualization types
    - **Smart File Processing**: CSV, JSON, Excel, and TSV support
    - **Real-time Progress**: Live agent status updates
    - **Export & Sharing**: PNG/SVG/PDF export and secure link sharing

    ### Workflow
    1. Upload your dataset (up to 100MB, 50k rows)
    2. AI agents analyze data structure, patterns, and quality
    3. Get intelligent chart recommendations with confidence scores
    4. Export visualizations or create shareable links

    ### Supported Chart Types
    Bar, Line, Scatter, Pie, Histogram, Box Plot, Heatmap, Area, Treemap, Sankey

    ### Rate Limits
    - No limits in development mode
    - Production limits: TBD based on usage patterns

    **Built for VTHacks 2025** 🏆
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    contact={
        "name": "Auto Visualization Agent Team",
        "url": "https://github.com/yourusername/vthacks25",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with enhanced metadata
app.include_router(
    health.router,
    prefix="/health",
    tags=["🔍 Health Check"],
    responses={200: {"description": "Service health status"}}
)
app.include_router(
    analysis.router,
    prefix="/api/analysis",
    tags=["🤖 AI Analysis Pipeline"],
    responses={
        200: {"description": "Analysis completed successfully"},
        202: {"description": "Analysis started, check status"},
        400: {"description": "Invalid data or request"},
        422: {"description": "Data validation failed"}
    }
)
app.include_router(
    datasets.router,
    prefix="/api/datasets",
    tags=["📊 Dataset Management"],
    responses={
        200: {"description": "Dataset operation successful"},
        404: {"description": "Dataset not found"}
    }
)
app.include_router(
    visualizations.router,
    prefix="/api/visualizations",
    tags=["📈 Visualization & Sharing"],
    responses={
        200: {"description": "Visualization operation successful"},
        201: {"description": "Visualization created"},
        404: {"description": "Visualization not found"}
    }
)
app.include_router(
    cache.router,
    prefix="/api/cache",
    tags=["🗄️ Cache Management"],
    responses={
        200: {"description": "Cache operation successful"},
        500: {"description": "Cache operation failed"}
    }
)

@app.get("/", tags=["🏠 API Info"])
async def root():
    """
    API Information and Quick Start Guide

    Welcome to the Auto Visualization Agent API! This endpoint provides
    essential information about the API and how to get started.
    """
    return {
        "message": "🤖 Auto Visualization Agent API",
        "version": "1.0.0",
        "status": "🟢 running",
        "description": "AI-powered data visualization platform with 3-agent pipeline",
        "quick_start": {
            "1": "📤 POST /api/analysis/analyze - Upload your dataset",
            "2": "📊 GET /api/analysis/status/{id} - Monitor AI analysis progress",
            "3": "📈 GET /api/analysis/results/{id} - Get chart recommendations",
            "4": "💾 POST /api/visualizations - Save and share your charts"
        },
        "features": {
            "🤖 AI Pipeline": "3 specialized agents: Profiler → Recommender → Validator",
            "📊 Chart Types": "10 types supported: Bar, Line, Scatter, Pie, Histogram, Box Plot, Heatmap, Area, Treemap, Sankey",
            "📁 File Support": "CSV, JSON, Excel (.xlsx/.xls), TSV up to 100MB",
            "🔗 Sharing": "Token-based secure sharing with public links",
            "💾 Export": "PNG, SVG, PDF export functionality"
        },
        "documentation": {
            "🚀 Interactive Docs": "/docs",
            "📚 Alternative Docs": "/redoc",
            "🔍 Health Check": "/health",
            "📖 Full Documentation": "See docs/api-documentation.md"
        },
        "limits": {
            "max_file_size": "100MB",
            "max_rows": "50,000 (recommended for performance)",
            "rate_limit": "None (development mode)"
        },
        "built_for": "🏆 VTHacks 2025"
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