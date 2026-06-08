"""Tests for Phase O3: partner tagging and route beta notes."""
from datetime import date


def today() -> str:
    return date.today().isoformat()


# ---------------------------------------------------------------------------
# Partner tagging
# ---------------------------------------------------------------------------

def test_partner_saved_on_session(client):
    s = client.post("/api/sessions", json={"date": today(), "partner": "Sam"}).json()
    assert s["partner"] == "Sam"


def test_partner_patched(client):
    s = client.post("/api/sessions", json={"date": today()}).json()
    updated = client.patch(f"/api/sessions/{s['id']}", json={"partner": "Alex"}).json()
    assert updated["partner"] == "Alex"


def test_partner_cleared(client):
    s = client.post("/api/sessions", json={"date": today(), "partner": "Sam"}).json()
    updated = client.patch(f"/api/sessions/{s['id']}", json={"partner": None}).json()
    assert updated["partner"] is None


def test_list_partners_frequency_order(client):
    # Sam appears twice, Alex once → Sam first.
    for _ in range(2):
        client.post("/api/sessions", json={"date": today(), "partner": "Sam"})
    client.post("/api/sessions", json={"date": today(), "partner": "Alex"})
    partners = client.get("/api/partners").json()
    assert partners[0] == "Sam"
    assert "Alex" in partners


def test_partners_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/partners").status_code == 401


def test_partner_appears_in_feed(client):
    s = client.post("/api/sessions", json={"date": today(), "partner": "Sam"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    feed = client.get("/api/feed").json()
    ev = next(e for e in feed if e["kind"] == "session")
    assert ev["partner"] == "Sam"


# ---------------------------------------------------------------------------
# Beta notes on routes/projects
# ---------------------------------------------------------------------------

def _make_route(c) -> dict:
    return c.post("/api/routes", json={"name": "Test Proj", "kind": "lead", "grade": "22"}).json()


def test_add_route_note(client):
    route = _make_route(client)
    resp = client.post(f"/api/routes/{route['id']}/notes", json={"text": "Crux is the second clip"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Crux is the second clip"
    assert data["username"] == "tester"
    assert data["route_id"] == route["id"]


def test_route_detail_includes_notes_log(client):
    route = _make_route(client)
    client.post(f"/api/routes/{route['id']}/notes", json={"text": "First note"})
    client.post(f"/api/routes/{route['id']}/notes", json={"text": "Second note"})
    detail = client.get(f"/api/routes/{route['id']}").json()
    assert len(detail["notes_log"]) == 2
    assert detail["notes_log"][0]["text"] == "First note"
    assert detail["notes_log"][1]["text"] == "Second note"


def test_delete_own_note(client):
    route = _make_route(client)
    note = client.post(f"/api/routes/{route['id']}/notes", json={"text": "Beta note"}).json()
    assert client.delete(f"/api/route_notes/{note['id']}").status_code == 204
    detail = client.get(f"/api/routes/{route['id']}").json()
    assert detail["notes_log"] == []


def test_cannot_delete_others_note(client, second_client):
    route = _make_route(client)
    note = client.post(f"/api/routes/{route['id']}/notes", json={"text": "Beta note"}).json()
    assert second_client.delete(f"/api/route_notes/{note['id']}").status_code == 403


def test_empty_note_rejected(client):
    route = _make_route(client)
    assert client.post(f"/api/routes/{route['id']}/notes", json={"text": "   "}).status_code == 400


def test_route_notes_require_auth(client):
    route = _make_route(client)
    client.cookies.clear()
    assert client.post(f"/api/routes/{route['id']}/notes", json={"text": "hi"}).status_code == 401
