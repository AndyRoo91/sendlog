"""Tests for Phase Q3: training plans."""
from datetime import date, timedelta


def monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def iso(d: date) -> str:
    return d.isoformat()


def test_plans_require_auth(client):
    client.cookies.clear()
    assert client.get("/api/plan").status_code == 401


def test_list_templates(client):
    t = client.get("/api/plan_templates").json()
    keys = {x["key"] for x in t}
    assert "power_endurance" in keys
    pe = next(x for x in t if x["key"] == "power_endurance")
    assert pe["weeks"] == 4
    assert pe["sessions_per_week"] == 3


def test_no_plan_by_default(client):
    assert client.get("/api/plan").json() is None


def test_create_plan_generates_sessions(client):
    start = monday()
    r = client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)})
    assert r.status_code == 201
    p = r.json()
    assert p["name"] == "4-Week Power Endurance"
    assert p["weeks"] == 4
    assert p["total_count"] == 12  # 4 weeks × 3 sessions
    # First session lands on the start date.
    assert p["sessions"][0]["scheduled_date"] == iso(start)
    # Week 2's first session is 7 days later.
    dates = sorted(s["scheduled_date"] for s in p["sessions"])
    assert iso(start + timedelta(days=7)) in dates


def test_create_unknown_template_rejected(client):
    assert client.post("/api/plan", json={"template_key": "bogus", "start_date": iso(monday())}).status_code == 400


def test_get_plan_returns_active(client):
    start = monday()
    client.post("/api/plan", json={"template_key": "base_fitness", "start_date": iso(start)})
    p = client.get("/api/plan").json()
    assert p["template_key"] == "base_fitness"
    assert p["total_count"] == 9  # 3 weeks × 3


def test_create_plan_replaces_existing(client):
    start = monday()
    client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)})
    client.post("/api/plan", json={"template_key": "max_strength", "start_date": iso(start)})
    p = client.get("/api/plan").json()
    assert p["template_key"] == "max_strength"
    assert p["total_count"] == 12


def test_planned_session_done_when_real_session_logged(client):
    start = monday()
    client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)})
    # Log a real (non-empty) session on the plan's first scheduled day.
    s = client.post("/api/sessions", json={"date": iso(start)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    p = client.get("/api/plan").json()
    first = next(x for x in p["sessions"] if x["scheduled_date"] == iso(start))
    assert first["done"] is True
    assert p["done_count"] == 1


def test_empty_session_does_not_complete_planned(client):
    start = monday()
    client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)})
    client.post("/api/sessions", json={"date": iso(start)})  # no entries
    p = client.get("/api/plan").json()
    assert p["done_count"] == 0


def test_delete_plan(client):
    client.post("/api/plan", json={"template_key": "base_fitness", "start_date": iso(monday())})
    assert client.delete("/api/plan").status_code == 204
    assert client.get("/api/plan").json() is None


def test_plans_are_per_user(client, second_client):
    start = monday()
    client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)})
    assert second_client.get("/api/plan").json() is None
