"""Tests for Phase Q4: periodisation phases + ACWR-driven deload nudge."""
from datetime import date, timedelta


def monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def iso(d: date) -> str:
    return d.isoformat()


def _boulder(client, session_id, n=1):
    for _ in range(n):
        client.post(f"/api/sessions/{session_id}/boulder", json={"grade": "V2", "send_type": "redpoint"})


def _spike(client):
    """30 days of steady low load, then a big day today → ACWR spikes."""
    today = date.today()
    for d in range(30, 0, -1):
        s = client.post("/api/sessions", json={"date": iso(today - timedelta(days=d))}).json()
        _boulder(client, s["id"], 1)
    s = client.post("/api/sessions", json={"date": iso(today)}).json()
    _boulder(client, s["id"], 12)


# --- Periodisation phases ----------------------------------------------------

def test_plan_exposes_current_phase(client):
    p = client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(date.today())}).json()
    assert p["current_phase"] == "build"   # week 1


def test_phase_advances_with_week(client):
    # Lead endurance: base, build, build, peak. Start 7 days ago → week 2 → build.
    start = date.today() - timedelta(days=7)
    p = client.post("/api/plan", json={"template_key": "lead_endurance", "start_date": iso(start)}).json()
    assert p["current_phase"] == "build"


def test_phase_peak_in_final_week(client):
    start = date.today() - timedelta(days=21)  # week 4 of a 4-week plan
    p = client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(start)}).json()
    assert p["current_phase"] == "peak"


# --- Deload nudge ------------------------------------------------------------

def test_buddy_nudges_deload_on_load_spike(client):
    _spike(client)
    b = client.get("/api/buddy").json()
    assert b["reason"] == "load_spike"
    assert b["state"] == "cooked"
    assert b["load_ratio"] >= 1.5


def test_plan_flags_deload_on_load_spike(client):
    _spike(client)
    client.post("/api/plan", json={"template_key": "power_endurance", "start_date": iso(date.today() - timedelta(days=7))})
    p = client.get("/api/plan").json()
    assert p["deload_suggested"] is True


def test_no_deload_when_load_steady(client):
    # A couple of recent sessions only — not enough history for ACWR → no nudge.
    s = client.post("/api/sessions", json={"date": iso(date.today())}).json()
    _boulder(client, s["id"], 2)
    b = client.get("/api/buddy").json()
    assert b["reason"] != "load_spike"
    p = client.post("/api/plan", json={"template_key": "base_fitness", "start_date": iso(date.today())}).json()
    assert p["deload_suggested"] is False
