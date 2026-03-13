"""
Analysis endpoint tests.

Supabase and Celery are mocked in conftest.py so no real credentials are needed.
"""

import hashlib
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import SAMPLE_DATA


# ── /api/analysis/analyze ────────────────────────────────────────────────────

def test_analyze_returns_dataset_id(client, mock_supabase):
    """Successful upload returns a dataset_id immediately."""
    # Supabase duplicate-check returns nothing (no existing dataset)
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])

    r = client.post("/api/analysis/analyze", json={
        "data": SAMPLE_DATA,
        "filename": "test.csv",
        "file_type": "csv",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "dataset_id" in body
    assert len(body["dataset_id"]) == 36  # UUID


def test_analyze_rejects_empty_data(client):
    r = client.post("/api/analysis/analyze", json={"data": [], "filename": "empty.csv"})
    assert r.status_code == 400


def test_analyze_rejects_oversized_data(client):
    big = [{"x": i} for i in range(50001)]
    r = client.post("/api/analysis/analyze", json={"data": big, "filename": "big.csv"})
    assert r.status_code == 400


def test_analyze_deduplication(client, mock_supabase):
    """Second identical request within 60 s returns existing dataset_id."""
    existing_id = str(uuid.uuid4())
    # Simulate Supabase returning an existing dataset with the same filename
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[
        {"id": existing_id, "filename": "test.csv", "metadata": {}}
    ])

    r = client.post("/api/analysis/analyze", json={
        "data": SAMPLE_DATA,
        "filename": "test.csv",
        "file_type": "csv",
    })
    assert r.status_code == 200
    assert r.json()["dataset_id"] == existing_id


# ── /api/analysis/status ─────────────────────────────────────────────────────

def test_status_not_found(client, mock_supabase):
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    r = client.get(f"/api/analysis/status/{uuid.uuid4()}")
    assert r.status_code == 404


def test_status_returns_progress(client, mock_supabase):
    dataset_id = str(uuid.uuid4())

    # First call: dataset table → returns processing status
    # Second call: agent_analyses table → returns completed profiler
    call_count = 0
    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock(data=[{"processing_status": "processing"}])
        return MagicMock(data=[{"agent_type": "profiler"}])

    mock_supabase.table.return_value.execute.side_effect = side_effect

    r = client.get(f"/api/analysis/status/{dataset_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "processing"
    assert body["progress"]["profiler"] is True


def test_analyze_redis_dedup_hit(client, mock_redis):
    """Redis cache hit returns cached dataset_id without hitting Supabase."""
    cached_id = str(uuid.uuid4())
    mock_redis.get.return_value = cached_id
    r = client.post("/api/analysis/analyze", json={"data": SAMPLE_DATA, "filename": "test.csv"})
    assert r.status_code == 200
    assert r.json()["dataset_id"] == cached_id


def test_analyze_empty_dataframe(client):
    """Data with all-empty dicts produces empty DataFrame → 400."""
    r = client.post("/api/analysis/analyze", json={"data": [{}], "filename": "empty.csv"})
    assert r.status_code == 400


def test_analyze_parse_error(client):
    """DataFrame construction failure → 400."""
    with patch("app.api.routes.analysis.pd.DataFrame", side_effect=ValueError("bad")):
        r = client.post("/api/analysis/analyze", json={"data": SAMPLE_DATA, "filename": "bad.csv"})
    assert r.status_code == 400


def test_analyze_content_hash_dedup(client, mock_supabase):
    """Content hash match in DB (no filename match) returns existing dataset_id."""
    content_hash = hashlib.md5(json.dumps({
        "filename": "test.csv",
        "row_count": len(SAMPLE_DATA),
        "columns": sorted(SAMPLE_DATA[0].keys()),
        "first_row": SAMPLE_DATA[0],
        "last_row": SAMPLE_DATA[-1],
    }, sort_keys=True).encode()).hexdigest()
    existing_id = str(uuid.uuid4())
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[{
        "id": existing_id,
        "filename": "other.csv",
        "metadata": {"content_hash": content_hash},
    }])
    r = client.post("/api/analysis/analyze", json={"data": SAMPLE_DATA, "filename": "test.csv"})
    assert r.status_code == 200
    assert r.json()["dataset_id"] == existing_id


def test_analyze_with_existing_dataset_id(client, mock_supabase):
    """Providing dataset_id reuses existing dataset instead of creating a new one."""
    dataset_id = str(uuid.uuid4())
    call_count = 0

    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:  # recent datasets dedup check → no duplicates
            return MagicMock(data=[])
        return MagicMock(data=[{"id": dataset_id, "processing_status": "processing"}])

    mock_supabase.table.return_value.execute.side_effect = side_effect
    r = client.post("/api/analysis/analyze", json={
        "data": SAMPLE_DATA,
        "filename": "test.csv",
        "dataset_id": dataset_id,
    })
    assert r.status_code == 200
    assert r.json()["dataset_id"] == dataset_id


def test_analyze_with_existing_dataset_id_not_found(client, mock_supabase):
    """Providing a non-existent dataset_id → 404."""
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    r = client.post("/api/analysis/analyze", json={
        "data": SAMPLE_DATA,
        "filename": "test.csv",
        "dataset_id": str(uuid.uuid4()),
    })
    assert r.status_code == 404


def test_analyze_with_canvas_id_links_dataset(client, mock_supabase):
    """canvas_id with edit permission inserts into canvas_datasets and returns 200."""
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="owner")):
        r = client.post("/api/analysis/analyze", json={
            "data": SAMPLE_DATA,
            "filename": "test.csv",
            "canvas_id": str(uuid.uuid4()),
        })
    assert r.status_code == 200


def test_analyze_with_canvas_id_no_permission(client, mock_supabase):
    """canvas_id with view-only permission → 403."""
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    with patch("app.api.routes.canvases.get_canvas_permission", new=AsyncMock(return_value="view")):
        r = client.post("/api/analysis/analyze", json={
            "data": SAMPLE_DATA,
            "filename": "test.csv",
            "canvas_id": str(uuid.uuid4()),
        })
    assert r.status_code == 403


def test_analyze_generic_exception(client, mock_supabase):
    """Unexpected DB error → 500."""
    mock_supabase.table.return_value.execute.side_effect = RuntimeError("db boom")
    r = client.post("/api/analysis/analyze", json={"data": SAMPLE_DATA, "filename": "test.csv"})
    assert r.status_code == 500


# ── /api/analysis/status ─────────────────────────────────────────────────────

def test_status_error(client):
    """Orchestrator error status → 500."""
    with patch("app.api.routes.analysis._get_orchestrator") as mock_orch:
        inst = MagicMock()
        inst.get_status = AsyncMock(return_value={"status": "error", "error": "pipeline failed"})
        mock_orch.return_value = inst
        r = client.get(f"/api/analysis/status/{uuid.uuid4()}")
    assert r.status_code == 500


def test_status_generic_exception(client):
    """Unexpected orchestrator error → 500."""
    with patch("app.api.routes.analysis._get_orchestrator") as mock_orch:
        inst = MagicMock()
        inst.get_status = AsyncMock(side_effect=RuntimeError("unexpected"))
        mock_orch.return_value = inst
        r = client.get(f"/api/analysis/status/{uuid.uuid4()}")
    assert r.status_code == 500


# ── /api/analysis/results ────────────────────────────────────────────────────

def test_results_not_ready(client, mock_supabase):
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    r = client.get(f"/api/analysis/results/{uuid.uuid4()}")
    assert r.status_code == 404


def test_results_found(client):
    """Results returns 200 when analysis is complete."""
    dataset_id = str(uuid.uuid4())
    mock_result = {
        "success": True,
        "dataset_id": dataset_id,
        "recommendations": [],
        "processing_time_ms": 100,
        "message": "Done",
    }
    with patch("app.api.routes.analysis._get_orchestrator") as mock_orch:
        inst = MagicMock()
        inst.get_results = AsyncMock(return_value=mock_result)
        mock_orch.return_value = inst
        r = client.get(f"/api/analysis/results/{dataset_id}")
    assert r.status_code == 200
    assert r.json()["dataset_id"] == dataset_id


def test_results_generic_exception(client):
    """Unexpected orchestrator error → 500."""
    with patch("app.api.routes.analysis._get_orchestrator") as mock_orch:
        inst = MagicMock()
        inst.get_results = AsyncMock(side_effect=RuntimeError("unexpected"))
        mock_orch.return_value = inst
        r = client.get(f"/api/analysis/results/{uuid.uuid4()}")
    assert r.status_code == 500


# ── /api/analysis/ ────────────────────────────────────────────────────────────

def test_analysis_info(client):
    """GET /api/analysis/ returns endpoint listing."""
    r = client.get("/api/analysis/")
    assert r.status_code == 200
    assert "endpoints" in r.json()
