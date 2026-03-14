"""Dataset CRUD endpoint tests."""

import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


DATASET_ID = str(uuid.uuid4())
SAMPLE_DATASET = {
    "id": DATASET_ID,
    "user_id": None,
    "filename": "sales.csv",
    "file_type": "csv",
    "processing_status": "completed",
    "metadata": {},
}


def _make_supabase(data=None):
    t = MagicMock()
    for m in ["select", "insert", "update", "delete", "eq", "order", "range", "limit"]:
        getattr(t, m).return_value = t
    t.execute.return_value = MagicMock(data=data if data is not None else [])
    sb = MagicMock()
    sb.table.return_value = t
    return sb, t


# ── list_datasets ─────────────────────────────────────────────────────────────

def test_list_datasets():
    sb, _ = _make_supabase([SAMPLE_DATASET])
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app).get("/api/datasets/")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["datasets"][0]["id"] == DATASET_ID


def test_list_datasets_filtered_by_user():
    user_id = str(uuid.uuid4())
    sb, t = _make_supabase([SAMPLE_DATASET])
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app).get(f"/api/datasets/?user_id={user_id}")
    assert r.status_code == 200
    t.eq.assert_called_with("user_id", user_id)


def test_list_datasets_db_error():
    sb, t = _make_supabase()
    t.execute.side_effect = RuntimeError("db down")
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).get("/api/datasets/")
    assert r.status_code == 500


# ── get_dataset ───────────────────────────────────────────────────────────────

def test_get_dataset():
    sb, _ = _make_supabase([SAMPLE_DATASET])
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app).get(f"/api/datasets/{DATASET_ID}")
    assert r.status_code == 200
    assert r.json()["id"] == DATASET_ID


def test_get_dataset_not_found():
    sb, _ = _make_supabase([])
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).get(f"/api/datasets/{uuid.uuid4()}")
    assert r.status_code == 404


def test_get_dataset_db_error():
    sb, t = _make_supabase()
    t.execute.side_effect = RuntimeError("db down")
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).get(f"/api/datasets/{DATASET_ID}")
    assert r.status_code == 500


# ── delete_dataset ────────────────────────────────────────────────────────────

def test_delete_dataset():
    sb, t = _make_supabase()
    call_count = 0

    def side_effect():
        nonlocal call_count
        call_count += 1
        return MagicMock(data=[{"id": DATASET_ID}] if call_count == 1 else [])

    t.execute.side_effect = side_effect
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app).delete(f"/api/datasets/{DATASET_ID}")
    assert r.status_code == 200
    assert r.json()["message"] == "Dataset deleted successfully"


def test_delete_dataset_not_found():
    sb, _ = _make_supabase([])
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).delete(f"/api/datasets/{uuid.uuid4()}")
    assert r.status_code == 404


def test_delete_dataset_db_error():
    sb, t = _make_supabase()
    t.execute.side_effect = RuntimeError("db down")
    from main import app
    with patch("app.api.routes.datasets.get_supabase_client", return_value=sb):
        r = TestClient(app, raise_server_exceptions=False).delete(f"/api/datasets/{DATASET_ID}")
    assert r.status_code == 500
