"""
Analysis endpoint tests.

Supabase and Celery are mocked in conftest.py so no real credentials are needed.
"""

import uuid
from unittest.mock import MagicMock, patch

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


# ── /api/analysis/results ────────────────────────────────────────────────────

def test_results_not_ready(client, mock_supabase):
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])
    r = client.get(f"/api/analysis/results/{uuid.uuid4()}")
    assert r.status_code == 404
