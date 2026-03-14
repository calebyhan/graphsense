"""Visualization CRUD and sharing endpoint tests."""

import uuid
from unittest.mock import MagicMock, patch


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


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_visualizations(client, mock_supabase):
    _mock_returns(mock_supabase, [SAMPLE_VIZ])
    r = client.get("/api/visualizations/")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["visualizations"][0]["id"] == VIZ_ID


def test_list_visualizations_filtered_by_dataset(client, mock_supabase):
    _mock_returns(mock_supabase, [SAMPLE_VIZ])
    r = client.get(f"/api/visualizations/?dataset_id={DATASET_ID}")
    assert r.status_code == 200
    assert r.json()["count"] == 1


def test_list_visualizations_with_user_id(mock_supabase):
    """Exercises the user_id filter branch (line 101)."""
    from main import app
    from app.core.auth import get_user_id
    _mock_returns(mock_supabase, [SAMPLE_VIZ])
    user_id = str(uuid.uuid4())

    async def _user():
        return user_id

    app.dependency_overrides[get_user_id] = _user
    try:
        with patch("app.api.routes.visualizations.get_supabase_client", return_value=mock_supabase):
            from fastapi.testclient import TestClient as TC
            r = TC(app).get("/api/visualizations/")
    finally:
        app.dependency_overrides.pop(get_user_id, None)
    assert r.status_code == 200
    mock_supabase.table.return_value.eq.assert_called_with("user_id", user_id)


# ── Update ────────────────────────────────────────────────────────────────────

def test_update_visualization(client, mock_supabase):
    updated = {**SAMPLE_VIZ, "title": "New Title"}
    call_count = 0

    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock(data=[{"id": VIZ_ID, "user_id": None}])
        return MagicMock(data=[updated])

    mock_supabase.table.return_value.execute.side_effect = side_effect
    r = client.put(f"/api/visualizations/{VIZ_ID}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_update_visualization_all_fields(client, mock_supabase):
    """Covers chart_config, description, and is_shared branches (lines 139, 143, 145)."""
    updated = {**SAMPLE_VIZ, "chart_config": {"x": "a"}, "description": "desc", "is_shared": True}
    call_count = 0

    def side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock(data=[{"id": VIZ_ID, "user_id": None}])
        return MagicMock(data=[updated])

    mock_supabase.table.return_value.execute.side_effect = side_effect
    r = client.put(f"/api/visualizations/{VIZ_ID}", json={
        "chart_config": {"x": "a"},
        "description": "desc",
        "is_shared": True,
    })
    assert r.status_code == 200


def test_update_visualization_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.put(f"/api/visualizations/{uuid.uuid4()}", json={"title": "X"})
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


def test_delete_visualization_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.delete(f"/api/visualizations/{uuid.uuid4()}")
    assert r.status_code == 404


def test_share_visualization_not_found(client, mock_supabase):
    _mock_returns(mock_supabase, [])
    r = client.post(f"/api/visualizations/{uuid.uuid4()}/share")
    assert r.status_code == 404
