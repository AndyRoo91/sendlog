import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession

import images
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
REDPOINT_SENDS = {"redpoint", "onsight", "flash", "pinkpoint"}


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


@app.get("/api/healthz")
def healthz():
    return {"status": "ok"}


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
    if entry_type not in ("lead", "boulder", "route"):
        raise HTTPException(status_code=400, detail="entry_type must be 'lead', 'boulder', or 'route'")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and HEIC images are accepted")
    try:
        filename = images.process_upload(
            await file.read(),
            photos_dir=PHOTOS_DIR,
            prefix=f"{entry_type}_{entry_id}",
        )
    except images.ImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
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
    images.delete_image(PHOTOS_DIR, photo.filename)
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
            images.delete_image(PHOTOS_DIR, photo.filename)
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

    def fold(kind: str, grade: str, grade_system: str, send_type: str, logged_at, route_name: str | None = None):
        key = (kind, grade, grade_system, send_type)
        existing = combos.get(key)
        if existing is None:
            combos[key] = schemas.RecentCombo(
                kind=kind, grade=grade, grade_system=grade_system,
                send_type=send_type, count=1, last_logged_at=logged_at,
                last_route_name=route_name,
            )
        else:
            existing.count += 1
            if logged_at and (existing.last_logged_at is None or logged_at > existing.last_logged_at):
                existing.last_logged_at = logged_at
                if route_name:
                    existing.last_route_name = route_name

    for b in session.boulder_entries:
        fold("boulder", b.grade, "vscale", b.send_type, b.logged_at)
    for l in session.lead_route_entries:
        fold("lead", l.grade, l.grade_system, l.send_type, l.logged_at, l.route_name)

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
        images.delete_image(PHOTOS_DIR, photo.filename)
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
        images.delete_image(PHOTOS_DIR, photo.filename)
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
    # Onsight: clean first-go, no prior info. Flash: clean first-go.
    # Redpoint family: worked then sent. Toprope is logged but kept out
    # of lead aggregates (different style of ascent).
    ONSIGHT_SENDS = {"onsight"}
    FLASH_SENDS = {"flash"}
    RP_SENDS = {"redpoint", "pinkpoint"}

    def ewbank_num(grade: str) -> int:
        try:
            return int(grade)
        except (TypeError, ValueError):
            return -1

    onsight_prog: list[schemas.ProgressPoint] = []
    flash_prog: list[schemas.ProgressPoint] = []
    rp_prog: list[schemas.ProgressPoint] = []
    for s in db.query(models.Session).join(models.LeadRouteEntry).order_by(models.Session.date).all():
        ewbank = [e for e in s.lead_route_entries if e.grade_system == "ewbank"]
        onsights = [e for e in ewbank if e.send_type in ONSIGHT_SENDS and ewbank_num(e.grade) >= 0]
        flashes = [e for e in ewbank if e.send_type in FLASH_SENDS and ewbank_num(e.grade) >= 0]
        redpoints = [e for e in ewbank if e.send_type in RP_SENDS and ewbank_num(e.grade) >= 0]
        if onsights:
            best = max(onsights, key=lambda e: ewbank_num(e.grade))
            onsight_prog.append(schemas.ProgressPoint(date=s.date, value=ewbank_num(best.grade), label=best.grade))
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
        row = pyramid.setdefault(e.grade, {"onsight": 0, "flash": 0, "redpoint": 0})
        if e.send_type in ONSIGHT_SENDS:
            row["onsight"] += 1
        elif e.send_type in FLASH_SENDS:
            row["flash"] += 1
        elif e.send_type in RP_SENDS:
            row["redpoint"] += 1
    pyramid_rows = [
        schemas.LeadPyramidRow(grade=g, onsight=v["onsight"], flash=v["flash"], redpoint=v["redpoint"])
        for g, v in pyramid.items()
        if any(v.values())
    ]
    pyramid_rows.sort(key=lambda r: ewbank_num(r.grade), reverse=True)

    return schemas.ProgressData(
        fingerboard_max_weight=fb_points,
        boulder_max_grade=bl_points,
        strength_max_weight=st_points,
        lead_onsight_progression=onsight_prog,
        lead_flash_progression=flash_prog,
        lead_redpoint_progression=rp_prog,
        lead_send_pyramid=pyramid_rows,
    )


# ---------------------------------------------------------------------------
# Routes (projects) + pins
# ---------------------------------------------------------------------------

def get_route_or_404(route_id: int, db: DBSession) -> models.Route:
    r = db.get(models.Route, route_id)
    if not r:
        raise HTTPException(status_code=404, detail="Route not found")
    return r


def attach_route_photos(route: models.Route, db: DBSession) -> None:
    """Attach gallery photos (entry_type='route') to route.photos."""
    route.photos = (
        db.query(models.EntryPhoto)
        .filter(models.EntryPhoto.entry_type == "route", models.EntryPhoto.entry_id == route.id)
        .all()
    )


def route_summary(r: models.Route) -> schemas.RouteSummary:
    dates = [p.date for p in r.pins]
    return schemas.RouteSummary(
        id=r.id, name=r.name, grade=r.grade, grade_system=r.grade_system,
        location=r.location, notes=r.notes, topo_filename=r.topo_filename,
        pin_count=len(r.pins), last_pin_date=max(dates) if dates else None,
    )


@app.get("/api/routes", response_model=list[schemas.RouteSummary])
def list_routes(db: DBSession = Depends(get_db)):
    routes = db.query(models.Route).order_by(models.Route.created_at.desc()).all()
    return [route_summary(r) for r in routes]


@app.post("/api/routes", response_model=schemas.RouteDetail, status_code=201)
def create_route(payload: schemas.RouteCreate, db: DBSession = Depends(get_db)):
    route = models.Route(**payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    route.ticks = []
    return route


@app.get("/api/routes/{route_id}", response_model=schemas.RouteDetail)
def get_route(route_id: int, db: DBSession = Depends(get_db)):
    route = get_route_or_404(route_id, db)
    route.ticks = (
        db.query(models.LeadRouteEntry)
        .filter(models.LeadRouteEntry.route_id == route_id)
        .order_by(models.LeadRouteEntry.logged_at)
        .all()
    )
    for t in route.ticks:
        t.photos = []
    attach_route_photos(route, db)
    return route


@app.patch("/api/routes/{route_id}", response_model=schemas.RouteDetail)
def update_route(route_id: int, payload: schemas.RouteUpdate, db: DBSession = Depends(get_db)):
    route = get_route_or_404(route_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    db.commit()
    db.refresh(route)
    route.ticks = (
        db.query(models.LeadRouteEntry).filter(models.LeadRouteEntry.route_id == route_id).all()
    )
    for t in route.ticks:
        t.photos = []
    return route


@app.delete("/api/routes/{route_id}", status_code=204)
def delete_route(route_id: int, db: DBSession = Depends(get_db)):
    route = get_route_or_404(route_id, db)
    # unlink ticks
    for t in db.query(models.LeadRouteEntry).filter(models.LeadRouteEntry.route_id == route_id).all():
        t.route_id = None
    # remove topo file (only if route-owned, i.e. starts with "route_")
    if route.topo_filename and route.topo_filename.startswith("route_"):
        images.delete_image(PHOTOS_DIR, route.topo_filename)
    db.delete(route)
    db.commit()


@app.post("/api/routes/{route_id}/topo", response_model=schemas.RouteDetail)
async def upload_topo(route_id: int, file: UploadFile = File(...), db: DBSession = Depends(get_db)):
    route = get_route_or_404(route_id, db)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and HEIC images are accepted")
    try:
        filename = images.process_upload(
            await file.read(),
            photos_dir=PHOTOS_DIR,
            prefix=f"route_{route_id}",
        )
    except images.ImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if route.topo_filename:
        images.delete_image(PHOTOS_DIR, route.topo_filename)
    route.topo_filename = filename
    db.commit()
    db.refresh(route)
    route.ticks = []
    attach_route_photos(route, db)
    return route


@app.post("/api/routes/{route_id}/topo/from-photo", response_model=schemas.RouteDetail)
def topo_from_photo(route_id: int, photo_id: int, db: DBSession = Depends(get_db)):
    """Promote an existing route gallery photo (or tick photo) to be this route's topo."""
    route = get_route_or_404(route_id, db)
    photo = db.get(models.EntryPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    src = PHOTOS_DIR / photo.filename
    if not src.exists():
        raise HTTPException(status_code=404, detail="Photo file missing")
    filename = images.process_upload(
        src.read_bytes(),
        photos_dir=PHOTOS_DIR,
        prefix=f"route_{route_id}",
    )
    if route.topo_filename:
        images.delete_image(PHOTOS_DIR, route.topo_filename)
    route.topo_filename = filename
    db.commit()
    db.refresh(route)
    route.ticks = []
    attach_route_photos(route, db)
    return route


@app.post("/api/routes/{route_id}/pins", response_model=schemas.RoutePin, status_code=201)
def add_pin(route_id: int, payload: schemas.RoutePinCreate, db: DBSession = Depends(get_db)):
    get_route_or_404(route_id, db)
    pin = models.RoutePin(route_id=route_id, **payload.model_dump())
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return pin


@app.patch("/api/pins/{pin_id}", response_model=schemas.RoutePin)
def update_pin(pin_id: int, payload: schemas.RoutePinUpdate, db: DBSession = Depends(get_db)):
    pin = db.get(models.RoutePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pin, field, value)
    db.commit()
    db.refresh(pin)
    return pin


@app.delete("/api/pins/{pin_id}", status_code=204)
def delete_pin(pin_id: int, db: DBSession = Depends(get_db)):
    pin = db.get(models.RoutePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    db.delete(pin)
    db.commit()


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------

@app.get("/api/export")
def export_data(db: DBSession = Depends(get_db)):
    """Dump all sessions (with entries) and routes (with pins) as JSON.
    Photo files are not included — data only."""
    sessions = db.query(models.Session).order_by(models.Session.date).all()
    routes = db.query(models.Route).order_by(models.Route.id).all()

    def _isoformat(dt: datetime | None) -> str | None:
        return dt.isoformat() if dt else None

    return {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "sessions": [
            {
                "date": s.date.isoformat(),
                "location": s.location,
                "duration_minutes": s.duration_minutes,
                "notes": s.notes,
                "started_at": _isoformat(s.started_at),
                "ended_at": _isoformat(s.ended_at),
                "warmup_entries": [
                    {"activity": e.activity, "duration_minutes": e.duration_minutes, "notes": e.notes}
                    for e in s.warmup_entries
                ],
                "fingerboard_entries": [
                    {"edge_mm": e.edge_mm, "added_weight_kg": e.added_weight_kg,
                     "hang_duration_s": e.hang_duration_s, "num_sets": e.num_sets, "notes": e.notes}
                    for e in s.fingerboard_entries
                ],
                "boulder_entries": [
                    {"grade": e.grade, "send_type": e.send_type, "attempts": e.attempts,
                     "notes": e.notes, "logged_at": _isoformat(e.logged_at)}
                    for e in s.boulder_entries
                ],
                "strength_entries": [
                    {"exercise": e.exercise, "reps": e.reps,
                     "added_weight_kg": e.added_weight_kg, "notes": e.notes}
                    for e in s.strength_entries
                ],
                "lead_route_entries": [
                    {"route_name": e.route_name, "grade": e.grade, "grade_system": e.grade_system,
                     "send_type": e.send_type, "attempts": e.attempts, "falls": e.falls,
                     "notes": e.notes, "logged_at": _isoformat(e.logged_at)}
                    for e in s.lead_route_entries
                ],
            }
            for s in sessions
        ],
        "routes": [
            {
                "name": r.name,
                "grade": r.grade,
                "grade_system": r.grade_system,
                "location": r.location,
                "notes": r.notes,
                "pins": [
                    {"date": p.date.isoformat(), "x": p.x, "y": p.y, "kind": p.kind, "note": p.note}
                    for p in r.pins
                ],
            }
            for r in routes
        ],
    }


_SESSION_FIELDS = {"date", "location", "duration_minutes", "notes", "started_at", "ended_at"}
_WARMUP_FIELDS = {"activity", "duration_minutes", "notes"}
_FINGER_FIELDS = {"edge_mm", "added_weight_kg", "hang_duration_s", "num_sets", "notes"}
_BOULDER_FIELDS = {"grade", "send_type", "attempts", "notes", "logged_at"}
_STRENGTH_FIELDS = {"exercise", "reps", "added_weight_kg", "notes"}
_LEAD_FIELDS = {"route_name", "grade", "grade_system", "send_type", "attempts", "falls", "notes", "logged_at"}
_ROUTE_FIELDS = {"name", "grade", "grade_system", "location", "notes"}
_PIN_FIELDS = {"date", "x", "y", "kind", "note"}


def _pick(d: dict, keys: set) -> dict:
    return {k: v for k, v in d.items() if k in keys and v is not None or k in keys and v == 0}


def _parse_date(v: str | None):
    from datetime import date as _date
    return _date.fromisoformat(v) if v else None


def _parse_dt(v: str | None):
    return datetime.fromisoformat(v) if v else None


@app.post("/api/import", response_model=schemas.ImportResult, status_code=201)
def import_data(payload: schemas.ImportPayload, db: DBSession = Depends(get_db)):
    """Append exported data as new records (new IDs). Idempotent-safe: calling
    twice imports duplicates, so this is intended as a restore tool, not a sync."""
    if payload.version != 1:
        raise HTTPException(status_code=400, detail=f"Unsupported export version: {payload.version}")

    sessions_imported = 0
    for s in payload.sessions:
        if not isinstance(s, dict) or "date" not in s:
            continue
        session = models.Session(
            date=_parse_date(s.get("date")),
            location=s.get("location"),
            duration_minutes=s.get("duration_minutes"),
            notes=s.get("notes"),
            started_at=_parse_dt(s.get("started_at")),
            ended_at=_parse_dt(s.get("ended_at")),
        )
        db.add(session)
        db.flush()
        for e in s.get("warmup_entries", []):
            db.add(models.WarmupEntry(session_id=session.id, **{k: e[k] for k in _WARMUP_FIELDS if k in e}))
        for e in s.get("fingerboard_entries", []):
            db.add(models.FingerboardEntry(session_id=session.id, **{k: e[k] for k in _FINGER_FIELDS if k in e}))
        for e in s.get("boulder_entries", []):
            entry_kwargs = {k: e[k] for k in _BOULDER_FIELDS if k in e}
            if "logged_at" in entry_kwargs:
                entry_kwargs["logged_at"] = _parse_dt(entry_kwargs["logged_at"])
            db.add(models.LimitBoulderEntry(session_id=session.id, **entry_kwargs))
        for e in s.get("strength_entries", []):
            db.add(models.StrengthEntry(session_id=session.id, **{k: e[k] for k in _STRENGTH_FIELDS if k in e}))
        for e in s.get("lead_route_entries", []):
            entry_kwargs = {k: e[k] for k in _LEAD_FIELDS if k in e}
            if "logged_at" in entry_kwargs:
                entry_kwargs["logged_at"] = _parse_dt(entry_kwargs["logged_at"])
            db.add(models.LeadRouteEntry(session_id=session.id, **entry_kwargs))
        sessions_imported += 1

    routes_imported = 0
    for r in payload.routes:
        if not isinstance(r, dict) or "name" not in r:
            continue
        route = models.Route(**{k: r[k] for k in _ROUTE_FIELDS if k in r})
        db.add(route)
        db.flush()
        for p in r.get("pins", []):
            pin_kwargs = {k: p[k] for k in _PIN_FIELDS if k in p}
            if "date" in pin_kwargs:
                pin_kwargs["date"] = _parse_date(pin_kwargs["date"])
            db.add(models.RoutePin(route_id=route.id, **pin_kwargs))
        routes_imported += 1

    db.commit()
    return schemas.ImportResult(sessions_imported=sessions_imported, routes_imported=routes_imported)


# ---------------------------------------------------------------------------
# Serve React SPA
# ---------------------------------------------------------------------------

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

# Serve uploaded photos. Create the dir up front so the mount is always
# registered — on a fresh bind mount it won't exist yet at import time,
# and lifespan startup runs after the mounts are wired.
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

if static_dir.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(static_dir / "index.html")
