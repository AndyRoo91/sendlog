def test_progress_shape_empty(client):
    p = client.get("/api/progress").json()
    assert p == {
        "fingerboard_max_weight": [],
        "boulder_max_grade": [],
        "strength_max_weight": [],
        "lead_onsight_progression": [],
        "lead_flash_progression": [],
        "lead_redpoint_progression": [],
        "lead_send_pyramid": [],
        "boulder_send_pyramid": [],
        "session_volume": [],
        "send_rate": [],
        "falls_trend": [],
        "mood_vs_send_rate": [],
        "location_breakdown": [],
        "attempts_histogram": [
            {"bucket": "1", "count": 0},
            {"bucket": "2", "count": 0},
            {"bucket": "3", "count": 0},
            {"bucket": "4", "count": 0},
            {"bucket": "5+", "count": 0},
        ],
        "pb_timeline": [],
    }


def test_progress_lead_flash_and_redpoint(client):
    s1 = client.post("/api/sessions", json={"date": "2026-05-01"}).json()
    s2 = client.post("/api/sessions", json={"date": "2026-05-15"}).json()

    client.post(f"/api/sessions/{s1['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "flash"})
    client.post(f"/api/sessions/{s2['id']}/lead",
                json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint"})

    p = client.get("/api/progress").json()
    assert len(p["lead_flash_progression"]) >= 1
    assert len(p["lead_redpoint_progression"]) >= 1
    pyramid = {row["grade"]: row for row in p["lead_send_pyramid"]}
    assert "20" in pyramid and "22" in pyramid
    assert pyramid["20"]["flash"] == 1
    assert pyramid["22"]["redpoint"] == 1


def test_progress_onsight_is_first_class(client):
    """Onsight is its own progression series and pyramid column — not folded into flash."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "21", "grade_system": "ewbank", "send_type": "onsight"})

    p = client.get("/api/progress").json()
    assert len(p["lead_onsight_progression"]) == 1
    assert p["lead_onsight_progression"][0]["label"] == "21"
    assert p["lead_flash_progression"] == []  # onsight should NOT spill into flash
    pyramid = {row["grade"]: row for row in p["lead_send_pyramid"]}
    assert pyramid["21"]["onsight"] == 1
    assert pyramid["21"]["flash"] == 0


def test_progress_toprope_logged_but_not_in_aggregates(client):
    """Toprope is logged as a tick but kept out of lead progression/pyramid."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    r = client.post(f"/api/sessions/{s['id']}/lead",
                    json={"grade": "23", "grade_system": "ewbank", "send_type": "toprope"})
    assert r.status_code == 201, r.text
    p = client.get("/api/progress").json()
    assert p["lead_onsight_progression"] == []
    assert p["lead_flash_progression"] == []
    assert p["lead_redpoint_progression"] == []
    assert p["lead_send_pyramid"] == []


def test_progress_boulder_max(client):
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V6", "send_type": "redpoint"})
    p = client.get("/api/progress").json()
    assert len(p["boulder_max_grade"]) == 1
    assert p["boulder_max_grade"][0]["label"] == "V6"


def test_progress_volume_send_rate_falls(client):
    """Session volume, send rate, and falls trend computed correctly."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    # 2 sends, 1 working = 2/3 sends = 67%
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "flash"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V3", "send_type": "working"})
    # 1 lead with 3 falls
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "redpoint", "falls": 3})

    p = client.get("/api/progress").json()

    assert len(p["session_volume"]) == 1
    assert p["session_volume"][0]["value"] == 4  # 3 boulder + 1 lead

    assert len(p["send_rate"]) == 1
    assert p["send_rate"][0]["value"] == 75  # 3 sends out of 4 ticks (lead redpoint counts)

    assert len(p["falls_trend"]) == 1
    assert p["falls_trend"][0]["value"] == 3.0


def test_progress_volume_excludes_empty_sessions(client):
    """Sessions with no climbing ticks (warmup-only) are excluded from volume."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/warmup", json={"activity": "stretch"})

    p = client.get("/api/progress").json()
    assert p["session_volume"] == []
    assert p["send_rate"] == []


def test_progress_falls_trend_excludes_no_falls_data(client):
    """Sessions where no lead entry has falls data are excluded from falls trend."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    # lead with no falls field
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "redpoint"})

    p = client.get("/api/progress").json()
    assert p["falls_trend"] == []


def test_progress_boulder_send_pyramid(client):
    """Boulder pyramid counts flash and send (redpoint) per grade, sorted hardest first."""
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "flash"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V7", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V5", "send_type": "working"})  # excluded

    p = client.get("/api/progress").json()
    pyramid = {row["grade"]: row for row in p["boulder_send_pyramid"]}

    assert "V5" in pyramid
    assert "V7" in pyramid
    assert pyramid["V5"]["flash"] == 1
    assert pyramid["V5"]["send"] == 1
    assert pyramid["V7"]["send"] == 1
    assert pyramid["V7"]["flash"] == 0

    # hardest grade should come first
    grades = [row["grade"] for row in p["boulder_send_pyramid"]]
    assert grades[0] == "V7"
    assert grades[1] == "V5"


# ---------- Phase I: mood / location / attempts / PB ----------

def test_mood_persists_on_session(client):
    """SessionPatch.mood and SessionCreate.mood both persist."""
    s = client.post("/api/sessions", json={"date": "2026-05-10", "mood": 4}).json()
    assert s["mood"] == 4
    r = client.patch(f"/api/sessions/{s['id']}", json={"mood": 5})
    assert r.json()["mood"] == 5
    # Clearing the mood
    r = client.patch(f"/api/sessions/{s['id']}", json={"mood": None})
    assert r.json()["mood"] is None


def test_progress_mood_vs_send_rate(client):
    """Average send-rate per mood across the sessions that reported it."""
    # Mood 5 session: 2 sends out of 2 ticks → 100%
    s1 = client.post("/api/sessions", json={"date": "2026-05-01", "mood": 5}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V3", "send_type": "flash"})
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    # Mood 2 session: 0 sends out of 2 ticks → 0%
    s2 = client.post("/api/sessions", json={"date": "2026-05-02", "mood": 2}).json()
    client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V3", "send_type": "working"})
    client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V3", "send_type": "working"})
    # No-mood session — excluded from the breakdown
    s3 = client.post("/api/sessions", json={"date": "2026-05-03"}).json()
    client.post(f"/api/sessions/{s3['id']}/boulder", json={"grade": "V3", "send_type": "flash"})

    p = client.get("/api/progress").json()
    by_mood = {r["mood"]: r for r in p["mood_vs_send_rate"]}
    assert by_mood == {
        2: {"mood": 2, "send_rate": 0.0, "sessions": 1},
        5: {"mood": 5, "send_rate": 100.0, "sessions": 1},
    }


def test_progress_location_breakdown(client):
    """Per-location aggregates: sessions, total ticks, send rate (%)."""
    sa = client.post("/api/sessions", json={"date": "2026-05-01", "location": "Arapiles"}).json()
    client.post(f"/api/sessions/{sa['id']}/boulder", json={"grade": "V3", "send_type": "flash"})
    client.post(f"/api/sessions/{sa['id']}/boulder", json={"grade": "V3", "send_type": "working"})
    sb = client.post("/api/sessions", json={"date": "2026-05-02", "location": "Arapiles"}).json()
    client.post(f"/api/sessions/{sb['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    sc = client.post("/api/sessions", json={"date": "2026-05-03", "location": "The Reach"}).json()
    client.post(f"/api/sessions/{sc['id']}/boulder", json={"grade": "V3", "send_type": "redpoint"})
    # No-location session — excluded
    client.post("/api/sessions", json={"date": "2026-05-04"})

    p = client.get("/api/progress").json()
    by_loc = {r["location"]: r for r in p["location_breakdown"]}
    assert by_loc["Arapiles"]["sessions"] == 2
    assert by_loc["Arapiles"]["total_ticks"] == 3
    assert by_loc["Arapiles"]["send_rate"] == round(2 / 3 * 100, 1)
    assert by_loc["The Reach"]["sessions"] == 1
    assert by_loc["The Reach"]["send_rate"] == 100.0
    # Sort: most ticks first
    assert p["location_breakdown"][0]["location"] == "Arapiles"


def test_progress_attempts_histogram(client):
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    # 2 sends on attempt 1
    for _ in range(2):
        client.post(f"/api/sessions/{s['id']}/boulder",
                    json={"grade": "V3", "send_type": "flash", "attempts": 1})
    # 1 send on attempt 4
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint", "attempts": 4})
    # 1 send on attempt 7 (5+ bucket)
    client.post(f"/api/sessions/{s['id']}/lead",
                json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint", "attempts": 7})
    # Non-send (working) → excluded from histogram
    client.post(f"/api/sessions/{s['id']}/boulder",
                json={"grade": "V3", "send_type": "working", "attempts": 2})

    p = client.get("/api/progress").json()
    by_b = {r["bucket"]: r["count"] for r in p["attempts_histogram"]}
    assert by_b == {"1": 2, "2": 0, "3": 0, "4": 1, "5+": 1}


def test_progress_pb_timeline(client):
    """Only emit a point when either PB improves; runs forward as a running max."""
    s1 = client.post("/api/sessions", json={"date": "2026-05-01"}).json()
    client.post(f"/api/sessions/{s1['id']}/boulder", json={"grade": "V3", "send_type": "flash"})
    client.post(f"/api/sessions/{s1['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "redpoint"})
    # Session 2 — no new PBs, no point emitted
    s2 = client.post("/api/sessions", json={"date": "2026-05-02"}).json()
    client.post(f"/api/sessions/{s2['id']}/boulder", json={"grade": "V2", "send_type": "flash"})
    # Session 3 — boulder PB only
    s3 = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s3['id']}/boulder", json={"grade": "V5", "send_type": "redpoint"})

    p = client.get("/api/progress").json()
    pts = p["pb_timeline"]
    assert len(pts) == 2  # only session 1 and session 3 produced new PBs
    assert pts[0]["lead_grade"] == "20"
    assert pts[0]["boulder_grade"] == "V3"
    # session 3 boulder PB advanced, lead still 20 (running)
    assert pts[1]["lead_grade"] == "20"
    assert pts[1]["boulder_grade"] == "V5"
