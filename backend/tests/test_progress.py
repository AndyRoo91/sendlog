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
