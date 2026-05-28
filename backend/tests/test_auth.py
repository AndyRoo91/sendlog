"""Auth flow + cross-user isolation tests."""
from fastapi.testclient import TestClient

import main


def _fresh_client() -> TestClient:
    """A TestClient with no cookies — for testing register / login flows."""
    return TestClient(main.app)


# ---------------------------------------------------------------------------
# Anonymous access is rejected
# ---------------------------------------------------------------------------

def test_anonymous_session_list_requires_auth(client):
    """The standard `client` fixture is already logged in; make a bare client
    to verify the dependency actually rejects missing cookies."""
    anon = _fresh_client()
    r = anon.get("/api/sessions")
    assert r.status_code == 401


def test_anonymous_progress_requires_auth(client):
    anon = _fresh_client()
    assert anon.get("/api/progress").status_code == 401


# ---------------------------------------------------------------------------
# Register / login / logout / me
# ---------------------------------------------------------------------------

def test_register_short_username_rejected(client):
    """Names must be at least 2 chars."""
    r = client.post("/api/auth/register", json={"username": "x", "password": "longenough"})
    assert r.status_code == 400


def test_register_short_password_rejected(client):
    r = client.post("/api/auth/register", json={"username": "newuser", "password": "abc"})
    assert r.status_code == 400


def test_register_duplicate_username(client):
    """`client` already created 'tester' during setup — try to register again."""
    r = client.post("/api/auth/register", json={"username": "tester", "password": "newpass1"})
    assert r.status_code == 409


def test_login_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"username": "tester", "password": "wrong"})
    assert r.status_code == 401


def test_login_sets_cookie_and_me_works(client):
    anon = _fresh_client()
    r = anon.post("/api/auth/login", json={"username": "tester", "password": "testtest"})
    assert r.status_code == 200
    assert r.json()["username"] == "tester"
    me = anon.get("/api/auth/me").json()
    assert me["username"] == "tester"


def test_logout_clears_session(client):
    """After logout, the cookie should no longer authenticate."""
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Cross-user isolation — the meat of multi-user.
# ---------------------------------------------------------------------------

def test_sessions_are_user_scoped(client, second_client):
    """User A's sessions should not be visible to user B."""
    a = client.post("/api/sessions", json={"date": "2026-05-01", "location": "Arapiles"})
    assert a.status_code == 201
    session_id = a.json()["id"]

    # User A sees the session in their list.
    assert any(s["id"] == session_id for s in client.get("/api/sessions").json())

    # User B sees nothing and gets 404 on direct fetch.
    assert second_client.get("/api/sessions").json() == []
    assert second_client.get(f"/api/sessions/{session_id}").status_code == 404
    assert second_client.patch(f"/api/sessions/{session_id}", json={"location": "x"}).status_code == 404
    assert second_client.delete(f"/api/sessions/{session_id}").status_code == 404


def test_routes_are_user_scoped(client, second_client):
    r = client.post("/api/routes", json={"name": "Kachoong", "kind": "lead"})
    assert r.status_code == 201
    route_id = r.json()["id"]

    assert any(rt["id"] == route_id for rt in client.get("/api/routes").json())
    assert second_client.get("/api/routes").json() == []
    assert second_client.get(f"/api/routes/{route_id}").status_code == 404


def test_progress_isolated(client, second_client):
    """Each user's progress only sees their own sessions."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})

    own = client.get("/api/progress").json()
    other = second_client.get("/api/progress").json()
    assert len(own["boulder_max_grade"]) == 1
    assert other["boulder_max_grade"] == []


def test_achievements_isolated(client, second_client):
    """Achievement unlocks belong to the user that triggered them."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    new = client.post("/api/achievements/check").json()["newly_unlocked"]
    assert any(a["code"] == "first_boulder" for a in new)

    # Second user's achievements all still locked.
    other = second_client.get("/api/achievements").json()
    assert all(a["unlocked"] is False for a in other)


def test_entry_crud_blocks_cross_user(client, second_client):
    """Direct entry PUT/DELETE on another user's tick should 404."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    boulder = client.post(
        f"/api/sessions/{s['id']}/boulder",
        json={"grade": "V3", "send_type": "redpoint"},
    ).json()

    assert second_client.delete(f"/api/boulder/{boulder['id']}").status_code == 404
    assert second_client.put(
        f"/api/boulder/{boulder['id']}",
        json={"grade": "V99", "send_type": "redpoint"},
    ).status_code == 404
