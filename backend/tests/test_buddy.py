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


def test_buddy_long_session_is_focused(client):
    # Prior PB of V3; today repeats V3 cleanly but the session ran long → focused.
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0), "duration_minutes": 120}).json()
    client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "focused"
    assert b["reason"] == "long_session"


def test_buddy_short_session_not_focused(client):
    # Same shape but a short session stays 'primed' (in form), not focused.
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    today = client.post("/api/sessions", json={"date": day(0), "duration_minutes": 40}).json()
    client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["state"] == "primed"


def test_buddy_achievement_unlock_overrides_session(client):
    # Earlier session sets a V5 PB and unlocks the first-send achievements.
    prev = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{prev['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post("/api/achievements/check")
    # Today: an easy repeat that would otherwise read as 'primed' — the fresh
    # badge wins, so the buddy is stoked for the achievement, not a PB.
    today = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{today['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "stoked"
    assert b["reason"] == "achievement"


def test_buddy_build_zero_when_no_sessions(client):
    assert client.get("/api/buddy").json()["build"] == 0


def test_buddy_build_scrawny_easy_grades(client):
    # A V2 send is below the strong threshold → still scrawny (tier 0).
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V2", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["build"] == 0


def test_buddy_build_tiers_climb_with_grade(client):
    # V3–V5 → tier 1, V6–V8 → tier 2, V9+ → tier 3.
    s1 = client.post("/api/sessions", json={"date": day(-6)}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["build"] == 1

    s2 = client.post("/api/sessions", json={"date": day(-3)}).json()
    client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V7", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["build"] == 2

    s3 = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s3['id']}/boulder", json={"grade": "V10", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["build"] == 3


def test_buddy_build_persists_through_rest(client):
    # Hard all-time send, then a long gap → mood detrained but build stays jacked.
    s = client.post("/api/sessions", json={"date": day(-10)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V9", "send_type": "redpoint"})
    b = client.get("/api/buddy").json()
    assert b["state"] == "detrained"
    assert b["build"] == 3


def test_buddy_build_from_lead_grade(client):
    # Ewbank 24 falls in the 22–25 band → tier 2.
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "24", "grade_system": "ewbank", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["build"] == 2


def test_buddy_build_ignores_unsent_projects(client):
    # Only working a hard grade (no send) doesn't inflate build.
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V12", "send_type": "working"})
    assert client.get("/api/buddy").json()["build"] == 0


def test_buddy_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/buddy").status_code == 401


def test_buddy_is_user_scoped(client, second_client):
    # `client` (tester) logs a fresh PB today; `second_client` (other) has nothing.
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V8", "send_type": "redpoint"})
    assert client.get("/api/buddy").json()["state"] == "stoked"
    assert second_client.get("/api/buddy").json()["state"] == "primed"
