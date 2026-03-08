"""
Integration tests — run against a live uvicorn server.

Set API_BASE_URL env var to point at the server (default: http://localhost:8000).
These tests avoid Supabase/Gemini calls where possible so they pass in CI
even when those services are unreachable.
"""

import os
import pytest
import httpx

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")

SMALL_DATA = [
    {"name": "Alice", "age": 30, "salary": 70000},
    {"name": "Bob", "age": 25, "salary": 55000},
    {"name": "Carol", "age": 35, "salary": 90000},
]


@pytest.fixture(scope="module")
def http():
    with httpx.Client(base_url=BASE_URL, timeout=15) as client:
        yield client


# ── Root & health ─────────────────────────────────────────────────────────────

def test_root(http):
    r = http.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "running"


def test_health(http):
    r = http.get("/health/")
    assert r.status_code == 200


def test_health_detailed(http):
    r = http.get("/health/detailed")
    assert r.status_code == 200


# ── Analysis — input validation (no Supabase needed) ─────────────────────────

def test_analyze_empty_data_rejected(http):
    """Empty dataset must be rejected before touching Supabase."""
    r = http.post("/api/analysis/analyze", json={"data": [], "filename": "empty.csv"})
    assert r.status_code == 400


def test_analyze_oversized_data_rejected(http):
    """Datasets over the row limit must be rejected before touching Supabase."""
    big = [{"x": i} for i in range(50001)]
    r = http.post("/api/analysis/analyze", json={"data": big, "filename": "big.csv"})
    assert r.status_code == 400


def test_analyze_missing_data_field_rejected(http):
    """Request without the data field must be rejected (422)."""
    r = http.post("/api/analysis/analyze", json={"filename": "test.csv"})
    assert r.status_code in (400, 422)


def test_analyze_invalid_body_rejected(http):
    """Non-JSON / completely wrong body must be rejected."""
    r = http.post(
        "/api/analysis/analyze",
        content=b"not-json",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422


# ── Analysis — status endpoint ────────────────────────────────────────────────

def test_status_unknown_id_returns_404(http):
    """Status for a non-existent dataset must return 404."""
    r = http.get("/api/analysis/status/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_results_unknown_id_returns_404(http):
    """Results for a non-existent dataset must return 404."""
    r = http.get("/api/analysis/results/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
