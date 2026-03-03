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
    r = client.get("/health/detailed")
    assert r.status_code == 200
