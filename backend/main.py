import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession

import models
import schemas
from database import Base, engine, get_db, run_migrations

PHOTOS_DIR = Path(os.getenv("PHOTOS_DIR", "./photos"))
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}

BOULDER_GRADE_ORDER = [
    "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9",
    "V10", "V11", "V12", "V13", "V14", "V15", "V16",
]
EWBANK_GRADE_ORDER = [str(n) for n in range(1, 39)]
YDS_GRADE_ORDER = [
    "5.6", "5.7", "5.8", "5.9",
    "5.10a", "5.10b", "5.10c", "5.10d",
    "5.11a", "5.11b", "5.11c", "5.11d",
    "5.12a", "5.12b", "5.12c", "5.12d",
    "5.13a", "5.13b", "5.13c", "5.13d",
    "5.14a", "5.14b", "5.14c", "5.14d",
    "5.15a", "5.15b", "5.15c", "5.15d",
]
FRENCH_GRADE_ORDER = [
    "5a", "5b", "5c",
    "6a", "6a+", "6b", "6b+", "6c", "6c+",
    "7a", "7a+", "7b", "7b+", "7c", "7c+",
    "8a", "8a+", "8b", "8b+", "8c", "8c+",
    "9a", "9a+", "9b", "9b+", "9c",
]
REDPOINT_SENDS = {"redpoint", "onsight", "flash", "pinkpoint"}
GRADE_ORDERS = {"ewbank": EWBANK_GRADE_ORDER, "yds": YDS_GRADE_ORDER, "french": FRENCH_GRADE_ORDER}


def grade_to_int(grade: str, order: list[str]) -> int:
    try:
        return order.index(grade)
    except ValueError:
        return -1


def attach_photos(entries: list, entry_type: str, db: DBSession) -> None:
    if not entries:
        return
    ids = [e.id for e in entries]
    photos = (
        db.query(models.EntryPhoto)
        .filter(models.EntryPhoto.entry_type == entry_type, models.EntryPhoto.entry_id.in_(ids))
        .all()
    )
    photo_map: dict[int, list] = {}
    for p in photos:
        photo_map.setdefault(p.entry_id, []).append(p)
    for e in entries:
        e.photos = photo_map.get(e.id, [])


def get_session_or_404(session_id: int, db: DBSession) -> models.Session:
    s = db.get(models.Session, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def auto_start(session: models.Session) -> None:
    """Start the timer on the first logged tick if not already running."""
    if session.started_at is None:
        session.started_at = datetime.utcnow()


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    Base.metadata.create_all(bind=engine)
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Climbing Training Log", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Photos
# ---------------------------------------------------------------------------

@app.post("/api/photos/upload", response_model=schemas.EntryPhoto, status_code=201)
async def upload_photo(
    entry_type: str,
    entry_id: int,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
):
    if entry_type not in ("lead", "boulder"):
        raise HTTPException(status_code=400, detail="entry_type must be 'lead' or 'boulder'")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and HEIC images are accepted")
    ext = Path(file.filename or "photo.jpg").suffix.lower() or ".jpg"
    filename = f"{entry_type}_{entry_id}_{uuid.uuid4().hex}{ext}"
    (PHOTOS_DIR / filename).write_bytes(await file.read())
    photo = models.EntryPhoto(entry_type=entry_type, entry_id=entry_id, filename=filename)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@app.delete("/api/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: DBSession = Depends(get_db)):
    photo = db.get(models.EntryPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    path = PHOTOS_DIR / photo.filename
    if path.exists():
        path.unlink()
    db.delete(photo)
    db.commit()


# ---------------------------------------------------------------------------
# Sessions (header CRUD)
# ---------------------------------------------------------------------------

@app.get("/api/sessions", response_model=list[schemas.SessionSummary])
def list_sessions(db: DBSession = Depends(get_db)):
    return db.query(models.Session).order_by(models.Session.date.desc()).all()


@app.post("/api/sessions", response_model=schemas.SessionDetail, status_code=201)
def create_session(payload: schemas.SessionCreate, db: DBSession = Depends(get_db)):
    session = models.Session(
        date=payload.date,
        location=payload.location,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/api/sessions/{session_id}", response_model=schemas.SessionDetail)
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.patch("/api/sessions/{session_id}", response_model=schemas.SessionDetail)
def patch_session(
    session_id: int, payload: schemas.SessionPatch, db: DBSession = Depends(get_db)
):
    session = get_session_or_404(session_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    for entry in list(session.boulder_entries) + list(session.lead_route_entries):
        etype = "boulder" if isinstance(entry, models.LimitBoulderEntry) else "lead"
        for photo in db.query(models.EntryPhoto).filter_by(entry_type=etype, entry_id=entry.id).all():
            p = PHOTOS_DIR / photo.filename
            if p.exists():
                p.unlink()
            db.delete(photo)
    db.delete(session)
    db.commit()


# ---------------------------------------------------------------------------
# Session timer + recents
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/start", response_model=schemas.SessionDetail)
def start_session(session_id: int, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    if session.started_at is None:
        session.started_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.post("/api/sessions/{session_id}/end", response_model=schemas.SessionDetail)
def end_session(session_id: int, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    session.ended_at = datetime.utcnow()
    if session.started_at is not None and session.duration_minutes is None:
        session.duration_minutes = max(1, round((session.ended_at - session.started_at).total_seconds() / 60))
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.get("/api/sessions/{session_id}/recent_combos", response_model=list[schemas.RecentCombo])
def recent_combos(session_id: int, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)

    combos: dict[tuple, schemas.RecentCombo] = {}

    def fold(kind: str, grade: str, grade_system: str, send_type: str, logged_at):
        key = (kind, grade, grade_system, send_type)
        existing = combos.get(key)
        if existing is None:
            combos[key] = schemas.RecentCombo(
                kind=kind, grade=grade, grade_system=grade_system,
                send_type=send_type, count=1, last_logged_at=logged_at,
            )
        else:
            existing.count += 1
            if logged_at and (existing.last_logged_at is None or logged_at > existing.last_logged_at):
                existing.last_logged_at = logged_at

    for b in session.boulder_entries:
        fold("boulder", b.grade, "vscale", b.send_type, b.logged_at)
    for l in session.lead_route_entries:
        fold("lead", l.grade, l.grade_system, l.send_type, l.logged_at)

    ordered = sorted(
        combos.values(),
        key=lambda c: c.last_logged_at or datetime.min,
        reverse=True,
    )
    return ordered[:4]


# ---------------------------------------------------------------------------
# Warmup entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/warmup", response_model=schemas.WarmupEntry, status_code=201)
def add_warmup(session_id: int, payload: schemas.WarmupEntryCreate, db: DBSession = Depends(get_db)):
    get_session_or_404(session_id, db)
    entry = models.WarmupEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/warmup/{entry_id}", response_model=schemas.WarmupEntry)
def update_warmup(entry_id: int, payload: schemas.WarmupEntryCreate, db: DBSession = Depends(get_db)):
    entry = db.get(models.WarmupEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/warmup/{entry_id}", status_code=204)
def delete_warmup(entry_id: int, db: DBSession = Depends(get_db)):
    entry = db.get(models.WarmupEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Fingerboard entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/fingerboard", response_model=schemas.FingerboardEntry, status_code=201)
def add_fingerboard(session_id: int, payload: schemas.FingerboardEntryCreate, db: DBSession = Depends(get_db)):
    get_session_or_404(session_id, db)
    entry = models.FingerboardEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/fingerboard/{entry_id}", response_model=schemas.FingerboardEntry)
def update_fingerboard(entry_id: int, payload: schemas.FingerboardEntryCreate, db: DBSession = Depends(get_db)):
    entry = db.get(models.FingerboardEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/fingerboard/{entry_id}", status_code=204)
def delete_fingerboard(entry_id: int, db: DBSession = Depends(get_db)):
    entry = db.get(models.FingerboardEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Boulder entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/boulder", response_model=schemas.LimitBoulderEntry, status_code=201)
def add_boulder(session_id: int, payload: schemas.LimitBoulderEntryCreate, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    auto_start(session)
    entry = models.LimitBoulderEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.photos = []
    return entry


@app.put("/api/boulder/{entry_id}", response_model=schemas.LimitBoulderEntry)
def update_boulder(entry_id: int, payload: schemas.LimitBoulderEntryCreate, db: DBSession = Depends(get_db)):
    entry = db.get(models.LimitBoulderEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    attach_photos([entry], "boulder", db)
    return entry


@app.delete("/api/boulder/{entry_id}", status_code=204)
def delete_boulder(entry_id: int, db: DBSession = Depends(get_db)):
    entry = db.get(models.LimitBoulderEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for photo in db.query(models.EntryPhoto).filter_by(entry_type="boulder", entry_id=entry_id).all():
        p = PHOTOS_DIR / photo.filename
        if p.exists():
            p.unlink()
        db.delete(photo)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Lead route entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/lead", response_model=schemas.LeadRouteEntry, status_code=201)
def add_lead(session_id: int, payload: schemas.LeadRouteEntryCreate, db: DBSession = Depends(get_db)):
    session = get_session_or_404(session_id, db)
    auto_start(session)
    entry = models.LeadRouteEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.photos = []
    return entry


@app.put("/api/lead/{entry_id}", response_model=schemas.LeadRouteEntry)
def update_lead(entry_id: int, payload: schemas.LeadRouteEntryCreate, db: DBSession = Depends(get_db)):
    entry = db.get(models.LeadRouteEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    attach_photos([entry], "lead", db)
    return entry


@app.delete("/api/lead/{entry_id}", status_code=204)
def delete_lead(entry_id: int, db: DBSession = Depends(get_db)):
    entry = db.get(models.LeadRouteEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for photo in db.query(models.EntryPhoto).filter_by(entry_type="lead", entry_id=entry_id).all():
        p = PHOTOS_DIR / photo.filename
        if p.exists():
            p.unlink()
        db.delete(photo)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Strength entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/strength", response_model=schemas.StrengthEntry, status_code=201)
def add_strength(session_id: int, payload: schemas.StrengthEntryCreate, db: DBSession = Depends(get_db)):
    get_session_or_404(session_id, db)
    entry = models.StrengthEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/strength/{entry_id}", response_model=schemas.StrengthEntry)
def update_strength(entry_id: int, payload: schemas.StrengthEntryCreate, db: DBSession = Depends(get_db)):
    entry = db.get(models.StrengthEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/strength/{entry_id}", status_code=204)
def delete_strength(entry_id: int, db: DBSession = Depends(get_db)):
    entry = db.get(models.StrengthEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

@app.get("/api/progress", response_model=schemas.ProgressData)
def get_progress(db: DBSession = Depends(get_db)):
    fb_points: list[schemas.ProgressPoint] = []
    for s in db.query(models.Session).join(models.FingerboardEntry).order_by(models.Session.date).all():
        if not s.fingerboard_entries:
            continue
        best = max(s.fingerboard_entries, key=lambda e: (e.added_weight_kg or 0))
        fb_points.append(schemas.ProgressPoint(
            date=s.date, value=best.added_weight_kg or 0,
            label=f"{best.added_weight_kg}kg on {best.edge_mm}mm",
        ))

    bl_points: list[schemas.ProgressPoint] = []
    for s in db.query(models.Session).join(models.LimitBoulderEntry).order_by(models.Session.date).all():
        sent = [e for e in s.boulder_entries if e.send_type in REDPOINT_SENDS]
        if not sent:
            continue
        best = max(sent, key=lambda e: grade_to_int(e.grade, BOULDER_GRADE_ORDER))
        bl_points.append(schemas.ProgressPoint(
            date=s.date, value=grade_to_int(best.grade, BOULDER_GRADE_ORDER), label=best.grade,
        ))

    st_points: list[schemas.ProgressPoint] = []
    for s in db.query(models.Session).join(models.StrengthEntry).order_by(models.Session.date).all():
        if not s.strength_entries:
            continue
        best = max(s.strength_entries, key=lambda e: (e.added_weight_kg or 0))
        st_points.append(schemas.ProgressPoint(
            date=s.date, value=best.added_weight_kg or 0,
            label=f"{best.exercise} +{best.added_weight_kg}kg",
        ))

    # --- Lead (Ewbank only) ---
    # Flash family = clean first-go; redpoint family = worked then sent.
    FLASH_SENDS = {"flash", "onsight"}
    RP_SENDS = {"redpoint", "pinkpoint"}

    def ewbank_num(grade: str) -> int:
        try:
            return int(grade)
        except (TypeError, ValueError):
            return -1

    flash_prog: list[schemas.ProgressPoint] = []
    rp_prog: list[schemas.ProgressPoint] = []
    for s in db.query(models.Session).join(models.LeadRouteEntry).order_by(models.Session.date).all():
        ewbank = [e for e in s.lead_route_entries if e.grade_system == "ewbank"]
        flashes = [e for e in ewbank if e.send_type in FLASH_SENDS and ewbank_num(e.grade) >= 0]
        redpoints = [e for e in ewbank if e.send_type in RP_SENDS and ewbank_num(e.grade) >= 0]
        if flashes:
            best = max(flashes, key=lambda e: ewbank_num(e.grade))
            flash_prog.append(schemas.ProgressPoint(date=s.date, value=ewbank_num(best.grade), label=best.grade))
        if redpoints:
            best = max(redpoints, key=lambda e: ewbank_num(e.grade))
            rp_prog.append(schemas.ProgressPoint(date=s.date, value=ewbank_num(best.grade), label=best.grade))

    # Aggregate send pyramid (all-time), hardest grade first.
    pyramid: dict[str, dict[str, int]] = {}
    for e in db.query(models.LeadRouteEntry).filter(models.LeadRouteEntry.grade_system == "ewbank").all():
        if ewbank_num(e.grade) < 0:
            continue
        if e.send_type in FLASH_SENDS:
            pyramid.setdefault(e.grade, {"flash": 0, "redpoint": 0})["flash"] += 1
        elif e.send_type in RP_SENDS:
            pyramid.setdefault(e.grade, {"flash": 0, "redpoint": 0})["redpoint"] += 1
    pyramid_rows = [
        schemas.LeadPyramidRow(grade=g, flash=v["flash"], redpoint=v["redpoint"])
        for g, v in pyramid.items()
    ]
    pyramid_rows.sort(key=lambda r: ewbank_num(r.grade), reverse=True)

    return schemas.ProgressData(
        fingerboard_max_weight=fb_points,
        boulder_max_grade=bl_points,
        strength_max_weight=st_points,
        lead_flash_progression=flash_prog,
        lead_redpoint_progression=rp_prog,
        lead_send_pyramid=pyramid_rows,
    )


# ---------------------------------------------------------------------------
# Serve React SPA
# ---------------------------------------------------------------------------

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

if PHOTOS_DIR.exists():
    app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

if static_dir.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(static_dir / "index.html")
