"""Tests for Phase P2: wall sets (reset generations) + tick → wall attribution."""
from datetime import date, timedelta


def iso(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def make_wall(client, gym_name="The Castle", wall_name="Cave"):
    g = client.post("/api/gyms", json={"name": gym_name}).json()
    w = client.post(f"/api/gyms/{g['id']}/walls", json={"name": wall_name}).json()
    return g, w


# --- Set CRUD ---------------------------------------------------------------

def test_create_set_becomes_current(client):
    _, w = make_wall(client)
    r = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(0), "problem_count": 30})
    assert r.status_code == 201
    s = r.json()
    assert s["problem_count"] == 30
    assert s["tick_count"] == 0
    gyms = client.get("/api/gyms").json()
    wall = gyms[0]["walls"][0]
    assert wall["current_set"]["id"] == s["id"]
    assert len(wall["sets"]) == 1


def test_set_defaults_set_on_to_today(client):
    _, w = make_wall(client)
    s = client.post(f"/api/walls/{w['id']}/sets", json={}).json()
    assert s["set_on"] == iso(0)


def test_newest_set_is_current(client):
    _, w = make_wall(client)
    old = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(60), "label": "old"}).json()
    new = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(5), "label": "new"}).json()
    wall = client.get("/api/gyms").json()[0]["walls"][0]
    assert wall["current_set"]["id"] == new["id"]
    # sets listed oldest-first
    assert [s["id"] for s in wall["sets"]] == [old["id"], new["id"]]


def test_update_and_delete_set(client):
    _, w = make_wall(client)
    s = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(0)}).json()
    upd = client.patch(f"/api/sets/{s['id']}", json={"problem_count": 42, "label": "Spring"})
    assert upd.status_code == 200
    assert upd.json()["problem_count"] == 42
    assert upd.json()["label"] == "Spring"
    assert client.delete(f"/api/sets/{s['id']}").status_code == 204
    assert client.get("/api/gyms").json()[0]["walls"][0]["sets"] == []


def test_cannot_touch_others_set(client, second_client):
    _, w = make_wall(client)
    s = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(0)}).json()
    assert second_client.patch(f"/api/sets/{s['id']}", json={"problem_count": 1}).status_code == 404
    assert second_client.delete(f"/api/sets/{s['id']}").status_code == 404


def test_cannot_add_set_to_others_wall(client, second_client):
    _, w = make_wall(client)
    assert second_client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(0)}).status_code == 404


# --- Tick → wall attribution + set progress ---------------------------------

def _tick_boulder(client, session_id, wall_id, grade="V4"):
    return client.post(f"/api/sessions/{session_id}/boulder",
                       json={"grade": grade, "send_type": "redpoint", "wall_id": wall_id})


def test_boulder_tick_carries_wall_id(client):
    _, w = make_wall(client)
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    entry = _tick_boulder(client, s["id"], w["id"]).json()
    assert entry["wall_id"] == w["id"]


def test_lead_tick_carries_wall_id(client):
    _, w = make_wall(client)
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    e = client.post(f"/api/sessions/{s['id']}/lead",
                    json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint",
                          "wall_id": w["id"]}).json()
    assert e["wall_id"] == w["id"]


def test_tick_rejects_foreign_wall(client, second_client):
    _, w = make_wall(second_client)  # other user's wall
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    assert _tick_boulder(client, s["id"], w["id"]).status_code == 404


def test_set_progress_counts_ticks_since_set_on(client):
    _, w = make_wall(client)
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10), "problem_count": 20})
    # Two ticks within the current set window.
    s = client.post("/api/sessions", json={"date": iso(3)}).json()
    _tick_boulder(client, s["id"], w["id"])
    _tick_boulder(client, s["id"], w["id"], grade="V5")
    wall = client.get("/api/gyms").json()[0]["walls"][0]
    assert wall["current_set"]["tick_count"] == 2
    assert wall["current_set"]["problem_count"] == 20


def test_ticks_attribute_to_set_by_date(client):
    _, w = make_wall(client)
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(60), "label": "old"})
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10), "label": "new"})
    # A tick 30 days ago falls in the OLD set's window [60d, 10d).
    s_old = client.post("/api/sessions", json={"date": iso(30)}).json()
    _tick_boulder(client, s_old["id"], w["id"])
    # A tick 3 days ago falls in the NEW (current) set.
    s_new = client.post("/api/sessions", json={"date": iso(3)}).json()
    _tick_boulder(client, s_new["id"], w["id"])
    wall = client.get("/api/gyms").json()[0]["walls"][0]
    by_label = {s["label"]: s for s in wall["sets"]}
    assert by_label["old"]["tick_count"] == 1
    assert by_label["new"]["tick_count"] == 1
    assert wall["current_set"]["label"] == "new"


def test_deleting_wall_detaches_ticks(client):
    _, w = make_wall(client)
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    entry = _tick_boulder(client, s["id"], w["id"]).json()
    client.delete(f"/api/walls/{w['id']}")
    # Tick survives, wall link cleared.
    fetched = client.get(f"/api/sessions/{s['id']}").json()
    bo = next(b for b in fetched["boulder_entries"] if b["id"] == entry["id"])
    assert bo["wall_id"] is None


# ---------------------------------------------------------------------------
# Phase P3a: hold colour on boulder ticks
# ---------------------------------------------------------------------------

def test_boulder_tick_carries_hold_color(client):
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    e = client.post(f"/api/sessions/{s['id']}/boulder",
                    json={"grade": "V4", "send_type": "redpoint", "hold_color": "#e8b800"}).json()
    assert e["hold_color"] == "#e8b800"
    fetched = client.get(f"/api/sessions/{s['id']}").json()
    assert fetched["boulder_entries"][0]["hold_color"] == "#e8b800"


def test_boulder_color_optional(client):
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    e = client.post(f"/api/sessions/{s['id']}/boulder",
                    json={"grade": "V4", "send_type": "redpoint"}).json()
    assert e["hold_color"] is None


def test_boulder_color_editable(client):
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    e = client.post(f"/api/sessions/{s['id']}/boulder",
                    json={"grade": "V4", "send_type": "redpoint", "hold_color": "#d23b3b"}).json()
    upd = client.put(f"/api/boulder/{e['id']}",
                     json={"grade": "V4", "send_type": "redpoint", "hold_color": "#2a6fdb"}).json()
    assert upd["hold_color"] == "#2a6fdb"


def test_update_preserves_wall_and_color_when_passed(client):
    """DetailSheet resends wall_id + hold_color on edit so they survive an update."""
    _, w = make_wall(client)
    s = client.post("/api/sessions", json={"date": iso(0)}).json()
    e = _tick_boulder(client, s["id"], w["id"]).json()
    client.put(f"/api/boulder/{e['id']}", json={"grade": "V4", "send_type": "redpoint",
                                                "hold_color": "#f2c200", "wall_id": w["id"]})
    fetched = client.get(f"/api/sessions/{s['id']}").json()["boulder_entries"][0]
    assert fetched["wall_id"] == w["id"]
    assert fetched["hold_color"] == "#f2c200"


# ---------------------------------------------------------------------------
# Phase P3b: colour circuits (per-colour progress within a set)
# ---------------------------------------------------------------------------

def _color_tick(client, session_id, wall_id, color, grade="V4"):
    return client.post(f"/api/sessions/{session_id}/boulder",
                       json={"grade": grade, "send_type": "redpoint", "wall_id": wall_id,
                             "hold_color": color})


def _current_set(client):
    return client.get("/api/gyms").json()[0]["walls"][0]["current_set"]


def test_circuits_auto_discovered_from_ticks(client):
    _, w = make_wall(client)
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10)})
    s = client.post("/api/sessions", json={"date": iso(3)}).json()
    _color_tick(client, s["id"], w["id"], "#f2c200")
    _color_tick(client, s["id"], w["id"], "#f2c200")
    _color_tick(client, s["id"], w["id"], "#2a6fdb")
    circuits = {c["color"]: c for c in _current_set(client)["circuits"]}
    assert circuits["#f2c200"]["tick_count"] == 2
    assert circuits["#2a6fdb"]["tick_count"] == 1
    assert circuits["#f2c200"]["total_count"] is None  # no total set yet


def test_circuit_total_gives_progress(client):
    _, w = make_wall(client)
    cur = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10)}).json()
    s = client.post("/api/sessions", json={"date": iso(3)}).json()
    _color_tick(client, s["id"], w["id"], "#f2c200")
    r = client.post(f"/api/sets/{cur['id']}/circuits",
                    json={"color": "#f2c200", "total_count": 12})
    assert r.status_code == 201
    assert r.json()["tick_count"] == 1
    assert r.json()["total_count"] == 12
    circ = {c["color"]: c for c in _current_set(client)["circuits"]}["#f2c200"]
    assert circ["total_count"] == 12


def test_circuit_upsert_updates_existing(client):
    _, w = make_wall(client)
    cur = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10)}).json()
    client.post(f"/api/sets/{cur['id']}/circuits", json={"color": "#d23b3b", "total_count": 8})
    client.post(f"/api/sets/{cur['id']}/circuits", json={"color": "#d23b3b", "total_count": 15})
    circuits = _current_set(client)["circuits"]
    reds = [c for c in circuits if c["color"] == "#d23b3b"]
    assert len(reds) == 1
    assert reds[0]["total_count"] == 15


def test_circuit_total_without_ticks(client):
    _, w = make_wall(client)
    cur = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10)}).json()
    # Declare a circuit total before climbing any of that colour.
    client.post(f"/api/sets/{cur['id']}/circuits", json={"color": "#7b3fb5", "total_count": 20})
    circ = {c["color"]: c for c in _current_set(client)["circuits"]}["#7b3fb5"]
    assert circ["tick_count"] == 0
    assert circ["total_count"] == 20


def test_delete_circuit_total(client):
    _, w = make_wall(client)
    cur = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10)}).json()
    c = client.post(f"/api/sets/{cur['id']}/circuits", json={"color": "#7b3fb5", "total_count": 20}).json()
    assert client.delete(f"/api/circuits/{c['circuit_id']}").status_code == 204
    # No ticks of that colour → circuit disappears entirely.
    assert all(x["color"] != "#7b3fb5" for x in _current_set(client)["circuits"])


def test_circuits_scoped_to_set_window(client):
    _, w = make_wall(client)
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(60), "label": "old"})
    client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(10), "label": "new"})
    s_old = client.post("/api/sessions", json={"date": iso(30)}).json()
    _color_tick(client, s_old["id"], w["id"], "#f2c200")
    s_new = client.post("/api/sessions", json={"date": iso(3)}).json()
    _color_tick(client, s_new["id"], w["id"], "#f2c200")
    sets = {x["label"]: x for x in client.get("/api/gyms").json()[0]["walls"][0]["sets"]}
    old_yellow = {c["color"]: c for c in sets["old"]["circuits"]}["#f2c200"]
    new_yellow = {c["color"]: c for c in sets["new"]["circuits"]}["#f2c200"]
    assert old_yellow["tick_count"] == 1
    assert new_yellow["tick_count"] == 1


def test_cannot_add_circuit_to_others_set(client, second_client):
    _, w = make_wall(client)
    cur = client.post(f"/api/walls/{w['id']}/sets", json={"set_on": iso(0)}).json()
    assert second_client.post(f"/api/sets/{cur['id']}/circuits",
                              json={"color": "#f2c200", "total_count": 5}).status_code == 404
