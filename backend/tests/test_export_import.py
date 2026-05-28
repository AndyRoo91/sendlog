"""Tests for GET /api/export and POST /api/import."""


def test_export_empty(client):
    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["version"] == 1
    assert "exported_at" in data
    assert data["sessions"] == []
    assert data["routes"] == []


def test_export_includes_session_and_entries(client):
    # Create a session with a boulder entry
    s = client.post("/api/sessions", json={"date": "2026-05-01"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "flash"})
    client.post(f"/api/sessions/{s['id']}/warmup", json={"activity": "shoulders", "duration_minutes": 10})

    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert len(data["sessions"]) == 1
    session = data["sessions"][0]
    assert session["date"] == "2026-05-01"
    assert len(session["boulder_entries"]) == 1
    assert session["boulder_entries"][0]["grade"] == "V5"
    assert len(session["warmup_entries"]) == 1


def test_export_includes_routes_and_pins(client):
    route = client.post("/api/routes", json={"name": "Kachoong", "grade": "25", "grade_system": "ewbank"}).json()
    client.post(f"/api/routes/{route['id']}/pins", json={"date": "2026-05-01", "x": 0.5, "y": 0.3, "kind": "highpoint"})

    data = client.get("/api/export").json()
    assert len(data["routes"]) == 1
    assert data["routes"][0]["name"] == "Kachoong"
    assert len(data["routes"][0]["pins"]) == 1


def test_roundtrip_export_import(client):
    # Seed data
    s = client.post("/api/sessions", json={"date": "2026-04-10", "location": "Gym"}).json()
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "22", "grade_system": "ewbank", "send_type": "redpoint", "falls": 2,
    })
    client.post("/api/routes", json={"name": "Test Route", "grade": "24", "grade_system": "ewbank"})

    export = client.get("/api/export").json()

    # Wipe and re-import (just import into same DB — checks that records are appended)
    result = client.post("/api/import", json=export)
    assert result.status_code == 201
    body = result.json()
    assert body["sessions_imported"] == 1
    assert body["routes_imported"] == 1

    # Should now have 2 sessions and 2 routes (original + imported copy)
    assert len(client.get("/api/sessions").json()) == 2
    assert len(client.get("/api/routes").json()) == 2


def test_import_rejects_bad_version(client):
    r = client.post("/api/import", json={"version": 99, "sessions": [], "routes": []})
    assert r.status_code == 400


def test_import_empty_payload(client):
    r = client.post("/api/import", json={"version": 1, "sessions": [], "routes": []})
    assert r.status_code == 201
    assert r.json() == {"sessions_imported": 0, "routes_imported": 0}
