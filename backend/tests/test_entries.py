import pytest


@pytest.fixture
def session_id(client):
    r = client.post("/api/sessions", json={"date": "2026-05-28"})
    return r.json()["id"]


def test_warmup_crud(client, session_id):
    r = client.post(f"/api/sessions/{session_id}/warmup", json={"activity": "shoulders", "duration_minutes": 10})
    assert r.status_code == 201
    eid = r.json()["id"]

    u = client.put(f"/api/warmup/{eid}", json={"activity": "shoulders", "duration_minutes": 15})
    assert u.status_code == 200
    assert u.json()["duration_minutes"] == 15

    assert client.delete(f"/api/warmup/{eid}").status_code == 204


def test_fingerboard_crud(client, session_id):
    r = client.post(f"/api/sessions/{session_id}/fingerboard",
                    json={"edge_mm": 20, "added_weight_kg": 10.0, "hang_duration_s": 7, "num_sets": 5})
    assert r.status_code == 201
    eid = r.json()["id"]
    assert client.delete(f"/api/fingerboard/{eid}").status_code == 204


def test_boulder_crud_with_send_type(client, session_id):
    r = client.post(f"/api/sessions/{session_id}/boulder",
                    json={"grade": "V6", "send_type": "flash"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["send_type"] == "flash"
    assert body["grade"] == "V6"
    # auto-start: logging a tick should kick the timer
    sess = client.get(f"/api/sessions/{session_id}").json()
    assert sess["started_at"] is not None
    assert client.delete(f"/api/boulder/{body['id']}").status_code == 204


def test_lead_crud(client, session_id):
    r = client.post(f"/api/sessions/{session_id}/lead",
                    json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint", "route_name": "Kachoong"})
    assert r.status_code == 201
    body = r.json()
    assert body["grade"] == "22"
    assert body["route_name"] == "Kachoong"
    assert client.delete(f"/api/lead/{body['id']}").status_code == 204


def test_strength_crud(client, session_id):
    r = client.post(f"/api/sessions/{session_id}/strength",
                    json={"exercise": "pullups", "reps": 8, "added_weight_kg": 15.0})
    assert r.status_code == 201
    eid = r.json()["id"]
    assert client.delete(f"/api/strength/{eid}").status_code == 204


def test_recent_combos(client, session_id):
    client.post(f"/api/sessions/{session_id}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post(f"/api/sessions/{session_id}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post(f"/api/sessions/{session_id}/lead",
                json={"grade": "21", "grade_system": "ewbank", "send_type": "flash", "route_name": "Kachoong"})
    combos = client.get(f"/api/sessions/{session_id}/recent_combos").json()
    kinds = {c["kind"] for c in combos}
    assert kinds == {"boulder", "lead"}
    v5 = next(c for c in combos if c["kind"] == "boulder")
    assert v5["count"] == 2
    # Lead combo should carry the last route name so recent taps don't drop it.
    lead = next(c for c in combos if c["kind"] == "lead")
    assert lead["last_route_name"] == "Kachoong"
    assert v5["last_route_name"] is None  # boulder has no route name
