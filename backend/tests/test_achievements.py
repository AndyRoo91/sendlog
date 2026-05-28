def _new_session(client, **overrides):
    payload = {"date": "2026-05-28", "location": "Arapiles"}
    payload.update(overrides)
    r = client.post("/api/sessions", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _check(client):
    r = client.post("/api/achievements/check")
    assert r.status_code == 200, r.text
    return r.json()["newly_unlocked"]


def test_list_returns_all_locked_initially(client):
    r = client.get("/api/achievements").json()
    assert len(r) > 0
    assert all(a["unlocked"] is False for a in r)
    assert all(a["unlocked_at"] is None for a in r)


def test_first_boulder_unlocks_on_log(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V3", "send_type": "send"})
    new = _check(client)
    codes = {a["code"] for a in new}
    assert "first_boulder" in codes
    # V3 milestone is a redpoint-class send — but send_type "send" doesn't count.
    # The boulder ladder milestone needs a true send (flash/redpoint/onsight).
    assert "boulder_v3" not in codes  # "send" isn't a redpoint-class send_type


def test_first_lead_send_unlocks(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "22", "grade_system": "ewbank", "send_type": "redpoint",
    })
    codes = {a["code"] for a in _check(client)}
    assert "first_lead" in codes
    assert "first_lead_send" in codes
    assert "lead_22" in codes
    assert "lead_18" in codes  # at-or-above: 22 also unlocks 18


def test_check_is_idempotent(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "22", "grade_system": "ewbank", "send_type": "redpoint",
    })
    first = _check(client)
    second = _check(client)
    assert len(first) > 0
    assert second == []


def test_flash_machine_three_flashes_one_session(client):
    s = _new_session(client)
    for _ in range(3):
        client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V2", "send_type": "flash"})
    codes = {a["code"] for a in _check(client)}
    assert "flash_machine" in codes


def test_flash_machine_does_not_fire_for_two_flashes(client):
    s = _new_session(client)
    for _ in range(2):
        client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V2", "send_type": "flash"})
    codes = {a["code"] for a in _check(client)}
    assert "flash_machine" not in codes


def test_easter_egg_v16(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V16", "send_type": "working"})
    codes = {a["code"] for a in _check(client)}
    assert "easter_v16" in codes


def test_easter_egg_grade_38(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "38", "grade_system": "ewbank", "send_type": "working",
    })
    codes = {a["code"] for a in _check(client)}
    assert "easter_grade_38" in codes


def test_project_slayer_attempts(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "20", "grade_system": "ewbank", "send_type": "redpoint", "attempts": 6,
    })
    codes = {a["code"] for a in _check(client)}
    assert "project_slayer" in codes


def test_send_it_sunday(client):
    # 2026-05-31 is a Sunday.
    s = _new_session(client, date="2026-05-31")
    client.post(f"/api/sessions/{s['id']}/boulder", json={"grade": "V2", "send_type": "flash"})
    codes = {a["code"] for a in _check(client)}
    assert "send_it_sunday" in codes


def test_list_after_unlock_shows_unlocked_at(client):
    s = _new_session(client)
    client.post(f"/api/sessions/{s['id']}/lead", json={
        "grade": "20", "grade_system": "ewbank", "send_type": "redpoint",
    })
    _check(client)
    listed = client.get("/api/achievements").json()
    by_code = {a["code"]: a for a in listed}
    assert by_code["first_lead"]["unlocked"] is True
    assert by_code["first_lead"]["unlocked_at"] is not None
    # Still locked
    assert by_code["century_club"]["unlocked"] is False
