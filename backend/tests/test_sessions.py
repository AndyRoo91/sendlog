def _create_session(client, **overrides):
    payload = {"date": "2026-05-28", "location": "Arapiles"}
    payload.update(overrides)
    r = client.post("/api/sessions", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_list_empty(client):
    assert client.get("/api/sessions").json() == []


def test_create_and_get(client):
    s = _create_session(client, notes="warmup felt good")
    got = client.get(f"/api/sessions/{s['id']}").json()
    assert got["location"] == "Arapiles"
    assert got["notes"] == "warmup felt good"
    assert got["boulder_entries"] == []
    assert got["lead_route_entries"] == []


def test_get_404(client):
    assert client.get("/api/sessions/999").status_code == 404


def test_patch_session(client):
    s = _create_session(client)
    r = client.patch(f"/api/sessions/{s['id']}", json={"location": "Mt Buffalo"})
    assert r.status_code == 200
    assert r.json()["location"] == "Mt Buffalo"


def test_patch_date(client):
    """Regression: SessionPatch.date used to shadow the date type at class-eval."""
    s = _create_session(client)
    r = client.patch(f"/api/sessions/{s['id']}", json={"date": "2026-06-01"})
    assert r.status_code == 200
    assert r.json()["date"] == "2026-06-01"


def test_delete_session(client):
    s = _create_session(client)
    assert client.delete(f"/api/sessions/{s['id']}").status_code == 204
    assert client.get(f"/api/sessions/{s['id']}").status_code == 404


def test_timer_start_end(client):
    s = _create_session(client)
    started = client.post(f"/api/sessions/{s['id']}/start").json()
    assert started["started_at"] is not None
    ended = client.post(f"/api/sessions/{s['id']}/end").json()
    assert ended["ended_at"] is not None


def test_list_orders_newest_first(client):
    a = _create_session(client, date="2026-05-01")
    b = _create_session(client, date="2026-05-15")
    listed = client.get("/api/sessions").json()
    assert [s["id"] for s in listed[:2]] == [b["id"], a["id"]]
