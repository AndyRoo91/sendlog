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
