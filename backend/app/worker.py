"""
Celery worker — executes analysis pipeline tasks out-of-process.
Start with: celery -A app.worker worker --loglevel=info
"""

import asyncio
import logging
from typing import Dict, Any, List

from celery import Celery

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "graphsense",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Alias so `celery -A app.worker` auto-discovers the app instance
app = celery_app

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,           # Re-queue on worker crash
    worker_prefetch_multiplier=1,  # One task at a time per worker
    result_expires=3600,           # Keep results for 1 hour
)


@celery_app.task(
    bind=True,
    name="app.worker.run_analysis",
    max_retries=2,
    default_retry_delay=10,
)
def run_analysis(self, data: List[Dict[str, Any]], dataset_id: str) -> Dict[str, Any]:
    """
    Run the 3-agent pipeline for a dataset.
    Called by the API endpoint instead of FastAPI BackgroundTasks.
    """
    # Celery tasks are synchronous; run the async orchestrator inside a new event loop.
    try:
        from app.services.pipeline_orchestrator import PipelineOrchestrator

        orchestrator = PipelineOrchestrator()
        result = asyncio.run(orchestrator.analyze_dataset(data, dataset_id))
        return {"success": result.success, "dataset_id": result.dataset_id}
    except Exception as exc:
        logger.error(f"Analysis task failed for dataset {dataset_id}: {exc}")
        raise self.retry(exc=exc)
