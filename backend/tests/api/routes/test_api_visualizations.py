"""Visualization CRUD and sharing endpoint tests."""

import uuid
from unittest.mock import MagicMock


DATASET_ID = str(uuid.uuid4())
VIZ_ID = str(uuid.uuid4())
SHARE_TOKEN = "abc123deadbeef00"

SAMPLE_VIZ = {
    "id": VIZ_ID,
    "dataset_id": DATASET_ID,
    "user_id": None,
    "chart_type": "bar",
    "chart_config": {"x_axis": "dept", "y_axis": "salary"},
    "title": "Salary by dept",
    "description": None,
    "is_shared": False,
    "share_token": None,
}


def _mock_returns(mock_supabase, data):
    mock_supabase.table.return_value.execute.return_value = MagicMock(data=data)


# ── Create ────────────────────────────────────────────────────────────────────

def test_create_visualization(client, mock_supabase):
    call_count = 0
    def side_effect():
        nonlocal call_count
        call_count += 1
        # First call: dataset existence check
        if call_count == 1:
            return MagicMock(data=[{"id": DATASET_ID}])
        # Second call: insert
        return MagicMock(data=[SAMPLE_VIZ])

    mock_supabase.table.return_value.execute.side_effect = side_effect

    r = client.post("/api/visualizations/", json={
        "dataset_id": DATASET_ID,
        "chart_type": "bar",
        "chart_config": {"x_axis": "dept", "y_axis": "salary"},
        "title": "Salary by dept",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_create_visualization_dataset_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.post("/api/visualizations/", json={
        "dataset_id": str(uuid.uuid4()),
        "chart_type": "bar",
        "chart_config": {},
    })
    assert r.status_code == 404


# ── Retrieve ──────────────────────────────────────────────────────────────────

def test_get_visualization(client, mock_supabase):
    _mock_returns(mock_supabase, [SAMPLE_VIZ])
    r = client.get(f"/api/visualizations/{VIZ_ID}")
    assert r.status_code == 200
    assert r.json()["id"] == VIZ_ID


def test_get_visualization_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.get(f"/api/visualizations/{uuid.uuid4()}")
    assert r.status_code == 404


# ── Share ─────────────────────────────────────────────────────────────────────

def test_share_visualization(client, mock_supabase):
    shared_viz = {**SAMPLE_VIZ, "is_shared": True, "share_token": SHARE_TOKEN}
    call_count = 0
    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock(data=[{"id": VIZ_ID}])
        return MagicMock(data=[shared_viz])

    mock_supabase.table.return_value.execute.side_effect = side_effect

    r = client.post(f"/api/visualizations/{VIZ_ID}/share")
    assert r.status_code == 200
    body = r.json()
    assert body["share_token"] == SHARE_TOKEN
    assert SHARE_TOKEN in body["share_url"]


def test_get_shared_visualization(client, mock_supabase):
    shared_viz = {**SAMPLE_VIZ, "is_shared": True, "share_token": SHARE_TOKEN}
    _mock_returns(mock_supabase, [shared_viz])
    r = client.get(f"/api/visualizations/shared/{SHARE_TOKEN}")
    assert r.status_code == 200
    assert r.json()["share_token"] == SHARE_TOKEN


def test_get_shared_visualization_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.get("/api/visualizations/shared/invalid-token")
    assert r.status_code == 404


# ── Delete ────────────────────────────────────────────────────────────────────

def test_delete_visualization(client, mock_supabase):
    call_count = 0
    def side_effect():
        nonlocal call_count
        call_count += 1
        return MagicMock(data=[{"id": VIZ_ID}] if call_count == 1 else [])

    mock_supabase.table.return_value.execute.side_effect = side_effect

    r = client.delete(f"/api/visualizations/{VIZ_ID}")
    assert r.status_code == 200
    assert r.json()["success"] is True
