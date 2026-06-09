"""Tests for Phase P1: gyms + walls (first-class indoor venues)."""
from datetime import date


def today() -> str:
    return date.today().isoformat()


# --- Gym CRUD ---------------------------------------------------------------

def test_gyms_require_auth(client):
    client.cookies.clear()
    assert client.get("/api/gyms").status_code == 401


def test_create_and_list_gym(client):
    r = client.post("/api/gyms", json={"name": "The Castle"})
    assert r.status_code == 201
    gym = r.json()
    assert gym["name"] == "The Castle"
    assert gym["walls"] == []
    assert gym["floorplan_filename"] is None
    listed = client.get("/api/gyms").json()
    assert [g["id"] for g in listed] == [gym["id"]]


def test_create_gym_empty_name_rejected(client):
    assert client.post("/api/gyms", json={"name": "   "}).status_code == 400


def test_rename_gym(client):
    g = client.post("/api/gyms", json={"name": "Old"}).json()
    r = client.patch(f"/api/gyms/{g['id']}", json={"name": "New Name"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"


def test_delete_gym(client):
    g = client.post("/api/gyms", json={"name": "Temp"}).json()
    assert client.delete(f"/api/gyms/{g['id']}").status_code == 204
    assert client.get("/api/gyms").json() == []


def test_gyms_are_per_user(client, second_client):
    client.post("/api/gyms", json={"name": "Mine"})
    second_client.post("/api/gyms", json={"name": "Theirs"})
    assert [g["name"] for g in client.get("/api/gyms").json()] == ["Mine"]
    assert [g["name"] for g in second_client.get("/api/gyms").json()] == ["Theirs"]


def test_cannot_touch_others_gym(client, second_client):
    g = client.post("/api/gyms", json={"name": "Mine"}).json()
    assert second_client.patch(f"/api/gyms/{g['id']}", json={"name": "Hijack"}).status_code == 404
    assert second_client.delete(f"/api/gyms/{g['id']}").status_code == 404


# --- Walls ------------------------------------------------------------------

def test_add_walls_to_gym(client):
    g = client.post("/api/gyms", json={"name": "The Castle"}).json()
    w1 = client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Cave", "angle": 45})
    assert w1.status_code == 201
    assert w1.json()["angle"] == 45
    client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Slab", "angle": -10})
    detail = next(x for x in client.get("/api/gyms").json() if x["id"] == g["id"])
    assert [w["name"] for w in detail["walls"]] == ["Cave", "Slab"]


def test_wall_angle_optional(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    w = client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Main"}).json()
    assert w["angle"] is None


def test_update_wall(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    w = client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Cave", "angle": 30}).json()
    r = client.patch(f"/api/walls/{w['id']}", json={"angle": 50})
    assert r.status_code == 200
    assert r.json()["angle"] == 50
    assert r.json()["name"] == "Cave"  # unchanged


def test_delete_wall(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    w = client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Cave"}).json()
    assert client.delete(f"/api/walls/{w['id']}").status_code == 204
    detail = next(x for x in client.get("/api/gyms").json() if x["id"] == g["id"])
    assert detail["walls"] == []


def test_deleting_gym_cascades_walls(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    w = client.post(f"/api/gyms/{g['id']}/walls", json={"name": "Cave"}).json()
    client.delete(f"/api/gyms/{g['id']}")
    # The wall is gone with its gym.
    assert client.patch(f"/api/walls/{w['id']}", json={"name": "x"}).status_code == 404


def test_cannot_add_wall_to_others_gym(client, second_client):
    g = client.post("/api/gyms", json={"name": "Mine"}).json()
    assert second_client.post(f"/api/gyms/{g['id']}/walls", json={"name": "X"}).status_code == 404


# --- Session ↔ gym link -----------------------------------------------------

def test_session_can_reference_gym(client):
    g = client.post("/api/gyms", json={"name": "The Castle"}).json()
    s = client.post("/api/sessions", json={"date": today(), "gym_id": g["id"]}).json()
    assert s["gym_id"] == g["id"]
    fetched = client.get(f"/api/sessions/{s['id']}").json()
    assert fetched["gym_id"] == g["id"]


def test_session_patch_gym(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    s = client.post("/api/sessions", json={"date": today()}).json()
    assert s["gym_id"] is None
    updated = client.patch(f"/api/sessions/{s['id']}", json={"gym_id": g["id"]}).json()
    assert updated["gym_id"] == g["id"]


def test_session_rejects_foreign_gym(client, second_client):
    g = second_client.post("/api/gyms", json={"name": "Theirs"}).json()
    # tester tries to attach the other user's gym → 404
    assert client.post("/api/sessions", json={"date": today(), "gym_id": g["id"]}).status_code == 404


def test_deleting_gym_detaches_sessions(client):
    g = client.post("/api/gyms", json={"name": "G"}).json()
    s = client.post("/api/sessions", json={"date": today(), "gym_id": g["id"]}).json()
    client.delete(f"/api/gyms/{g['id']}")
    fetched = client.get(f"/api/sessions/{s['id']}").json()
    assert fetched["gym_id"] is None  # session survives, link cleared
