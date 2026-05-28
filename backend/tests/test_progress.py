def test_progress_shape_empty(client):
    p = client.get("/api/progress").json()
    assert p == {
        "fingerboard_max_weight": [],
        "boulder_max_grade": [],
        "strength_max_weight": [],
        "lead_flash_progression": [],
        "lead_redpoint_progression": [],
        "lead_send_pyramid": [],
    }


def test_progress_lead_flash_and_redpoint(client):
    s1 = client.post("/api/sessions", json={"date": "2026-05-01"}).json()
    s2 = client.post("/api/sessions", json={"date": "2026-05-15"}).json()

    # Two lead ticks: one flash @ 20, one redpoint @ 22
    client.post(f"/api/sessions/{s1['id']}/lead",
                json={"grade": "20", "grade_system": "ewbank", "send_type": "flash"})
    client.post(f"/api/sessions/{s2['id']}/lead",
                json={"grade": "22", "grade_system": "ewbank", "send_type": "redpoint"})

    p = client.get("/api/progress").json()
    assert len(p["lead_flash_progression"]) >= 1
    assert len(p["lead_redpoint_progression"]) >= 1
    # Pyramid counts both as a redpoint-style send (flash counts to flash column)
    pyramid = {row["grade"]: row for row in p["lead_send_pyramid"]}
    assert "20" in pyramid and "22" in pyramid
    assert pyramid["20"]["flash"] == 1
    assert pyramid["22"]["redpoint"] == 1


def test_progress_boulder_max(client):
    s = client.post("/api/sessions", json={"date": "2026-05-10"}).json()
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V4", "send_type": "redpoint"})
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V6", "send_type": "redpoint"})
    p = client.get("/api/progress").json()
    assert len(p["boulder_max_grade"]) == 1
    assert p["boulder_max_grade"][0]["label"] == "V6"
