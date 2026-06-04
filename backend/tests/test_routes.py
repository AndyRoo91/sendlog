import pytest


@pytest.fixture
def route(client):
    r = client.post("/api/routes", json={"name": "Kachoong", "grade": "21", "grade_system": "ewbank", "location": "Arapiles"})
    assert r.status_code == 201, r.text
    return r.json()


def test_list_empty(client):
    assert client.get("/api/routes").json() == []


def test_create_get_patch_delete(client, route):
    rid = route["id"]
    got = client.get(f"/api/routes/{rid}").json()
    assert got["name"] == "Kachoong"
    assert got["pins"] == []
    assert got["ticks"] == []

    u = client.patch(f"/api/routes/{rid}", json={"grade": "22"}).json()
    assert u["grade"] == "22"

    assert client.delete(f"/api/routes/{rid}").status_code == 204
    assert client.get(f"/api/routes/{rid}").status_code == 404


def test_pin_crud(client, route):
    rid = route["id"]
    pin = client.post(f"/api/routes/{rid}/pins",
                      json={"date": "2026-05-28", "x": 0.5, "y": 0.7, "kind": "highpoint"}).json()
    assert pin["x"] == 0.5
    assert pin["kind"] == "highpoint"

    u = client.patch(f"/api/pins/{pin['id']}", json={"note": "dropped at the rail"}).json()
    assert u["note"] == "dropped at the rail"

    listed = client.get(f"/api/routes/{rid}").json()
    assert len(listed["pins"]) == 1
    assert listed["pin_count"] if "pin_count" in listed else True  # detail vs summary

    summary = client.get("/api/routes").json()[0]
    assert summary["pin_count"] == 1
    assert summary["last_pin_date"] == "2026-05-28"

    assert client.delete(f"/api/pins/{pin['id']}").status_code == 204
    assert client.get(f"/api/routes/{rid}").json()["pins"] == []


def test_lead_tick_can_link_to_route(client, route):
    sess = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    tick = client.post(f"/api/sessions/{sess['id']}/lead",
                       json={"grade": "21", "grade_system": "ewbank", "send_type": "redpoint",
                             "route_id": route["id"], "route_name": "Kachoong"}).json()
    assert tick["route_id"] == route["id"]
    detail = client.get(f"/api/routes/{route['id']}").json()
    assert len(detail["ticks"]) == 1
    assert detail["ticks"][0]["id"] == tick["id"]


def test_lead_tick_autolinks_by_name(client, route):
    """A lead tick with no route_id but a matching name links to the project."""
    sess = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    # Case-insensitive, whitespace-tolerant match — no route_id supplied.
    tick = client.post(f"/api/sessions/{sess['id']}/lead",
                       json={"grade": "21", "grade_system": "ewbank", "send_type": "redpoint",
                             "route_name": "  kachoong "}).json()
    assert tick["route_id"] == route["id"]
    detail = client.get(f"/api/routes/{route['id']}").json()
    assert [t["id"] for t in detail["ticks"]] == [tick["id"]]


def test_lead_tick_no_autolink_when_name_unknown(client, route):
    """An unknown name leaves the tick unlinked rather than guessing."""
    sess = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    tick = client.post(f"/api/sessions/{sess['id']}/lead",
                       json={"grade": "21", "grade_system": "ewbank", "send_type": "redpoint",
                             "route_name": "Some Other Climb"}).json()
    assert tick["route_id"] is None


def test_lead_tick_autolink_only_matches_lead_projects(client):
    """A boulder project shouldn't capture a lead tick of the same name."""
    boulder = client.post("/api/routes", json={"name": "Twin Cracks", "kind": "boulder", "grade": "V4"}).json()
    sess = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    tick = client.post(f"/api/sessions/{sess['id']}/lead",
                       json={"grade": "18", "grade_system": "ewbank", "send_type": "redpoint",
                             "route_name": "Twin Cracks"}).json()
    assert tick["route_id"] is None
    assert boulder["kind"] == "boulder"


def test_boulder_tick_can_link_to_boulder_project(client):
    """Boulder entries link to a route with kind='boulder' and appear in boulder_ticks."""
    project = client.post("/api/routes", json={
        "name": "The Sitter", "kind": "boulder", "grade": "V7", "grade_system": "vscale"
    }).json()
    assert project["kind"] == "boulder"

    sess = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    tick = client.post(f"/api/sessions/{sess['id']}/boulder",
                       json={"grade": "V7", "send_type": "redpoint",
                             "route_id": project["id"]}).json()
    assert tick["route_id"] == project["id"]

    detail = client.get(f"/api/routes/{project['id']}").json()
    assert detail["kind"] == "boulder"
    assert len(detail["boulder_ticks"]) == 1
    assert detail["boulder_ticks"][0]["id"] == tick["id"]
    assert detail["ticks"] == []


def test_boulder_project_appears_in_list_separately(client):
    """Lead and boulder projects both appear in /api/routes with correct kind."""
    client.post("/api/routes", json={"name": "Kachoong", "kind": "lead", "grade": "21"})
    client.post("/api/routes", json={"name": "The Sitter", "kind": "boulder", "grade": "V7"})
    routes = client.get("/api/routes").json()
    assert len(routes) == 2
    kinds = {r["name"]: r["kind"] for r in routes}
    assert kinds["Kachoong"] == "lead"
    assert kinds["The Sitter"] == "boulder"


def test_delete_route_cascades_pins(client, route):
    rid = route["id"]
    client.post(f"/api/routes/{rid}/pins",
                json={"date": "2026-05-28", "x": 0.1, "y": 0.1, "kind": "fall"})
    client.delete(f"/api/routes/{rid}")
    # Pin should be gone — recreate route and confirm no orphan leaks back
    new_route = client.post("/api/routes", json={"name": "Other"}).json()
    assert client.get(f"/api/routes/{new_route['id']}").json()["pins"] == []
