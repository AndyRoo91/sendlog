"""Tests for Phase Q2: saved fingerboard protocols."""


def test_protocols_require_auth(client):
    client.cookies.clear()
    assert client.get("/api/protocols").status_code == 401


def test_protocols_empty_by_default(client):
    assert client.get("/api/protocols").json() == []


def test_create_and_list_protocol(client):
    r = client.post("/api/protocols", json={
        "name": "Max Hangs", "edge_mm": 20, "added_weight_kg": 25,
        "hang_duration_s": 10, "num_sets": 5, "notes": "Heavy, full rest",
    })
    assert r.status_code == 201
    p = r.json()
    assert p["name"] == "Max Hangs"
    assert p["edge_mm"] == 20
    assert p["added_weight_kg"] == 25
    listed = client.get("/api/protocols").json()
    assert [x["id"] for x in listed] == [p["id"]]


def test_create_protocol_minimal(client):
    p = client.post("/api/protocols", json={"name": "Quick"}).json()
    assert p["name"] == "Quick"
    assert p["edge_mm"] is None
    assert p["num_sets"] is None


def test_create_protocol_empty_name_rejected(client):
    assert client.post("/api/protocols", json={"name": "  "}).status_code == 400


def test_delete_protocol(client):
    p = client.post("/api/protocols", json={"name": "Temp"}).json()
    assert client.delete(f"/api/protocols/{p['id']}").status_code == 204
    assert client.get("/api/protocols").json() == []


def test_protocols_are_per_user(client, second_client):
    client.post("/api/protocols", json={"name": "Mine"})
    second_client.post("/api/protocols", json={"name": "Theirs"})
    assert [p["name"] for p in client.get("/api/protocols").json()] == ["Mine"]
    assert [p["name"] for p in second_client.get("/api/protocols").json()] == ["Theirs"]


def test_cannot_delete_others_protocol(client, second_client):
    p = client.post("/api/protocols", json={"name": "Mine"}).json()
    assert second_client.delete(f"/api/protocols/{p['id']}").status_code == 404
