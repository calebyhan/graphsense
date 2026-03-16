"""
Tests for app/worker.py — Celery task entry point.
Covers the run_analysis task: success path and retry-on-failure path.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def test_celery_app_configured():
    """Celery app object is created with expected serializer config."""
    from app.worker import celery_app

    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert "json" in celery_app.conf.accept_content
    assert celery_app.conf.task_track_started is True
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.result_expires == 3600


def test_run_analysis_success():
    """run_analysis returns a success dict when the orchestrator succeeds."""
    from app.worker import run_analysis

    mock_result = MagicMock()
    mock_result.success = True
    mock_result.dataset_id = "dataset-abc"

    with patch("app.worker.asyncio.run", return_value=mock_result):
        # For bind=True tasks, .run() injects the task itself as `self`
        result = run_analysis.run([{"col": 1}], "dataset-abc")

    assert result == {"success": True, "dataset_id": "dataset-abc"}


def test_run_analysis_exception_triggers_retry():
    """run_analysis calls self.retry when the orchestrator raises an exception."""
    from app.worker import run_analysis

    original_exc = RuntimeError("pipeline failure")
    retry_exc = Exception("celery retry sentinel")

    # For bind=True tasks, `self` is the task object itself; patch .retry on it
    with patch("app.worker.asyncio.run", side_effect=original_exc), \
         patch.object(run_analysis, "retry", side_effect=retry_exc) as mock_retry:
        with pytest.raises(Exception, match="celery retry sentinel"):
            run_analysis.run([{"col": 1}], "dataset-abc")

    mock_retry.assert_called_once_with(exc=original_exc)
