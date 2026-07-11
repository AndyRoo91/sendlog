import os
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, text as text_clause

import achievements
import auth
import database
import images
import models
import plan_templates
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


def get_session_or_404(session_id: int, db: DBSession, user: "models.User | None" = None) -> models.Session:
    """Fetch a session by id. If ``user`` is given, also enforce that they own it."""
    q = db.query(models.Session).filter(models.Session.id == session_id)
    if user is not None:
        q = q.filter(models.Session.user_id == user.id)
    s = q.first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def get_owned_entry_or_404(
    model: type, entry_id: int, db: DBSession, user: models.User
):
    """Fetch an entry by id, enforcing ownership via its parent session."""
    e = (
        db.query(model)
        .join(models.Session, model.session_id == models.Session.id)
        .filter(model.id == entry_id, models.Session.user_id == user.id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return e


def auto_start(session: models.Session) -> None:
    """Start the timer on the first logged tick if not already running."""
    if session.started_at is None:
        session.started_at = datetime.utcnow()


def run_seed() -> None:
    """First-run: create admin user from env vars + stamp pre-existing rows.

    Idempotent — runs every startup but exits early once a user exists. Designed
    so an existing single-user install (Andy's NAS) transitions cleanly: his
    sessions / routes / achievements all get assigned to the admin user on
    first boot post-upgrade.
    """
    with database.SessionLocal() as db:
        existing_users = db.query(models.User).count()
        if existing_users > 0:
            return
        username = os.getenv("ANDY_USERNAME", "andy")
        password = os.getenv("ANDY_PASSWORD", "changeme")
        if password == "changeme":
            print(
                "WARNING: ANDY_PASSWORD env var not set — seeding admin user "
                "with default password 'changeme'. Log in and change it, or "
                "set ANDY_PASSWORD before first start."
            )
        admin = models.User(
            username=username,
            password_hash=auth.hash_password(password),
            is_admin=True,
        )
        db.add(admin)
        db.flush()  # need admin.id
        # Stamp any pre-existing rows (sessions/routes/achievements that were
        # created before the user_id column existed) onto this admin.
        for table in ("sessions", "routes", "achievements"):
            db.execute(
                text_clause(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
                {"uid": admin.id},
            )
        db.commit()
        print(f"Seeded admin user '{username}' (id={admin.id}).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    Base.metadata.create_all(bind=engine)
    run_seed()
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Climbing Training Log", lifespan=lifespan)


@app.get("/api/healthz")
def healthz():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def _user_to_schema(u: models.User) -> schemas.AuthUser:
    return schemas.AuthUser(
        id=u.id, username=u.username, is_admin=u.is_admin,
        has_pin=u.pin_hash is not None,
        # Older rows predate the column; treat NULL as opted-in.
        share_to_feed=u.share_to_feed if u.share_to_feed is not None else True,
        weekly_session_goal=u.weekly_session_goal,
        weekly_tick_goal=u.weekly_tick_goal,
        buddy_species=u.buddy_species or "gecko",
    )


@app.post("/api/auth/register", response_model=schemas.AuthUser, status_code=201)
def register(payload: schemas.AuthCredentials, response: Response, db: DBSession = Depends(get_db)):
    username = payload.username.strip()
    if not username or len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = models.User(
        username=username,
        password_hash=auth.hash_password(payload.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    auth.set_session_cookie(response, user.id)
    return _user_to_schema(user)


@app.post("/api/auth/login", response_model=schemas.AuthUser)
def login(payload: schemas.AuthCredentials, response: Response, db: DBSession = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username.strip()).first()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    auth.set_session_cookie(response, user.id)
    return _user_to_schema(user)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response):
    auth.clear_session_cookie(response)


@app.get("/api/auth/me", response_model=schemas.AuthUser)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return _user_to_schema(current_user)


@app.post("/api/auth/me/password", status_code=204)
def change_password(
    payload: schemas.PasswordChange,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not auth.verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is wrong")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.password_hash = auth.hash_password(payload.new_password)
    db.commit()


def _validate_pin(pin: str) -> None:
    if not (pin.isdigit() and 4 <= len(pin) <= 8):
        raise HTTPException(status_code=400, detail="PIN must be 4–8 digits")


@app.post("/api/auth/me/pin", status_code=204)
def set_pin(
    payload: schemas.PinSet,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Set or replace the PIN. Password re-verification required."""
    if not auth.verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Password is wrong")
    _validate_pin(payload.pin)
    current_user.pin_hash = auth.hash_password(payload.pin)
    db.commit()


@app.delete("/api/auth/me/pin", status_code=204)
def clear_pin(
    payload: schemas.PinClear,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not auth.verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Password is wrong")
    current_user.pin_hash = None
    db.commit()


@app.post("/api/auth/verify_pin", status_code=204)
def verify_pin(
    payload: schemas.PinVerify,
    current_user: models.User = Depends(auth.get_current_user),
):
    """Pure yes/no check used by the client-side lock screen. The cookie is
    untouched — PIN unlock just unhides the UI; it doesn't issue or extend
    a session. If the cookie has already expired the API would 401 before we
    got here, and the user falls back to the full login screen."""
    if not current_user.pin_hash:
        raise HTTPException(status_code=400, detail="No PIN is set")
    if not auth.verify_password(payload.pin, current_user.pin_hash):
        raise HTTPException(status_code=401, detail="Wrong PIN")


@app.post("/api/auth/me/feed_sharing", response_model=schemas.AuthUser)
def set_feed_sharing(
    payload: schemas.FeedSharingUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Toggle whether this user's activity appears in the shared instance feed."""
    current_user.share_to_feed = payload.share
    db.commit()
    db.refresh(current_user)
    return _user_to_schema(current_user)


BUDDY_SPECIES = {"gecko", "ibex", "galah", "wombat"}


@app.post("/api/auth/me/buddy", response_model=schemas.AuthUser)
def set_buddy_species(
    payload: schemas.BuddySpeciesUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Pick which animal fronts the climbing buddy."""
    if payload.species not in BUDDY_SPECIES:
        raise HTTPException(status_code=400, detail="Unknown buddy species")
    current_user.buddy_species = payload.species
    db.commit()
    db.refresh(current_user)
    return _user_to_schema(current_user)


@app.post("/api/auth/me/goals", response_model=schemas.AuthUser)
def set_goals(
    payload: schemas.GoalsUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Set weekly training goals. 0 or negative clears a goal."""
    def clean(v: int | None) -> int | None:
        return v if (v is not None and v > 0) else None
    current_user.weekly_session_goal = clean(payload.weekly_session_goal)
    current_user.weekly_tick_goal = clean(payload.weekly_tick_goal)
    db.commit()
    db.refresh(current_user)
    return _user_to_schema(current_user)


@app.get("/api/weekly_progress", response_model=schemas.WeeklyProgress)
def weekly_progress(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """This week's session + tick counts vs the user's goals. Week starts Monday."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id, models.Session.date >= week_start)
        .all()
    )
    # Count sessions that actually have activity (any tick or training entry).
    session_count = sum(
        1 for s in sessions
        if s.boulder_entries or s.lead_route_entries or s.fingerboard_entries or s.strength_entries
    )
    tick_count = sum(len(s.boulder_entries) + len(s.lead_route_entries) for s in sessions)
    return schemas.WeeklyProgress(
        week_start=week_start, sessions=session_count, ticks=tick_count,
        session_goal=current_user.weekly_session_goal,
        tick_goal=current_user.weekly_tick_goal,
    )


@app.get("/api/protocols", response_model=list[schemas.FingerboardProtocol])
def list_protocols(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """The user's saved fingerboard protocols (built-ins live on the frontend)."""
    return (
        db.query(models.FingerboardProtocol)
        .filter(models.FingerboardProtocol.user_id == current_user.id)
        .order_by(models.FingerboardProtocol.name)
        .all()
    )


@app.post("/api/protocols", response_model=schemas.FingerboardProtocol, status_code=201)
def create_protocol(
    payload: schemas.FingerboardProtocolCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not payload.name.strip():
        raise HTTPException(400, "Protocol name cannot be empty")
    data = payload.model_dump()
    data["name"] = data["name"].strip()
    p = models.FingerboardProtocol(user_id=current_user.id, **data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.delete("/api/protocols/{protocol_id}", status_code=204)
def delete_protocol(
    protocol_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    p = db.get(models.FingerboardProtocol, protocol_id)
    if not p or p.user_id != current_user.id:
        raise HTTPException(404, "Protocol not found")
    db.delete(p)
    db.commit()


# ---------------------------------------------------------------------------
# Training plans (Phase Q3)
# ---------------------------------------------------------------------------

# Rotating content for a swapped-in deload week (R2). Dates stay put; only
# the work changes. Recognised by title prefix so the nudge stops re-firing.
DELOAD_TITLE_PREFIX = "Deload"
DELOAD_SESSIONS = [
    ("Deload — easy volume", "40–60% of a normal session, everything well below your limit"),
    ("Deload — technique + mobility", "light drills and footwork, no pump — leave feeling fresh"),
    ("Deload — rest or easy hangs", "full rest day, or 50% fingerboard maintenance at most"),
]


def _current_week_window(plan: models.Plan) -> tuple[date, date]:
    """[start, end) of the plan's current week, clamped to the plan."""
    week = (date.today() - plan.start_date).days // 7 + 1
    week = max(1, min(plan.weeks, week))
    start = plan.start_date + timedelta(days=(week - 1) * 7)
    return start, start + timedelta(days=7)


def _plan_detail(plan: models.Plan, db: DBSession) -> schemas.PlanDetail:
    """Serialise a plan with each session's 'done' derived from real sessions
    logged on the scheduled date within the plan window."""
    end = plan.start_date + timedelta(days=plan.weeks * 7)
    real_dates = {
        s.date
        for s in db.query(models.Session).filter(
            models.Session.user_id == plan.user_id,
            models.Session.date >= plan.start_date,
            models.Session.date < end,
        ).all()
        if s.boulder_entries or s.lead_route_entries or s.fingerboard_entries or s.strength_entries
    }
    out = [
        schemas.PlannedSessionOut(
            id=ps.id, scheduled_date=ps.scheduled_date, title=ps.title,
            focus=ps.focus, done=ps.scheduled_date in real_dates,
        )
        for ps in sorted(plan.sessions, key=lambda x: (x.scheduled_date, x.id))
    ]
    week = (date.today() - plan.start_date).days // 7 + 1
    week = max(1, min(plan.weeks, week))
    acwr = _current_acwr(db, plan.user_id)
    # Don't keep nudging once this week is already a deload week.
    wk_start, wk_end = _current_week_window(plan)
    this_week = [s for s in out if wk_start <= s.scheduled_date < wk_end]
    week_deloaded = bool(this_week) and all(s.title.startswith(DELOAD_TITLE_PREFIX) for s in this_week)
    return schemas.PlanDetail(
        id=plan.id, template_key=plan.template_key, name=plan.name,
        start_date=plan.start_date, weeks=plan.weeks, sessions=out,
        done_count=sum(1 for s in out if s.done), total_count=len(out),
        current_phase=plan_templates.phase_for(plan.template_key, week),
        phases=[plan_templates.phase_for(plan.template_key, w) for w in range(1, plan.weeks + 1)],
        deload_suggested=acwr is not None and acwr >= DELOAD_ACWR and not week_deloaded,
    )


@app.get("/api/plan_templates", response_model=list[schemas.PlanTemplateOut])
def list_plan_templates(current_user: models.User = Depends(auth.get_current_user)):
    return [
        schemas.PlanTemplateOut(
            key=t.key, name=t.name, description=t.description,
            weeks=t.weeks, sessions_per_week=len(t.weekly),
        )
        for t in plan_templates.TEMPLATES
    ]


@app.get("/api/plan", response_model=schemas.PlanDetail | None)
def get_plan(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """The user's active plan (newest), or null if none."""
    plan = (
        db.query(models.Plan)
        .filter(models.Plan.user_id == current_user.id)
        .order_by(models.Plan.id.desc())
        .first()
    )
    return _plan_detail(plan, db) if plan else None


@app.post("/api/plan", response_model=schemas.PlanDetail, status_code=201)
def create_plan(
    payload: schemas.PlanCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Start a plan from a template. Replaces any existing plan."""
    tmpl = plan_templates.BY_KEY.get(payload.template_key)
    if not tmpl:
        raise HTTPException(400, "Unknown plan template")
    for old in db.query(models.Plan).filter(models.Plan.user_id == current_user.id).all():
        db.delete(old)  # one active plan per user; planned sessions cascade
    plan = models.Plan(
        user_id=current_user.id, template_key=tmpl.key, name=tmpl.name,
        start_date=payload.start_date, weeks=tmpl.weeks,
    )
    db.add(plan)
    db.flush()
    for w in range(tmpl.weeks):
        for item in tmpl.weekly:
            db.add(models.PlannedSession(
                plan_id=plan.id,
                scheduled_date=payload.start_date + timedelta(days=w * 7 + item.day),
                title=item.title, focus=item.focus,
            ))
    db.commit()
    db.refresh(plan)
    return _plan_detail(plan, db)


@app.post("/api/plan/deload", response_model=schemas.PlanDetail)
def deload_current_week(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Swap this week's planned sessions for a deload week (R2). Scheduled
    dates stay put; only titles/focus change, so 'done' derivation is
    unaffected. Idempotent — re-swapping writes the same content."""
    plan = (
        db.query(models.Plan)
        .filter(models.Plan.user_id == current_user.id)
        .order_by(models.Plan.id.desc())
        .first()
    )
    if not plan:
        raise HTTPException(404, "No active plan")
    wk_start, wk_end = _current_week_window(plan)
    this_week = sorted(
        (ps for ps in plan.sessions if wk_start <= ps.scheduled_date < wk_end),
        key=lambda x: (x.scheduled_date, x.id),
    )
    if not this_week:
        raise HTTPException(409, "No planned sessions this week to swap")
    for i, ps in enumerate(this_week):
        ps.title, ps.focus = DELOAD_SESSIONS[i % len(DELOAD_SESSIONS)]
    db.commit()
    db.refresh(plan)
    return _plan_detail(plan, db)


@app.delete("/api/plan", status_code=204)
def delete_plan(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Abandon the active plan."""
    for old in db.query(models.Plan).filter(models.Plan.user_id == current_user.id).all():
        db.delete(old)
    db.commit()


# ---------------------------------------------------------------------------
# Photos
# ---------------------------------------------------------------------------

def _verify_photo_owner(entry_type: str, entry_id: int, db: DBSession, user: models.User) -> None:
    """Ensure the calling user owns the entry/route this photo attaches to."""
    if entry_type == "route":
        get_route_or_404(entry_id, db, user)
        return
    model = models.LeadRouteEntry if entry_type == "lead" else models.LimitBoulderEntry
    get_owned_entry_or_404(model, entry_id, db, user)


@app.post("/api/photos/upload", response_model=schemas.EntryPhoto, status_code=201)
async def upload_photo(
    entry_type: str,
    entry_id: int,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if entry_type not in ("lead", "boulder", "route"):
        raise HTTPException(status_code=400, detail="entry_type must be 'lead', 'boulder', or 'route'")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and HEIC images are accepted")
    _verify_photo_owner(entry_type, entry_id, db, current_user)
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
def delete_photo(
    photo_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    photo = db.get(models.EntryPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    # 404 (not 403) on cross-user deletes — don't leak existence.
    try:
        _verify_photo_owner(photo.entry_type, photo.entry_id, db, current_user)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Photo not found")
    images.delete_image(PHOTOS_DIR, photo.filename)
    db.delete(photo)
    db.commit()


# ---------------------------------------------------------------------------
# Sessions (header CRUD)
# ---------------------------------------------------------------------------

@app.get("/api/sessions", response_model=list[schemas.SessionSummary])
def list_sessions(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .order_by(models.Session.date.desc())
        .all()
    )


@app.get("/api/locations", response_model=list[str])
def list_locations(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return distinct session locations ordered by frequency (most-used first)."""
    rows = (
        db.query(models.Session.location, func.count(models.Session.id).label("n"))
        .filter(models.Session.user_id == current_user.id)
        .filter(models.Session.location.isnot(None))
        .filter(models.Session.location != "")
        .group_by(models.Session.location)
        .order_by(text_clause("n DESC"))
        .all()
    )
    return [r.location for r in rows]


@app.get("/api/partners", response_model=list[str])
def list_partners(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return distinct partner names ordered by frequency (most-used first)."""
    rows = (
        db.query(models.Session.partner, func.count(models.Session.id).label("n"))
        .filter(models.Session.user_id == current_user.id)
        .filter(models.Session.partner.isnot(None))
        .filter(models.Session.partner != "")
        .group_by(models.Session.partner)
        .order_by(text_clause("n DESC"))
        .all()
    )
    return [r.partner for r in rows]


@app.get("/api/route_names", response_model=list[str])
def list_route_names(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return distinct lead route names ordered by frequency (most-used first)."""
    rows = (
        db.query(models.LeadRouteEntry.route_name, func.count(models.LeadRouteEntry.id).label("n"))
        .join(models.Session, models.LeadRouteEntry.session_id == models.Session.id)
        .filter(models.Session.user_id == current_user.id)
        .filter(models.LeadRouteEntry.route_name.isnot(None))
        .filter(models.LeadRouteEntry.route_name != "")
        .group_by(models.LeadRouteEntry.route_name)
        .order_by(text_clause("n DESC"))
        .all()
    )
    return [r.route_name for r in rows]


@app.post("/api/sessions", response_model=schemas.SessionDetail, status_code=201)
def create_session(
    payload: schemas.SessionCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.gym_id is not None:
        get_gym_or_404(payload.gym_id, db, current_user)  # ownership check
    session = models.Session(
        user_id=current_user.id,
        date=payload.date,
        location=payload.location,
        gym_id=payload.gym_id,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        mood=payload.mood,
        partner=payload.partner,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/api/sessions/{session_id}", response_model=schemas.SessionDetail)
def get_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.patch("/api/sessions/{session_id}", response_model=schemas.SessionDetail)
def patch_session(
    session_id: int, payload: schemas.SessionPatch,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("gym_id") is not None:
        get_gym_or_404(fields["gym_id"], db, current_user)  # ownership check
    for field, value in fields.items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
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
def start_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    if session.started_at is None:
        session.started_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.post("/api/sessions/{session_id}/end", response_model=schemas.SessionDetail)
def end_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    session.ended_at = datetime.utcnow()
    if session.started_at is not None and session.duration_minutes is None:
        session.duration_minutes = max(1, round((session.ended_at - session.started_at).total_seconds() / 60))
    db.commit()
    db.refresh(session)
    attach_photos(session.boulder_entries, "boulder", db)
    attach_photos(session.lead_route_entries, "lead", db)
    return session


@app.get("/api/sessions/{session_id}/recent_combos", response_model=list[schemas.RecentCombo])
def recent_combos(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)

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
def add_warmup(
    session_id: int, payload: schemas.WarmupEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_session_or_404(session_id, db, current_user)
    entry = models.WarmupEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/warmup/{entry_id}", response_model=schemas.WarmupEntry)
def update_warmup(
    entry_id: int, payload: schemas.WarmupEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.WarmupEntry, entry_id, db, current_user)
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/warmup/{entry_id}", status_code=204)
def delete_warmup(
    entry_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.WarmupEntry, entry_id, db, current_user)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Fingerboard entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/fingerboard", response_model=schemas.FingerboardEntry, status_code=201)
def add_fingerboard(
    session_id: int, payload: schemas.FingerboardEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_session_or_404(session_id, db, current_user)
    entry = models.FingerboardEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/fingerboard/{entry_id}", response_model=schemas.FingerboardEntry)
def update_fingerboard(
    entry_id: int, payload: schemas.FingerboardEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.FingerboardEntry, entry_id, db, current_user)
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/fingerboard/{entry_id}", status_code=204)
def delete_fingerboard(
    entry_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.FingerboardEntry, entry_id, db, current_user)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Boulder entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/boulder", response_model=schemas.LimitBoulderEntry, status_code=201)
def add_boulder(
    session_id: int, payload: schemas.LimitBoulderEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    if payload.wall_id is not None:
        get_owned_wall_or_404(payload.wall_id, db, current_user)  # ownership check
    auto_start(session)
    entry = models.LimitBoulderEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.photos = []
    return entry


@app.put("/api/boulder/{entry_id}", response_model=schemas.LimitBoulderEntry)
def update_boulder(
    entry_id: int, payload: schemas.LimitBoulderEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.LimitBoulderEntry, entry_id, db, current_user)
    if payload.wall_id is not None:
        get_owned_wall_or_404(payload.wall_id, db, current_user)
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    attach_photos([entry], "boulder", db)
    return entry


@app.delete("/api/boulder/{entry_id}", status_code=204)
def delete_boulder(
    entry_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.LimitBoulderEntry, entry_id, db, current_user)
    for photo in db.query(models.EntryPhoto).filter_by(entry_type="boulder", entry_id=entry_id).all():
        images.delete_image(PHOTOS_DIR, photo.filename)
        db.delete(photo)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Lead route entries
# ---------------------------------------------------------------------------

def resolve_lead_route_link(
    route_id: int | None, route_name: str | None,
    current_user: models.User, db: DBSession,
) -> int | None:
    """Auto-link a lead tick to an existing project when the typed route name
    matches one (case-insensitive). Keeps a project's high-points and its
    session ticks unified without manual bookkeeping. Conservative: only when
    no explicit ``route_id`` was supplied and a name is present."""
    if route_id is not None or not route_name or not route_name.strip():
        return route_id
    match = (
        db.query(models.Route)
        .filter(
            models.Route.user_id == current_user.id,
            models.Route.kind == "lead",
            func.lower(models.Route.name) == route_name.strip().lower(),
        )
        .order_by(models.Route.id.desc())
        .first()
    )
    return match.id if match else None


@app.post("/api/sessions/{session_id}/lead", response_model=schemas.LeadRouteEntry, status_code=201)
def add_lead(
    session_id: int, payload: schemas.LeadRouteEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = get_session_or_404(session_id, db, current_user)
    if payload.wall_id is not None:
        get_owned_wall_or_404(payload.wall_id, db, current_user)  # ownership check
    auto_start(session)
    entry = models.LeadRouteEntry(session_id=session_id, **payload.model_dump())
    entry.route_id = resolve_lead_route_link(payload.route_id, payload.route_name, current_user, db)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.photos = []
    return entry


@app.put("/api/lead/{entry_id}", response_model=schemas.LeadRouteEntry)
def update_lead(
    entry_id: int, payload: schemas.LeadRouteEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.LeadRouteEntry, entry_id, db, current_user)
    if payload.wall_id is not None:
        get_owned_wall_or_404(payload.wall_id, db, current_user)
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    attach_photos([entry], "lead", db)
    return entry


@app.delete("/api/lead/{entry_id}", status_code=204)
def delete_lead(
    entry_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.LeadRouteEntry, entry_id, db, current_user)
    for photo in db.query(models.EntryPhoto).filter_by(entry_type="lead", entry_id=entry_id).all():
        images.delete_image(PHOTOS_DIR, photo.filename)
        db.delete(photo)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Strength entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/strength", response_model=schemas.StrengthEntry, status_code=201)
def add_strength(
    session_id: int, payload: schemas.StrengthEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_session_or_404(session_id, db, current_user)
    entry = models.StrengthEntry(session_id=session_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.put("/api/strength/{entry_id}", response_model=schemas.StrengthEntry)
def update_strength(
    entry_id: int, payload: schemas.StrengthEntryCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.StrengthEntry, entry_id, db, current_user)
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/strength/{entry_id}", status_code=204)
def delete_strength(
    entry_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = get_owned_entry_or_404(models.StrengthEntry, entry_id, db, current_user)
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

RANGE_KEYS = {"6w", "6mo", "1y", "all"}


def _range_since(range_key: str) -> date:
    """Cutoff date for a Progress range chip. ``date.min`` for 'all' so callers
    can apply one uniform ``Session.date >= since`` filter to every query."""
    today = date.today()
    if range_key == "6w":
        return today - timedelta(weeks=6)
    if range_key == "6mo":
        return today - timedelta(days=182)
    if range_key == "1y":
        return today - timedelta(days=365)
    return date.min  # "all" (and any unrecognised value)


# Acute:chronic ratio at/above which we nudge a deload (Phase Q4). 1.5 is the
# commonly-cited high-injury-risk threshold; the sweet spot is 0.8–1.3.
DELOAD_ACWR = 1.5


def _current_acwr(db: DBSession, uid: int) -> float | None:
    """The most recent acute:chronic workload ratio, or None if not enough
    history. Drives the buddy's deload nudge + the plan's deload banner."""
    pts = _training_load(db, uid, date.min)
    if not pts:
        return None
    return max(pts, key=lambda p: p.date).ratio


def _training_load(db: DBSession, uid: int, since: date) -> list[schemas.TrainingLoadPoint]:
    """Acute:chronic workload ratio (ACWR) per active day.

    Load = climbing ticks that day. acute = avg daily load over the trailing
    7 days, chronic = over the trailing 28. The series is built from the
    *unfiltered* history so chronic windows include load from before the
    range cutoff; only points on/after ``since`` are returned. Points before
    28 days of history exist are suppressed (ACWR is noise until then).
    """
    loads: dict[date, int] = {}
    for s in db.query(models.Session).filter(models.Session.user_id == uid).all():
        n = len(s.boulder_entries) + len(s.lead_route_entries)
        if n:
            loads[s.date] = loads.get(s.date, 0) + n
    if not loads:
        return []

    warmup_until = min(loads) + timedelta(days=28)
    points: list[schemas.TrainingLoadPoint] = []
    for d in sorted(loads):
        if d < since or d < warmup_until:
            continue
        acute = sum(loads.get(d - timedelta(days=k), 0) for k in range(7)) / 7
        chronic = sum(loads.get(d - timedelta(days=k), 0) for k in range(28)) / 28
        if chronic <= 0:
            continue
        points.append(schemas.TrainingLoadPoint(
            date=d, acute=round(acute, 2), chronic=round(chronic, 2),
            ratio=round(acute / chronic, 2),
        ))
    return points


@app.get("/api/progress", response_model=schemas.ProgressData)
def get_progress(
    range: str = "all",
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    uid = current_user.id
    since = _range_since(range if range in RANGE_KEYS else "all")

    fb_points: list[schemas.ProgressPoint] = []
    for s in (
        db.query(models.Session).join(models.FingerboardEntry)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .order_by(models.Session.date).all()
    ):
        if not s.fingerboard_entries:
            continue
        best = max(s.fingerboard_entries, key=lambda e: (e.added_weight_kg or 0))
        fb_points.append(schemas.ProgressPoint(
            date=s.date, value=best.added_weight_kg or 0,
            label=f"{best.added_weight_kg}kg on {best.edge_mm}mm",
        ))

    bl_points: list[schemas.ProgressPoint] = []
    for s in (
        db.query(models.Session).join(models.LimitBoulderEntry)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .order_by(models.Session.date).all()
    ):
        sent = [e for e in s.boulder_entries if e.send_type in REDPOINT_SENDS]
        if not sent:
            continue
        best = max(sent, key=lambda e: grade_to_int(e.grade, BOULDER_GRADE_ORDER))
        bl_points.append(schemas.ProgressPoint(
            date=s.date, value=grade_to_int(best.grade, BOULDER_GRADE_ORDER), label=best.grade,
        ))

    st_points: list[schemas.ProgressPoint] = []
    for s in (
        db.query(models.Session).join(models.StrengthEntry)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .order_by(models.Session.date).all()
    ):
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
    for s in (
        db.query(models.Session).join(models.LeadRouteEntry)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .order_by(models.Session.date).all()
    ):
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
    lead_sends: list[schemas.SendDetail] = []   # individual sends for drill-down
    for e in (
        db.query(models.LeadRouteEntry)
        .join(models.Session, models.LeadRouteEntry.session_id == models.Session.id)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .filter(models.LeadRouteEntry.grade_system == "ewbank")
        .all()
    ):
        if ewbank_num(e.grade) < 0:
            continue
        row = pyramid.setdefault(e.grade, {"onsight": 0, "flash": 0, "redpoint": 0})
        counted = True
        if e.send_type in ONSIGHT_SENDS:
            row["onsight"] += 1
        elif e.send_type in FLASH_SENDS:
            row["flash"] += 1
        elif e.send_type in RP_SENDS:
            row["redpoint"] += 1
        else:
            counted = False
        if counted:
            lead_sends.append(schemas.SendDetail(
                grade=e.grade, send_type=e.send_type, date=e.session.date,
                session_id=e.session_id, route_name=e.route_name, attempts=e.attempts,
            ))
    lead_sends.sort(key=lambda d: d.date, reverse=True)
    pyramid_rows = [
        schemas.LeadPyramidRow(grade=g, onsight=v["onsight"], flash=v["flash"], redpoint=v["redpoint"])
        for g, v in pyramid.items()
        if any(v.values())
    ]
    pyramid_rows.sort(key=lambda r: ewbank_num(r.grade), reverse=True)

    # Boulder send pyramid (V-scale, all-time): flash + redpoint/send counts.
    bl_pyramid: dict[str, dict[str, int]] = {}
    boulder_sends: list[schemas.SendDetail] = []
    for e in (
        db.query(models.LimitBoulderEntry)
        .join(models.Session, models.LimitBoulderEntry.session_id == models.Session.id)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .all()
    ):
        if e.send_type not in ("flash", "redpoint"):
            continue
        row = bl_pyramid.setdefault(e.grade, {"flash": 0, "send": 0})
        if e.send_type == "flash":
            row["flash"] += 1
        else:
            row["send"] += 1
        boulder_sends.append(schemas.SendDetail(
            grade=e.grade, send_type=e.send_type, date=e.session.date,
            session_id=e.session_id, attempts=e.attempts,
        ))
    boulder_sends.sort(key=lambda d: d.date, reverse=True)
    bl_pyramid_rows = [
        schemas.BoulderPyramidRow(grade=g, flash=v["flash"], send=v["send"])
        for g, v in bl_pyramid.items()
        if v["flash"] + v["send"] > 0
    ]
    bl_pyramid_rows.sort(key=lambda r: grade_to_int(r.grade, BOULDER_GRADE_ORDER), reverse=True)

    # Volume / trends — iterate all sessions that have any climbing entries.
    SEND_TYPES = {"onsight", "flash", "redpoint", "pinkpoint"}
    volume_points: list[schemas.ProgressPoint] = []
    send_rate_points: list[schemas.ProgressPoint] = []
    falls_points: list[schemas.ProgressPoint] = []
    daily_ticks: dict[date, int] = {}                         # heatmap (per calendar day)
    intensity_rows: list[schemas.SessionIntensity] = []       # volume-vs-intensity scatter

    all_sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since)
        .order_by(models.Session.date).all()
    )
    for s in all_sessions:
        total_ticks = len(s.boulder_entries) + len(s.lead_route_entries)
        if total_ticks == 0:
            continue

        # Heatmap: accumulate climbing ticks per calendar day (sessions may share a day).
        daily_ticks[s.date] = daily_ticks.get(s.date, 0) + total_ticks

        # Scatter: this session's volume vs its hardest send in each discipline.
        b_idx = max(
            (grade_to_int(e.grade, BOULDER_GRADE_ORDER)
             for e in s.boulder_entries if e.send_type in SEND_TYPES),
            default=None,
        )
        sent_leads = [
            e for e in s.lead_route_entries
            if e.send_type in SEND_TYPES and e.grade_system == "ewbank" and ewbank_num(e.grade) >= 0
        ]
        l_idx = max((ewbank_num(e.grade) for e in sent_leads), default=None)
        intensity_rows.append(schemas.SessionIntensity(
            date=s.date, total_ticks=total_ticks,
            hardest_boulder=b_idx,
            hardest_lead=l_idx,
            hardest_boulder_label=(BOULDER_GRADE_ORDER[b_idx] if b_idx is not None else None),
            hardest_lead_label=(str(l_idx) if l_idx is not None else None),
        ))

        # Volume: total climbing ticks this session
        volume_points.append(schemas.ProgressPoint(
            date=s.date, value=total_ticks,
            label=f"{total_ticks} tick{'s' if total_ticks != 1 else ''}",
        ))

        # Send rate: sends / total ticks (%)
        sends = sum(1 for e in s.boulder_entries if e.send_type in SEND_TYPES)
        sends += sum(1 for e in s.lead_route_entries if e.send_type in SEND_TYPES)
        rate = round(sends / total_ticks * 100)
        send_rate_points.append(schemas.ProgressPoint(
            date=s.date, value=rate,
            label=f"{sends}/{total_ticks} sends ({rate}%)",
        ))

        # Falls trend: avg falls per lead route (lead-only sessions with falls data)
        lead_with_falls = [e for e in s.lead_route_entries if e.falls is not None]
        if lead_with_falls:
            avg_falls = round(sum(e.falls for e in lead_with_falls) / len(lead_with_falls), 1)
            falls_points.append(schemas.ProgressPoint(
                date=s.date, value=avg_falls,
                label=f"avg {avg_falls} falls/route",
            ))

    # --- Phase I: mood / location / attempts / PB ---
    # Mood vs send rate: average send rate (%) per mood bucket across sessions
    # that had any ticks.
    mood_buckets: dict[int, list[float]] = {}
    for s in all_sessions:
        if s.mood is None:
            continue
        total = len(s.boulder_entries) + len(s.lead_route_entries)
        if total == 0:
            continue
        sends = sum(1 for e in s.boulder_entries if e.send_type in SEND_TYPES)
        sends += sum(1 for e in s.lead_route_entries if e.send_type in SEND_TYPES)
        mood_buckets.setdefault(s.mood, []).append(sends / total * 100)
    mood_rows = [
        schemas.MoodSendRatePoint(
            mood=m, sessions=len(rates),
            send_rate=round(sum(rates) / len(rates), 1) if rates else 0.0,
        )
        for m, rates in sorted(mood_buckets.items())
    ]

    # Location breakdown: per-location session count, total ticks, send rate (%).
    loc_data: dict[str, dict] = {}
    for s in all_sessions:
        loc = (s.location or "").strip()
        if not loc:
            continue
        bucket = loc_data.setdefault(loc, {"sessions": 0, "ticks": 0, "sends": 0})
        bucket["sessions"] += 1
        total = len(s.boulder_entries) + len(s.lead_route_entries)
        bucket["ticks"] += total
        bucket["sends"] += sum(1 for e in s.boulder_entries if e.send_type in SEND_TYPES)
        bucket["sends"] += sum(1 for e in s.lead_route_entries if e.send_type in SEND_TYPES)
    location_rows = [
        schemas.LocationBreakdownRow(
            location=loc, sessions=d["sessions"], total_ticks=d["ticks"],
            send_rate=round(d["sends"] / d["ticks"] * 100, 1) if d["ticks"] else 0.0,
        )
        for loc, d in loc_data.items()
    ]
    location_rows.sort(key=lambda r: r.total_ticks, reverse=True)
    location_rows = location_rows[:10]

    # Attempts histogram: count sends grouped by attempts (1, 2, 3, 4, 5+).
    attempts_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5+": 0}
    for e in (
        db.query(models.LeadRouteEntry)
        .join(models.Session, models.LeadRouteEntry.session_id == models.Session.id)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since).all()
    ):
        if e.send_type not in SEND_TYPES or e.attempts is None:
            continue
        bucket = str(e.attempts) if e.attempts <= 4 else "5+"
        if bucket in attempts_counts:
            attempts_counts[bucket] += 1
    for e in (
        db.query(models.LimitBoulderEntry)
        .join(models.Session, models.LimitBoulderEntry.session_id == models.Session.id)
        .filter(models.Session.user_id == uid)
        .filter(models.Session.date >= since).all()
    ):
        if e.send_type not in SEND_TYPES or e.attempts is None:
            continue
        bucket = str(e.attempts) if e.attempts <= 4 else "5+"
        if bucket in attempts_counts:
            attempts_counts[bucket] += 1
    attempts_rows = [
        schemas.AttemptsHistogramRow(bucket=b, count=c)
        for b, c in attempts_counts.items()
    ]

    # PB timeline: per session date, the running max lead grade (Ewbank int) +
    # running max boulder grade (vscale ladder idx) sent so far.
    pb_points: list[schemas.PBTimelinePoint] = []
    lead_pb_n = -1
    boulder_pb_n = -1
    lead_pb_label: str | None = None
    boulder_pb_label: str | None = None
    for s in all_sessions:
        changed = False
        for e in s.lead_route_entries:
            if e.send_type in SEND_TYPES and e.grade_system == "ewbank":
                n = ewbank_num(e.grade)
                if n > lead_pb_n:
                    lead_pb_n = n
                    lead_pb_label = e.grade
                    changed = True
        for e in s.boulder_entries:
            if e.send_type in SEND_TYPES:
                n = grade_to_int(e.grade, BOULDER_GRADE_ORDER)
                if n > boulder_pb_n:
                    boulder_pb_n = n
                    boulder_pb_label = e.grade
                    changed = True
        if changed:
            pb_points.append(schemas.PBTimelinePoint(
                date=s.date,
                lead_pb=lead_pb_n if lead_pb_n >= 0 else None,
                boulder_pb=boulder_pb_n if boulder_pb_n >= 0 else None,
                lead_grade=lead_pb_label,
                boulder_grade=boulder_pb_label,
            ))

    daily_activity = [
        schemas.DailyActivity(date=d, ticks=t)
        for d, t in sorted(daily_ticks.items())
    ]

    return schemas.ProgressData(
        daily_activity=daily_activity,
        session_intensity=intensity_rows,
        lead_sends=lead_sends,
        boulder_sends=boulder_sends,
        training_load=_training_load(db, uid, since),
        fingerboard_max_weight=fb_points,
        boulder_max_grade=bl_points,
        strength_max_weight=st_points,
        lead_onsight_progression=onsight_prog,
        lead_flash_progression=flash_prog,
        lead_redpoint_progression=rp_prog,
        lead_send_pyramid=pyramid_rows,
        boulder_send_pyramid=bl_pyramid_rows,
        session_volume=volume_points,
        send_rate=send_rate_points,
        falls_trend=falls_points,
        mood_vs_send_rate=mood_rows,
        location_breakdown=location_rows,
        attempts_histogram=attempts_rows,
        pb_timeline=pb_points,
    )


# ---------------------------------------------------------------------------
# Routes (projects) + pins
# ---------------------------------------------------------------------------

def get_route_or_404(route_id: int, db: DBSession, user: "models.User | None" = None) -> models.Route:
    q = db.query(models.Route).filter(models.Route.id == route_id)
    if user is not None:
        q = q.filter(models.Route.user_id == user.id)
    r = q.first()
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


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

def _achievement_payload(db: DBSession, user_id: int) -> list[schemas.Achievement]:
    """All defined achievements with locked/unlocked status for one user."""
    unlocked = {
        a.code: a.unlocked_at
        for a in db.query(models.Achievement).filter(models.Achievement.user_id == user_id).all()
    }
    return [
        schemas.Achievement(
            code=d.code, title=d.title, description=d.description, emoji=d.emoji,
            unlocked=d.code in unlocked, unlocked_at=unlocked.get(d.code),
        )
        for d in achievements.DEFS
    ]


def _buddy_state(db: DBSession, uid: int) -> schemas.BuddyState:
    """Compute the climbing-buddy mood from the user's session history.

    A recency ladder handles long gaps; otherwise the most recent session's
    character (new PB → stoked, training logged, pushing a new grade → nervous,
    getting pumped → cooked, or solid form → primed) drives the mood. Read-only.
    """
    SEND_TYPES = {"onsight", "flash", "redpoint", "pinkpoint"}

    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == uid)
        .order_by(models.Session.date.desc(), models.Session.id.desc())
        .all()
    )
    if not sessions:
        return schemas.BuddyState(state="primed", reason="no_sessions", days_since=0, build=0)

    latest = sessions[0]
    try:
        last_day = date.fromisoformat(str(latest.date)[:10])
        days_since = max(0, (date.today() - last_day).days)
    except ValueError:
        last_day = date.today()
        days_since = 0

    # All-time physique tier (0..3) from the hardest send ever logged. Mood reflects
    # the recent session; build reflects lifetime ability and persists through rest.
    all_boulder_pb = max(
        (grade_to_int(e.grade, BOULDER_GRADE_ORDER)
         for s in sessions for e in s.boulder_entries if e.send_type in SEND_TYPES),
        default=-1,
    )
    all_lead_pb = max(
        (grade_to_int(e.grade, EWBANK_GRADE_ORDER)
         for s in sessions for e in s.lead_route_entries
         if e.send_type in SEND_TYPES and e.grade_system == "ewbank"),
        default=-1,
    )

    def _boulder_tier(idx: int) -> int:
        if idx < 3:   return 0   # ≤ V2 — scrawny
        if idx <= 5:  return 1   # V3–V5 — lean
        if idx <= 8:  return 2   # V6–V8 — strong
        return 3                 # V9+   — jacked

    def _lead_tier(idx: int) -> int:
        if idx < 0:   return 0
        n = idx + 1              # Ewbank number
        if n <= 17:   return 0
        if n <= 21:   return 1
        if n <= 25:   return 2
        return 3

    build = max(_boulder_tier(all_boulder_pb), _lead_tier(all_lead_pb))

    def result(state: str, reason: str) -> schemas.BuddyState:
        return schemas.BuddyState(state=state, reason=reason, days_since=days_since, build=build)

    # Recency ladder — long gaps override the most recent session's character.
    if days_since >= 7:
        return result("detrained", "idle_7d")
    if days_since >= 4:
        return result("resting", "rest_days")

    # A freshly-unlocked achievement (on/after the most recent session) trumps the
    # session's character — nothing says "stoked" like a badge popping.
    recent_achievement = any(
        a.unlocked_at is not None and a.unlocked_at.date() >= last_day
        for a in db.query(models.Achievement).filter(models.Achievement.user_id == uid).all()
    )
    if recent_achievement:
        return result("stoked", "achievement")

    boulders = latest.boulder_entries
    leads = latest.lead_route_entries
    total = len(boulders) + len(leads)

    # No climbs logged — a pure board/strength day reads as training.
    if total == 0:
        if latest.fingerboard_entries or latest.strength_entries:
            return result("training", "training_only")
        return result("primed", "no_climbs")

    def b_int(g: str) -> int:
        return grade_to_int(g, BOULDER_GRADE_ORDER)

    def l_int(g: str) -> int:
        return grade_to_int(g, EWBANK_GRADE_ORDER)

    # Prior personal bests — every session except the most recent one.
    prior_boulder_pb = -1
    prior_lead_pb = -1
    for s in sessions[1:]:
        for e in s.boulder_entries:
            if e.send_type in SEND_TYPES:
                prior_boulder_pb = max(prior_boulder_pb, b_int(e.grade))
        for e in s.lead_route_entries:
            if e.send_type in SEND_TYPES and e.grade_system == "ewbank":
                prior_lead_pb = max(prior_lead_pb, l_int(e.grade))

    latest_boulder_send = max(
        (b_int(e.grade) for e in boulders if e.send_type in SEND_TYPES), default=-1
    )
    latest_lead_send = max(
        (l_int(e.grade) for e in leads if e.send_type in SEND_TYPES and e.grade_system == "ewbank"),
        default=-1,
    )

    # New personal best this session → absolutely stoked.
    if (latest_boulder_send >= 0 and latest_boulder_send > prior_boulder_pb) or \
       (latest_lead_send >= 0 and latest_lead_send > prior_lead_pb):
        return result("stoked", "new_pb")

    # Training load spiking (ACWR ≥ 1.5) → nudge a deload. This is where M4's
    # acute:chronic signal feeds the buddy's mood and the plan's deload banner.
    acwr = _current_acwr(db, uid)
    if acwr is not None and acwr >= DELOAD_ACWR:
        return schemas.BuddyState(state="cooked", reason="load_spike",
                                  days_since=days_since, build=build, load_ratio=round(acwr, 2))

    # Tried a grade harder than anything sent before, but didn't get it → nervous.
    # Requires an established PB so a first-ever session never reads as "nervous".
    pushed_boulder = prior_boulder_pb >= 0 and any(
        e.send_type not in SEND_TYPES and b_int(e.grade) > prior_boulder_pb for e in boulders
    )
    pushed_lead = prior_lead_pb >= 0 and any(
        e.send_type not in SEND_TYPES and e.grade_system == "ewbank" and l_int(e.grade) > prior_lead_pb
        for e in leads
    )
    if pushed_boulder or pushed_lead:
        return result("nervous", "new_grade_attempt")

    # Cooked — low send rate or falling a lot.
    sends = sum(1 for e in boulders if e.send_type in SEND_TYPES)
    sends += sum(1 for e in leads if e.send_type in SEND_TYPES)
    send_rate = sends / total
    lead_with_falls = [e for e in leads if e.falls is not None]
    avg_falls = sum(e.falls for e in lead_with_falls) / len(lead_with_falls) if lead_with_falls else 0
    if send_rate < 0.34 or avg_falls >= 2:
        return result("cooked", "low_send_rate")

    # A long, solid grind (90+ min) reads as dialled-in focus. Prefer the logged
    # duration, falling back to the timer span when only start/end are recorded.
    duration_min = latest.duration_minutes
    if duration_min is None and latest.started_at and latest.ended_at:
        duration_min = int((latest.ended_at - latest.started_at).total_seconds() // 60)
    if duration_min is not None and duration_min >= 90:
        return result("focused", "long_session")

    # Board/strength work alongside climbs → still a training vibe.
    if latest.fingerboard_entries or latest.strength_entries:
        return result("training", "training")

    # Solid, in-form day.
    return result("primed", "in_form")


@app.get("/api/buddy", response_model=schemas.BuddyState)
def get_buddy(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _buddy_state(db, current_user.id)


# ---------------------------------------------------------------------------
# Shared activity feed (Phase O1) — the one read that deliberately spans users.
# Everyone on a sendlog instance is a trusted friend group; a user can opt out
# via share_to_feed and they vanish from everyone's feed (including their own).
# ---------------------------------------------------------------------------

def _hardest_grade(entries, order, *, ewbank_only: bool = False) -> str | None:
    """Grade string of the hardest *sent* entry, or None if nothing was sent."""
    best_idx, best_grade = -1, None
    for e in entries:
        if e.send_type not in REDPOINT_SENDS:
            continue
        if ewbank_only and getattr(e, "grade_system", "ewbank") != "ewbank":
            continue
        idx = grade_to_int(e.grade, order)
        if idx > best_idx:
            best_idx, best_grade = idx, e.grade
    return best_grade


def _session_at(s: models.Session) -> datetime:
    """A sortable datetime for a session: the timer start, else midnight on its date."""
    if s.started_at:
        return s.started_at
    try:
        d = date.fromisoformat(str(s.date)[:10])
    except ValueError:
        d = date.today()
    return datetime.combine(d, datetime.min.time())


def _feed_key(kind: str, *, session_id: int | None = None,
              user_id: int | None = None, code: str | None = None) -> str:
    """Stable string identifier for a feed event, used as the reactions lookup key."""
    if kind == "session":
        return f"s:{session_id}"
    return f"a:{user_id}:{code}"


def _build_feed(db: DBSession, limit: int, current_user_id: int) -> list[schemas.FeedEvent]:
    users = {
        u.id: u
        for u in db.query(models.User).filter(models.User.share_to_feed.isnot(False)).all()
    }
    if not users:
        return []

    events: list[schemas.FeedEvent] = []

    # --- Session events (one per non-empty session), with running-PB detection ---
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id.in_(users.keys()))
        .all()
    )
    by_user: dict[int, list[models.Session]] = {}
    for s in sessions:
        by_user.setdefault(s.user_id, []).append(s)

    for uid, user_sessions in by_user.items():
        user_sessions.sort(key=lambda s: (str(s.date)[:10], s.id))  # chronological for PB
        run_boulder, run_lead = -1, -1
        for s in user_sessions:
            boulders, leads = s.boulder_entries, s.lead_route_entries
            total = len(boulders) + len(leads)
            has_training = bool(s.fingerboard_entries or s.strength_entries)
            if total == 0 and not has_training:
                continue  # empty placeholder session — not feed-worthy

            b_send = max((grade_to_int(e.grade, BOULDER_GRADE_ORDER)
                          for e in boulders if e.send_type in REDPOINT_SENDS), default=-1)
            l_send = max((grade_to_int(e.grade, EWBANK_GRADE_ORDER)
                          for e in leads
                          if e.send_type in REDPOINT_SENDS and e.grade_system == "ewbank"),
                         default=-1)
            is_pb = (b_send >= 0 and b_send > run_boulder) or (l_send >= 0 and l_send > run_lead)
            run_boulder, run_lead = max(run_boulder, b_send), max(run_lead, l_send)

            events.append(schemas.FeedEvent(
                kind="session", user_id=uid, username=users[uid].username,
                at=_session_at(s), session_id=s.id, date=s.date, location=s.location,
                feed_key=_feed_key("session", session_id=s.id),
                total_ticks=total,
                boulder_sends=sum(1 for e in boulders if e.send_type in REDPOINT_SENDS),
                lead_sends=sum(1 for e in leads if e.send_type in REDPOINT_SENDS),
                hardest_boulder=_hardest_grade(boulders, BOULDER_GRADE_ORDER),
                hardest_lead=_hardest_grade(leads, EWBANK_GRADE_ORDER, ewbank_only=True),
                training_only=(total == 0 and has_training),
                is_pb=is_pb,
                partner=s.partner,
            ))

    # --- Achievement events ---
    defs_by_code = {d.code: d for d in achievements.DEFS}
    achs = (
        db.query(models.Achievement)
        .filter(models.Achievement.user_id.in_(users.keys()))
        .all()
    )
    for a in achs:
        if a.unlocked_at is None:
            continue
        d = defs_by_code.get(a.code)
        events.append(schemas.FeedEvent(
            kind="achievement", user_id=a.user_id, username=users[a.user_id].username,
            at=a.unlocked_at, feed_key=_feed_key("achievement", user_id=a.user_id, code=a.code),
            code=a.code,
            title=d.title if d else a.code,
            emoji=d.emoji if d else "🏅",
        ))

    events.sort(key=lambda e: e.at, reverse=True)
    page = events[:limit]

    # --- Attach reactions (one bulk query for all events in the page) ---
    if page:
        all_keys = [e.feed_key for e in page]
        rxn_rows = db.query(models.Reaction).filter(models.Reaction.feed_key.in_(all_keys)).all()
        by_key: dict[str, list[models.Reaction]] = defaultdict(list)
        for r in rxn_rows:
            by_key[r.feed_key].append(r)
        for e in page:
            by_emoji: dict[str, list[models.Reaction]] = defaultdict(list)
            for r in by_key[e.feed_key]:
                by_emoji[r.emoji].append(r)
            e.reactions = [
                schemas.ReactionSummary(
                    emoji=emoji,
                    count=len(rxns),
                    reacted=any(r.user_id == current_user_id for r in rxns),
                    reaction_id=next(
                        (r.id for r in rxns if r.user_id == current_user_id), None
                    ),
                )
                for emoji, rxns in by_emoji.items()
            ]

    return page


@app.get("/api/feed", response_model=list[schemas.FeedEvent])
def get_feed(
    limit: int = 50,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Recent activity across all opted-in users on the instance, newest first."""
    return _build_feed(db, max(1, min(limit, 200)), current_user.id)


@app.post("/api/feed/react", response_model=schemas.ReactionOut, status_code=201)
def add_reaction(
    payload: schemas.ReactPayload,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Give props to a feed event. Idempotent — re-posting the same emoji returns the existing row."""
    if not payload.emoji or len(payload.emoji) > 8:
        raise HTTPException(400, "Invalid emoji")
    existing = (
        db.query(models.Reaction)
        .filter_by(feed_key=payload.feed_key, user_id=current_user.id, emoji=payload.emoji)
        .first()
    )
    if existing:
        return existing  # already reacted — idempotent
    r = models.Reaction(feed_key=payload.feed_key, user_id=current_user.id, emoji=payload.emoji)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@app.delete("/api/feed/react/{reaction_id}", status_code=204)
def remove_reaction(
    reaction_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Remove your own reaction. Returns 403 if the reaction belongs to another user."""
    r = db.get(models.Reaction, reaction_id)
    if not r:
        raise HTTPException(404, "Reaction not found")
    if r.user_id != current_user.id:
        raise HTTPException(403, "Not your reaction")
    db.delete(r)
    db.commit()


@app.get("/api/achievements", response_model=list[schemas.Achievement])
def list_achievements(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _achievement_payload(db, current_user.id)


@app.post("/api/achievements/check", response_model=schemas.AchievementCheckResult)
def check_achievements(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    new_defs = achievements.check_and_unlock(db, current_user.id)
    unlocked_at = {
        a.code: a.unlocked_at
        for a in db.query(models.Achievement).filter(models.Achievement.user_id == current_user.id).all()
    }
    return schemas.AchievementCheckResult(
        newly_unlocked=[
            schemas.Achievement(
                code=d.code, title=d.title, description=d.description, emoji=d.emoji,
                unlocked=True, unlocked_at=unlocked_at.get(d.code),
            )
            for d in new_defs
        ]
    )


def route_summary(r: models.Route) -> schemas.RouteSummary:
    dates = [p.date for p in r.pins]
    return schemas.RouteSummary(
        id=r.id, name=r.name, kind=r.kind, grade=r.grade, grade_system=r.grade_system,
        location=r.location, notes=r.notes, topo_filename=r.topo_filename,
        rating=r.rating,
        pin_count=len(r.pins), last_pin_date=max(dates) if dates else None,
    )


@app.get("/api/routes", response_model=list[schemas.RouteSummary])
def list_routes(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    routes = (
        db.query(models.Route)
        .filter(models.Route.user_id == current_user.id)
        .order_by(models.Route.created_at.desc()).all()
    )
    return [route_summary(r) for r in routes]


@app.post("/api/routes", response_model=schemas.RouteDetail, status_code=201)
def create_route(
    payload: schemas.RouteCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    route = models.Route(user_id=current_user.id, **payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    route.ticks = []
    return route


@app.get("/api/routes/{route_id}", response_model=schemas.RouteDetail)
def get_route(
    route_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    route = get_route_or_404(route_id, db, current_user)
    route.ticks = (
        db.query(models.LeadRouteEntry)
        .filter(models.LeadRouteEntry.route_id == route_id)
        .order_by(models.LeadRouteEntry.logged_at)
        .all()
    )
    for t in route.ticks:
        t.photos = []
    route.boulder_ticks = (
        db.query(models.LimitBoulderEntry)
        .filter(models.LimitBoulderEntry.route_id == route_id)
        .order_by(models.LimitBoulderEntry.logged_at)
        .all()
    )
    for t in route.boulder_ticks:
        t.photos = []
    attach_route_photos(route, db)
    # Beta notes — include from all users so partners can read each other's crux notes.
    note_rows = (
        db.query(models.RouteNote)
        .filter(models.RouteNote.route_id == route_id)
        .order_by(models.RouteNote.created_at)
        .all()
    )
    user_cache: dict[int, str] = {}
    def _uname(uid: int) -> str:
        if uid not in user_cache:
            u = db.get(models.User, uid)
            user_cache[uid] = u.username if u else "?"
        return user_cache[uid]
    route.notes_log = [
        schemas.RouteNote(
            id=n.id, route_id=n.route_id, user_id=n.user_id,
            username=_uname(n.user_id), text=n.text, created_at=n.created_at,
        )
        for n in note_rows
    ]
    return route


@app.patch("/api/routes/{route_id}", response_model=schemas.RouteDetail)
def update_route(
    route_id: int, payload: schemas.RouteUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    route = get_route_or_404(route_id, db, current_user)
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
def delete_route(
    route_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    route = get_route_or_404(route_id, db, current_user)
    # unlink ticks
    for t in db.query(models.LeadRouteEntry).filter(models.LeadRouteEntry.route_id == route_id).all():
        t.route_id = None
    # remove topo file (only if route-owned, i.e. starts with "route_")
    if route.topo_filename and route.topo_filename.startswith("route_"):
        images.delete_image(PHOTOS_DIR, route.topo_filename)
    db.delete(route)
    db.commit()


@app.post("/api/routes/{route_id}/notes", response_model=schemas.RouteNote, status_code=201)
def add_route_note(
    route_id: int, payload: schemas.RouteNoteCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Add a beta / progress note to a project. Visible to all users (shared project log)."""
    # Verify the route exists and current_user owns it (or can at least see it).
    get_route_or_404(route_id, db, current_user)
    if not payload.text.strip():
        raise HTTPException(400, "Note text cannot be empty")
    note = models.RouteNote(route_id=route_id, user_id=current_user.id, text=payload.text.strip())
    db.add(note)
    db.commit()
    db.refresh(note)
    return schemas.RouteNote(
        id=note.id, route_id=note.route_id, user_id=note.user_id,
        username=current_user.username, text=note.text, created_at=note.created_at,
    )


@app.delete("/api/route_notes/{note_id}", status_code=204)
def delete_route_note(
    note_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Delete your own beta note. 403 if it belongs to another user."""
    note = db.get(models.RouteNote, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(403, "Not your note")
    db.delete(note)
    db.commit()


# ---------------------------------------------------------------------------
# Gyms + walls (Phase P1)
# ---------------------------------------------------------------------------

def get_gym_or_404(gym_id: int, db: DBSession, user: models.User) -> models.Gym:
    gym = (
        db.query(models.Gym)
        .filter(models.Gym.id == gym_id, models.Gym.user_id == user.id)
        .first()
    )
    if not gym:
        raise HTTPException(404, "Gym not found")
    return gym


def _wall_tick_dates(wall_id: int, db: DBSession) -> list[date]:
    """Session dates of every tick attributed to a wall (boulder + lead)."""
    dates: list[date] = []
    for e in (db.query(models.LimitBoulderEntry)
              .join(models.Session).filter(models.LimitBoulderEntry.wall_id == wall_id).all()):
        dates.append(e.session.date)
    for e in (db.query(models.LeadRouteEntry)
              .join(models.Session).filter(models.LeadRouteEntry.wall_id == wall_id).all()):
        dates.append(e.session.date)
    return dates


def _wall_boulder_colors(wall_id: int, db: DBSession) -> list[tuple[date, str]]:
    """(session date, hold colour) for every coloured boulder tick on a wall."""
    out: list[tuple[date, str]] = []
    for e in (db.query(models.LimitBoulderEntry)
              .join(models.Session)
              .filter(models.LimitBoulderEntry.wall_id == wall_id,
                      models.LimitBoulderEntry.hold_color.isnot(None)).all()):
        out.append((e.session.date, e.hold_color))
    return out


def _set_circuits(s: models.WallSet, end: date | None,
                  colored_ticks: list[tuple[date, str]]) -> list[schemas.Circuit]:
    """Per-colour breakdown for a set: tick counts (from colour tags in the set
    window) merged with any stored circuit totals. Colours appear automatically
    once climbed; a stored total adds the N/total denominator."""
    counts: dict[str, int] = {}
    for d, c in colored_ticks:
        if d >= s.set_on and (end is None or d < end):
            counts[c] = counts.get(c, 0) + 1
    explicit = {sc.color: sc for sc in s.circuits}
    circuits = [
        schemas.Circuit(
            color=color,
            tick_count=counts.get(color, 0),
            total_count=explicit[color].total_count if color in explicit else None,
            label=explicit[color].label if color in explicit else None,
            circuit_id=explicit[color].id if color in explicit else None,
        )
        for color in (counts.keys() | explicit.keys())
    ]
    circuits.sort(key=lambda c: (-c.tick_count, c.color))
    return circuits


def _wall_to_schema(wall: models.Wall, db: DBSession) -> schemas.Wall:
    """Serialise a wall with its set history, the current set's tick count, and
    each set's colour-circuit breakdown. A tick belongs to whichever set was
    active on its session date, so each set's window is [set_on, next set_on)."""
    sets_sorted = sorted(wall.sets, key=lambda s: s.set_on)
    dates = _wall_tick_dates(wall.id, db) if sets_sorted else []
    colored = _wall_boulder_colors(wall.id, db) if sets_sorted else []
    out: list[schemas.WallSet] = []
    for i, s in enumerate(sets_sorted):
        end = sets_sorted[i + 1].set_on if i + 1 < len(sets_sorted) else None
        cnt = sum(1 for d in dates if d >= s.set_on and (end is None or d < end))
        out.append(schemas.WallSet(
            id=s.id, wall_id=s.wall_id, label=s.label, set_on=s.set_on,
            problem_count=s.problem_count, tick_count=cnt,
            circuits=_set_circuits(s, end, colored),
        ))
    return schemas.Wall(
        id=wall.id, gym_id=wall.gym_id, name=wall.name, angle=wall.angle,
        sets=out, current_set=(out[-1] if out else None),
    )


def _gym_to_schema(gym: models.Gym, db: DBSession) -> schemas.Gym:
    return schemas.Gym(
        id=gym.id, name=gym.name, floorplan_filename=gym.floorplan_filename,
        walls=[_wall_to_schema(w, db) for w in gym.walls],
    )


def _wallset_to_schema(s: models.WallSet, db: DBSession) -> schemas.WallSet:
    wall = db.get(models.Wall, s.wall_id)
    for ws in _wall_to_schema(wall, db).sets:
        if ws.id == s.id:
            return ws
    return schemas.WallSet(id=s.id, wall_id=s.wall_id, label=s.label,
                           set_on=s.set_on, problem_count=s.problem_count)


@app.get("/api/gyms", response_model=list[schemas.Gym])
def list_gyms(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    gyms = (
        db.query(models.Gym)
        .filter(models.Gym.user_id == current_user.id)
        .order_by(models.Gym.name)
        .all()
    )
    return [_gym_to_schema(g, db) for g in gyms]


@app.post("/api/gyms", response_model=schemas.Gym, status_code=201)
def create_gym(
    payload: schemas.GymCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not payload.name.strip():
        raise HTTPException(400, "Gym name cannot be empty")
    gym = models.Gym(user_id=current_user.id, name=payload.name.strip())
    db.add(gym)
    db.commit()
    db.refresh(gym)
    return _gym_to_schema(gym, db)


@app.patch("/api/gyms/{gym_id}", response_model=schemas.Gym)
def update_gym(
    gym_id: int, payload: schemas.GymUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    gym = get_gym_or_404(gym_id, db, current_user)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields:
        if not (fields["name"] or "").strip():
            raise HTTPException(400, "Gym name cannot be empty")
        gym.name = fields["name"].strip()
    db.commit()
    db.refresh(gym)
    return _gym_to_schema(gym, db)


@app.delete("/api/gyms/{gym_id}", status_code=204)
def delete_gym(
    gym_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    gym = get_gym_or_404(gym_id, db, current_user)
    # Detach sessions that referenced this gym (keep the sessions themselves).
    db.query(models.Session).filter(
        models.Session.gym_id == gym_id
    ).update({"gym_id": None})
    db.delete(gym)  # walls cascade via the relationship
    db.commit()


@app.post("/api/gyms/{gym_id}/walls", response_model=schemas.Wall, status_code=201)
def create_wall(
    gym_id: int, payload: schemas.WallCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_gym_or_404(gym_id, db, current_user)  # ownership check
    if not payload.name.strip():
        raise HTTPException(400, "Wall name cannot be empty")
    wall = models.Wall(gym_id=gym_id, name=payload.name.strip(), angle=payload.angle)
    db.add(wall)
    db.commit()
    db.refresh(wall)
    return _wall_to_schema(wall, db)


def get_owned_wall_or_404(wall_id: int, db: DBSession, user: models.User) -> models.Wall:
    wall = db.get(models.Wall, wall_id)
    if not wall:
        raise HTTPException(404, "Wall not found")
    get_gym_or_404(wall.gym_id, db, user)  # 404 if the parent gym isn't the user's
    return wall


@app.patch("/api/walls/{wall_id}", response_model=schemas.Wall)
def update_wall(
    wall_id: int, payload: schemas.WallUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    wall = get_owned_wall_or_404(wall_id, db, current_user)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields:
        if not (fields["name"] or "").strip():
            raise HTTPException(400, "Wall name cannot be empty")
        wall.name = fields["name"].strip()
    if "angle" in fields:
        wall.angle = fields["angle"]
    db.commit()
    db.refresh(wall)
    return _wall_to_schema(wall, db)


@app.delete("/api/walls/{wall_id}", status_code=204)
def delete_wall(
    wall_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    wall = get_owned_wall_or_404(wall_id, db, current_user)
    # Detach ticks that referenced this wall (keep the ticks themselves).
    db.query(models.LimitBoulderEntry).filter(
        models.LimitBoulderEntry.wall_id == wall_id
    ).update({"wall_id": None})
    db.query(models.LeadRouteEntry).filter(
        models.LeadRouteEntry.wall_id == wall_id
    ).update({"wall_id": None})
    db.delete(wall)  # sets cascade via the relationship
    db.commit()


# --- Sets (reset generations) ---

def get_owned_set_or_404(set_id: int, db: DBSession, user: models.User) -> models.WallSet:
    s = db.get(models.WallSet, set_id)
    if not s:
        raise HTTPException(404, "Set not found")
    get_owned_wall_or_404(s.wall_id, db, user)  # 404 if the wall/gym isn't the user's
    return s


@app.post("/api/walls/{wall_id}/sets", response_model=schemas.WallSet, status_code=201)
def create_set(
    wall_id: int, payload: schemas.WallSetCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Record a reset — a new set becomes the wall's current generation."""
    get_owned_wall_or_404(wall_id, db, current_user)
    s = models.WallSet(
        wall_id=wall_id,
        label=(payload.label.strip() if payload.label and payload.label.strip() else None),
        set_on=payload.set_on or date.today(),
        problem_count=payload.problem_count,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _wallset_to_schema(s, db)


@app.patch("/api/sets/{set_id}", response_model=schemas.WallSet)
def update_set(
    set_id: int, payload: schemas.WallSetUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    s = get_owned_set_or_404(set_id, db, current_user)
    fields = payload.model_dump(exclude_unset=True)
    if "label" in fields:
        s.label = (fields["label"].strip() if fields["label"] and fields["label"].strip() else None)
    if "set_on" in fields and fields["set_on"] is not None:
        s.set_on = fields["set_on"]
    if "problem_count" in fields:
        s.problem_count = fields["problem_count"]
    db.commit()
    db.refresh(s)
    return _wallset_to_schema(s, db)


@app.delete("/api/sets/{set_id}", status_code=204)
def delete_set(
    set_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    s = get_owned_set_or_404(set_id, db, current_user)
    db.delete(s)
    db.commit()


# --- Circuits (per-colour progress within a set) ---

def _circuit_for(s: models.WallSet, color: str, db: DBSession) -> schemas.Circuit:
    wall = db.get(models.Wall, s.wall_id)
    for ws in _wall_to_schema(wall, db).sets:
        if ws.id == s.id:
            for c in ws.circuits:
                if c.color == color:
                    return c
    return schemas.Circuit(color=color)


@app.post("/api/sets/{set_id}/circuits", response_model=schemas.Circuit, status_code=201)
def upsert_circuit(
    set_id: int, payload: schemas.CircuitUpsert,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Set (or update) a colour circuit's total for ``N/total`` progress. Upsert
    keyed on (set, colour)."""
    s = get_owned_set_or_404(set_id, db, current_user)
    color = payload.color.strip()
    if not color:
        raise HTTPException(400, "Colour required")
    label = payload.label.strip() if payload.label and payload.label.strip() else None
    existing = (
        db.query(models.SetCircuit)
        .filter_by(wall_set_id=set_id, color=color)
        .first()
    )
    if existing:
        existing.total_count = payload.total_count
        existing.label = label
    else:
        db.add(models.SetCircuit(
            wall_set_id=set_id, color=color,
            total_count=payload.total_count, label=label,
        ))
    db.commit()
    return _circuit_for(s, color, db)


@app.delete("/api/circuits/{circuit_id}", status_code=204)
def delete_circuit(
    circuit_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Clear a circuit's stored total. The colour still shows (auto-discovered)
    if it has ticks."""
    c = db.get(models.SetCircuit, circuit_id)
    if not c:
        raise HTTPException(404, "Circuit not found")
    get_owned_set_or_404(c.wall_set_id, db, current_user)  # ownership check
    db.delete(c)
    db.commit()


@app.post("/api/routes/{route_id}/topo", response_model=schemas.RouteDetail)
async def upload_topo(
    route_id: int, file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    route = get_route_or_404(route_id, db, current_user)
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
    route.boulder_ticks = []
    attach_route_photos(route, db)
    return route


@app.post("/api/routes/{route_id}/topo/from-photo", response_model=schemas.RouteDetail)
def topo_from_photo(
    route_id: int, photo_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Promote an existing route gallery photo (or tick photo) to be this route's topo."""
    route = get_route_or_404(route_id, db, current_user)
    photo = db.get(models.EntryPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    # Verify the photo belongs to the calling user.
    try:
        _verify_photo_owner(photo.entry_type, photo.entry_id, db, current_user)
    except HTTPException:
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
    route.boulder_ticks = []
    attach_route_photos(route, db)
    return route


def _get_owned_pin_or_404(pin_id: int, db: DBSession, user: models.User) -> models.RoutePin:
    pin = (
        db.query(models.RoutePin)
        .join(models.Route, models.RoutePin.route_id == models.Route.id)
        .filter(models.RoutePin.id == pin_id, models.Route.user_id == user.id)
        .first()
    )
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return pin


@app.post("/api/routes/{route_id}/pins", response_model=schemas.RoutePin, status_code=201)
def add_pin(
    route_id: int, payload: schemas.RoutePinCreate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_route_or_404(route_id, db, current_user)
    pin = models.RoutePin(route_id=route_id, **payload.model_dump())
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return pin


@app.patch("/api/pins/{pin_id}", response_model=schemas.RoutePin)
def update_pin(
    pin_id: int, payload: schemas.RoutePinUpdate,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    pin = _get_owned_pin_or_404(pin_id, db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pin, field, value)
    db.commit()
    db.refresh(pin)
    return pin


@app.delete("/api/pins/{pin_id}", status_code=204)
def delete_pin(
    pin_id: int,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    pin = _get_owned_pin_or_404(pin_id, db, current_user)
    db.delete(pin)
    db.commit()


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------

@app.get("/api/export")
def export_data(
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Dump the calling user's sessions (with entries) and routes (with pins) as JSON.
    Photo files are not included — data only."""
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .order_by(models.Session.date).all()
    )
    routes = (
        db.query(models.Route)
        .filter(models.Route.user_id == current_user.id)
        .order_by(models.Route.id).all()
    )

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
def import_data(
    payload: schemas.ImportPayload,
    db: DBSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Append exported data as new records under the calling user (new IDs)."""
    if payload.version != 1:
        raise HTTPException(status_code=400, detail=f"Unsupported export version: {payload.version}")

    sessions_imported = 0
    for s in payload.sessions:
        if not isinstance(s, dict) or "date" not in s:
            continue
        session = models.Session(
            user_id=current_user.id,
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
        route = models.Route(user_id=current_user.id, **{k: r[k] for k in _ROUTE_FIELDS if k in r})
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
    _static_root = static_dir.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Serve real files from the static dir if they exist (e.g. /stickers/*,
        # /favicon.svg, /manifest.webmanifest) — otherwise fall back to
        # index.html so the SPA router can handle client-side paths.
        # Guard against path traversal by resolving and confirming the
        # candidate is inside static_dir.
        if full_path:
            candidate = (static_dir / full_path).resolve()
            try:
                candidate.relative_to(_static_root)
            except ValueError:
                pass  # traversal attempt — fall through to index.html
            else:
                if candidate.is_file():
                    return FileResponse(candidate)
        return FileResponse(static_dir / "index.html")
