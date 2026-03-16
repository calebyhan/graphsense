"""Health check endpoint tests."""


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "running"


def test_health(client):
    r = client.get("/health/")
    assert r.status_code == 200


def test_health_detailed(client):
    from unittest.mock import patch, AsyncMock
    with patch("app.api.routes.health.test_connection", new=AsyncMock(return_value=True)), \
         patch("app.api.routes.health.psutil.cpu_percent", return_value=0.0):
        r = client.get("/health/detailed")
    assert r.status_code == 200


def test_health_detailed_exception(client):
    """DB or system error during detailed check → 503."""
    from unittest.mock import patch, AsyncMock
    with patch("app.api.routes.health.test_connection", new=AsyncMock(side_effect=RuntimeError("conn fail"))), \
         patch("app.api.routes.health.psutil.cpu_percent", return_value=0.0):
        r = client.get("/health/detailed")
    assert r.status_code == 503
