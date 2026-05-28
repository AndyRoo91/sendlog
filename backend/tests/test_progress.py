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
