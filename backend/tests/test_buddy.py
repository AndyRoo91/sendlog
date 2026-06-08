"""Tests for the climbing-buddy mood engine (GET /api/buddy).

State is computed from session history: a recency ladder handles long gaps,
otherwise the most recent session's character drives the mood.
"""
from datetime import date, timedelta


def day(offset: int) -> str:
    """ISO date string `offset` days before today (negative = past)."""
    return (date.today() + timedelta(days=offset)).isoformat()


def test_buddy_no_sessions_is_primed(client):
    b = client.get("/api/buddy").json()
    assert b["state"] == "primed"
    assert b["reason"] == "no_sessions"
    assert b["days_since"] == 0


def test_buddy_long_gap_is_detrained(client):
    s = client.post("/api/sessions", json={"date": day(-10)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "detrained"
    assert b["days_since"] == 10


def test_buddy_rest_days_window(client):
    client.post("/api/sessions", json={"date": day(-5)})
    b = client.get("/api/buddy").json()
    assert b["state"] == "resting"
    assert b["reason"] == "rest_days"


def test_buddy_new_pb_is_stoked(client):
    # First-ever send clears the (empty) prior PB → new personal best.
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V6", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "stoked"
    assert b["reason"] == "new_pb"


def test_buddy_pushing_new_grade_is_nervous(client):
    # Establish a boulder PB of V4, then today only *work* a harder V6 (no send).
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V6", "send_type": "working"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "nervous"
    assert b["reason"] == "new_grade_attempt"


def test_buddy_low_send_rate_is_cooked(client):
    # Prior PB of V5 so today's V3 work isn't a new-grade push; today is mostly working.
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    for _ in range(3):
        client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "working"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "cooked"
    assert b["reason"] == "low_send_rate"


def test_buddy_high_falls_is_cooked(client):
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/lead",
                json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0)}).json()
    # A clean send keeps send_rate high, but heavy falls still read as cooked.
    client.post(f"/api/sessions/{today['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "redpoint", "falls": 4})
    b = client.get("/api/buddy").json()
    assert b["state"] == "cooked"


def test_buddy_training_only_day(client):
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/fingerboard",
                json={"edge_mm": 20, "added_weight_kg": 30, "hang_duration_s": 7, "num_sets": 5})
    b = client.get("/api/buddy").json()
    assert b["state"] == "training"
    assert b["reason"] == "training_only"


def test_buddy_solid_session_is_primed(client):
    # Prior PB of V3; today repeats V3 cleanly — in form, no new ground, no flailing.
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0)}).json()
    for _ in range(3):
        client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "primed"
    assert b["reason"] == "in_form"


def test_buddy_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/buddy").status_code == 401


def test_buddy_is_user_scoped(client, second_client):
    # `client` (tester) logs a fresh PB today; `second_client` (other) has nothing.
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V8", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["state"] == "stoked"
    assert second_client.get("/api/buddy").json()["state"] == "primed"
