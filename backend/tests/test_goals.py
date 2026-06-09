"""Tests for Phase Q1: weekly training goals + progress."""
from datetime import date, timedelta


def _monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def iso(d: date) -> str:
    return d.isoformat()


def test_goals_default_none(client):
    me = client.get("/api/auth/me").json()
    assert me["weekly_session_goal"] is None
    assert me["weekly_tick_goal"] is None


def test_set_goals(client):
    r = client.post("/api/auth/me/goals", json={"weekly_session_goal": 3, "weekly_tick_goal": 40})
    assert r.status_code == 200
    assert r.json()["weekly_session_goal"] == 3
    assert r.json()["weekly_tick_goal"] == 40
    assert client.get("/api/auth/me").json()["weekly_session_goal"] == 3


def test_zero_goal_clears(client):
    client.post("/api/auth/me/goals", json={"weekly_session_goal": 3, "weekly_tick_goal": 40})
    r = client.post("/api/auth/me/goals", json={"weekly_session_goal": 0, "weekly_tick_goal": None})
    assert r.json()["weekly_session_goal"] is None
    assert r.json()["weekly_tick_goal"] is None


def test_goals_require_auth(client):
    client.cookies.clear()
    assert client.get("/api/weekly_progress").status_code == 401


def test_weekly_progress_empty(client):
    p = client.get("/api/weekly_progress").json()
    assert p["sessions"] == 0
    assert p["ticks"] == 0
    assert p["week_start"] == iso(_monday())


def test_weekly_progress_counts_this_week(client):
    mon = _monday()
    s = client.post("/api/sessions", json={"date": iso(mon + timedelta(days=1))}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "flash"})
    p = client.get("/api/weekly_progress").json()
    assert p["sessions"] == 1
    assert p["ticks"] == 2


def test_weekly_progress_excludes_last_week(client):
    mon = _monday()
    old = client.post("/api/sessions", json={"date": iso(mon - timedelta(days=3))}).json()
    client.post(f"/api/sessions/{old['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    p = client.get("/api/weekly_progress").json()
    assert p["sessions"] == 0
    assert p["ticks"] == 0


def test_weekly_progress_ignores_empty_sessions(client):
    mon = _monday()
    client.post("/api/sessions", json={"date": iso(mon + timedelta(days=1))})  # no entries
    p = client.get("/api/weekly_progress").json()
    assert p["sessions"] == 0  # empty session doesn't count toward the goal


def test_weekly_progress_includes_goals(client):
    client.post("/api/auth/me/goals", json={"weekly_session_goal": 3, "weekly_tick_goal": 40})
    p = client.get("/api/weekly_progress").json()
    assert p["session_goal"] == 3
    assert p["tick_goal"] == 40
