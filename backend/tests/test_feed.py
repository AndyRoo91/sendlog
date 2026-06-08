"""Tests for the shared activity feed (GET /api/feed).

The feed is the one read that deliberately spans users — everyone on a sendlog
instance is a trusted friend group. Events derive from existing data (sessions +
achievements); a user can opt out via share_to_feed and vanish from the feed.
"""
from datetime import date, timedelta


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def test_feed_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/feed").status_code == 401


def test_feed_empty_when_no_sessions(client):
    assert client.get("/api/feed").json() == []


def test_feed_includes_own_session(client):
    s = client.post("/api/sessions", json={"date": day(0), "location": "Northside"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    feed = client.get("/api/feed").json()
    assert len(feed) == 1
    ev = feed[0]
    assert ev["kind"] == "session"
    assert ev["username"] == "tester"
    assert ev["location"] == "Northside"
    assert ev["total_ticks"] == 1
    assert ev["boulder_sends"] == 1
    assert ev["hardest_boulder"] == "V4"


def test_feed_skips_empty_sessions(client):
    # A session with no ticks and no training entries isn't feed-worthy.
    client.post("/api/sessions", json={"date": day(0)})
    assert client.get("/api/feed").json() == []


def test_feed_training_only_flag(client):
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/fingerboard",
                json={"edge_mm": 20, "added_weight_kg": 30, "hang_duration_s": 7, "num_sets": 5})
    ev = client.get("/api/feed").json()[0]
    assert ev["training_only"] is True
    assert ev["total_ticks"] == 0


def test_feed_is_cross_user(client, second_client):
    # Both users log a session; each sees BOTH in the shared feed.
    s1 = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    s2 = second_client.post("/api/sessions", json={"date": day(0)}).json()
    second_client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})

    names_seen_by_first = {e["username"] for e in client.get("/api/feed").json()}
    assert names_seen_by_first == {"tester", "other"}
    names_seen_by_second = {e["username"] for e in second_client.get("/api/feed").json()}
    assert names_seen_by_second == {"tester", "other"}


def test_feed_opt_out_hides_user(client, second_client):
    s1 = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    s2 = second_client.post("/api/sessions", json={"date": day(0)}).json()
    second_client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})

    # `other` opts out → vanishes from everyone's feed (including their own).
    r = second_client.post("/api/auth/me/feed_sharing", json={"share": False})
    assert r.status_code == 200
    assert r.json()["share_to_feed"] is False

    assert {e["username"] for e in client.get("/api/feed").json()} == {"tester"}
    assert {e["username"] for e in second_client.get("/api/feed").json()} == {"tester"}

    # Re-enable → reappears.
    second_client.post("/api/auth/me/feed_sharing", json={"share": True})
    assert {e["username"] for e in client.get("/api/feed").json()} == {"tester", "other"}


def test_feed_newest_first(client):
    old = client.post("/api/sessions", json={"date": day(-3)}).json()
    client.post(f"/api/sessions/{old['id']}/boulder", json={"grade": "V2", "send_type": "redpoint"})
    new = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{new['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    feed = client.get("/api/feed").json()
    assert [e["session_id"] for e in feed] == [new["id"], old["id"]]


def test_feed_pb_flag_only_on_new_best(client):
    # First V4 send is a PB; a later easier V2 day is not; a later V6 is again.
    s1 = client.post("/api/sessions", json={"date": day(-4)}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    s2 = client.post("/api/sessions", json={"date": day(-2)}).json()
    client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V2", "send_type": "redpoint"})
    s3 = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s3['id']}/boulder", json={"grade": "V6", "send_type": "redpoint"})

    pb = {e["session_id"]: e["is_pb"] for e in client.get("/api/feed").json()}
    assert pb[s1["id"]] is True
    assert pb[s2["id"]] is False
    assert pb[s3["id"]] is True


def test_feed_includes_achievements(client):
    s = client.post("/api/sessions", json={"date": day(0)}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post("/api/achievements/check")
    feed = client.get("/api/feed").json()
    ach = [e for e in feed if e["kind"] == "achievement"]
    assert ach, "expected at least one achievement event"
    assert all(e["emoji"] and e["title"] for e in ach)
    assert all(e["username"] == "tester" for e in ach)


def test_feed_limit_param(client):
    for i in range(5):
        s = client.post("/api/sessions", json={"date": day(-i)}).json()
        client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V2", "send_type": "redpoint"})
    assert len(client.get("/api/feed?limit=3").json()) == 3


def test_me_includes_share_to_feed_default_on(client):
    assert client.get("/api/auth/me").json()["share_to_feed"] is True


# ---------------------------------------------------------------------------
# Phase O2: reactions / "props"
# ---------------------------------------------------------------------------

def _make_session_with_boulder(c, date_str, grade="V4"):
    """Helper: create a session with one boulder tick, return the feed event."""
    s = c.post("/api/sessions", json={"date": date_str}).json()
    c.post(f"/api/sessions/{s['id']}/boulder", json={"grade": grade, "send_type": "redpoint"})
    feed = c.get("/api/feed").json()
    return next(e for e in feed if e["kind"] == "session")


def test_react_requires_auth(client):
    """Unauthenticated requests to the react endpoint get 401."""
    ev = _make_session_with_boulder(client, day(0))
    anon = client.__class__(client.app, base_url=client.base_url)
    assert anon.post("/api/feed/react", json={"feed_key": ev["feed_key"], "emoji": "🔥"}).status_code == 401


def test_react_adds_reaction(client):
    """POST /api/feed/react creates a reaction; the feed event then shows it."""
    ev = _make_session_with_boulder(client, day(0))
    r = client.post("/api/feed/react", json={"feed_key": ev["feed_key"], "emoji": "🔥"})
    assert r.status_code == 201
    data = r.json()
    assert data["emoji"] == "🔥"
    assert data["feed_key"] == ev["feed_key"]
    reaction_id = data["id"]

    # Feed now reflects the reaction
    feed = client.get("/api/feed").json()
    session_ev = next(e for e in feed if e["kind"] == "session")
    rxn = next(x for x in session_ev["reactions"] if x["emoji"] == "🔥")
    assert rxn["count"] == 1
    assert rxn["reacted"] is True
    assert rxn["reaction_id"] == reaction_id


def test_react_idempotent(client):
    """POSTing the same emoji twice returns the existing row without duplicating it."""
    ev = _make_session_with_boulder(client, day(0))
    key = ev["feed_key"]
    r1 = client.post("/api/feed/react", json={"feed_key": key, "emoji": "💪"})
    r2 = client.post("/api/feed/react", json={"feed_key": key, "emoji": "💪"})
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]  # same row

    feed = client.get("/api/feed").json()
    session_ev = next(e for e in feed if e["kind"] == "session")
    rxn = next(x for x in session_ev["reactions"] if x["emoji"] == "💪")
    assert rxn["count"] == 1  # not duplicated


def test_react_remove(client):
    """DELETE /api/feed/react/{id} removes the reaction; count drops back to 0."""
    ev = _make_session_with_boulder(client, day(0))
    created = client.post("/api/feed/react", json={"feed_key": ev["feed_key"], "emoji": "🎉"}).json()
    assert client.delete(f"/api/feed/react/{created['id']}").status_code == 204

    feed = client.get("/api/feed").json()
    session_ev = next(e for e in feed if e["kind"] == "session")
    assert not any(x["emoji"] == "🎉" for x in session_ev["reactions"])


def test_react_cannot_delete_others(client, second_client):
    """A user cannot delete another user's reaction."""
    ev = _make_session_with_boulder(client, day(0))
    created = client.post("/api/feed/react", json={"feed_key": ev["feed_key"], "emoji": "🔥"}).json()
    assert second_client.delete(f"/api/feed/react/{created['id']}").status_code == 403


def test_react_cross_user_count(client, second_client):
    """Two users reacting with the same emoji shows count=2, each with their own reacted flag."""
    ev = _make_session_with_boulder(client, day(0))
    key = ev["feed_key"]
    client.post("/api/feed/react", json={"feed_key": key, "emoji": "🔥"})
    second_client.post("/api/feed/react", json={"feed_key": key, "emoji": "🔥"})

    feed_tester = client.get("/api/feed").json()
    rxn_tester = next(
        x for e in feed_tester if e["kind"] == "session"
        for x in e["reactions"] if x["emoji"] == "🔥"
    )
    assert rxn_tester["count"] == 2
    assert rxn_tester["reacted"] is True   # tester reacted

    feed_other = second_client.get("/api/feed").json()
    rxn_other = next(
        x for e in feed_other if e["kind"] == "session"
        for x in e["reactions"] if x["emoji"] == "🔥"
    )
    assert rxn_other["count"] == 2
    assert rxn_other["reacted"] is True    # other also reacted


def test_feed_event_has_feed_key(client):
    """Every feed event includes a non-empty feed_key string."""
    ev = _make_session_with_boulder(client, day(0))
    assert ev["feed_key"].startswith("s:")
