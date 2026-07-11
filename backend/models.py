from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class User(Base):
    """A login. Owns sessions, routes, achievements. Cascade-deletes on user delete."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    pin_hash: Mapped[str | None] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # When False, this user's activity is hidden from the shared instance feed.
    share_to_feed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Weekly training goals (Phase Q1) — nullable = unset.
    weekly_session_goal: Mapped[int | None] = mapped_column(Integer)
    weekly_tick_goal: Mapped[int | None] = mapped_column(Integer)
    # Which animal fronts the climbing buddy (gecko / ibex / galah / wombat).
    buddy_species: Mapped[str] = mapped_column(String(20), nullable=False, default="gecko")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(100))
    gym_id: Mapped[int | None] = mapped_column(ForeignKey("gyms.id"), index=True)  # optional venue
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    partner: Mapped[str | None] = mapped_column(String(200))  # free-text "climbed with…"
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    mood: Mapped[int | None] = mapped_column(Integer)  # 1..5 self-rating set on session close

    warmup_entries: Mapped[list["WarmupEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    fingerboard_entries: Mapped[list["FingerboardEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    boulder_entries: Mapped[list["LimitBoulderEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    strength_entries: Mapped[list["StrengthEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    lead_route_entries: Mapped[list["LeadRouteEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class WarmupEntry(Base):
    __tablename__ = "warmup_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    activity: Mapped[str] = mapped_column(String(200), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    session: Mapped["Session"] = relationship(back_populates="warmup_entries")


class FingerboardEntry(Base):
    __tablename__ = "fingerboard_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    edge_mm: Mapped[int | None] = mapped_column(Integer)
    added_weight_kg: Mapped[float | None] = mapped_column(Float)
    hang_duration_s: Mapped[int | None] = mapped_column(Integer)
    num_sets: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    session: Mapped["Session"] = relationship(back_populates="fingerboard_entries")


class LimitBoulderEntry(Base):
    __tablename__ = "boulder_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    send_type: Mapped[str] = mapped_column(String(20), nullable=False, default="redpoint")
    attempts: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    logged_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), index=True)
    wall_id: Mapped[int | None] = mapped_column(ForeignKey("walls.id"), index=True)  # gym wall
    hold_color: Mapped[str | None] = mapped_column(String(20))  # hex hold/circuit colour

    session: Mapped["Session"] = relationship(back_populates="boulder_entries")


class StrengthEntry(Base):
    __tablename__ = "strength_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    exercise: Mapped[str] = mapped_column(String(100), nullable=False)
    reps: Mapped[int | None] = mapped_column(Integer)
    added_weight_kg: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)

    session: Mapped["Session"] = relationship(back_populates="strength_entries")


class LeadRouteEntry(Base):
    __tablename__ = "lead_route_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    route_name: Mapped[str | None] = mapped_column(String(200))
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    grade_system: Mapped[str] = mapped_column(String(10), nullable=False, default="ewbank")
    send_type: Mapped[str] = mapped_column(String(20), nullable=False, default="redpoint")
    attempts: Mapped[int | None] = mapped_column(Integer)
    falls: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    logged_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), index=True)
    rating: Mapped[int | None] = mapped_column(Integer)  # 1..5 friend-sticker rating
    wall_id: Mapped[int | None] = mapped_column(ForeignKey("walls.id"), index=True)  # gym wall

    session: Mapped["Session"] = relationship(back_populates="lead_route_entries")


class EntryPhoto(Base):
    """Photo attached to a lead route or boulder entry."""
    __tablename__ = "entry_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entry_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "lead" | "boulder"
    entry_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)


class Route(Base):
    """A persistent project (lead or boulder) — owns a topo photo and high-point pins."""
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="lead")
    grade: Mapped[str | None] = mapped_column(String(10))
    grade_system: Mapped[str] = mapped_column(String(10), nullable=False, default="ewbank")
    location: Mapped[str | None] = mapped_column(String(100))
    topo_filename: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer)  # 1..3 friend-sticker rating
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow)

    pins: Mapped[list["RoutePin"]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )


class Achievement(Base):
    """One row per unlocked achievement, per user. ``code`` matches a definition in achievements.py."""
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class RoutePin(Base):
    """A dated marker on a route's topo photo (x/y are 0..1 fractions of the image)."""
    __tablename__ = "route_pins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="highpoint")
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow)

    route: Mapped["Route"] = relationship(back_populates="pins")


class Reaction(Base):
    """A 'props' reaction from one user on a feed event (session or achievement).
    ``feed_key`` is a stable string: ``s:{session_id}`` or ``a:{user_id}:{code}``."""
    __tablename__ = "reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    feed_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    emoji: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("feed_key", "user_id", "emoji", name="uq_reaction"),)


class RouteNote(Base):
    """A single beta note on a project/route — multiple notes form the project log."""
    __tablename__ = "route_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Gym(Base):
    """A first-class indoor venue (vs the free-text ``Session.location``). Owns walls.
    ``floorplan_filename`` is reserved for a later top-down floorplan feature."""
    __tablename__ = "gyms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    floorplan_filename: Mapped[str | None] = mapped_column(String(200))  # reserved (Phase P, later)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    walls: Mapped[list["Wall"]] = relationship(
        back_populates="gym", cascade="all, delete-orphan", order_by="Wall.id"
    )


class Wall(Base):
    """A climbable surface within a gym. ``angle`` is degrees from vertical:
    negative = slab, 0 = vertical, positive = overhang."""
    __tablename__ = "walls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    gym_id: Mapped[int] = mapped_column(ForeignKey("gyms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    angle: Mapped[int | None] = mapped_column(Integer)  # degrees from vertical
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    gym: Mapped["Gym"] = relationship(back_populates="walls")
    sets: Mapped[list["WallSet"]] = relationship(
        back_populates="wall", cascade="all, delete-orphan", order_by="WallSet.set_on"
    )


class WallSet(Base):
    """A 'set' — one generation of problems on a wall, between resets. The set with
    the latest ``set_on`` is the wall's current set; ticks resolve to a set by date."""
    __tablename__ = "wall_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_id: Mapped[int] = mapped_column(ForeignKey("walls.id"), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(120))         # e.g. "Jan reset"
    set_on: Mapped[date] = mapped_column(Date, nullable=False)     # day it went up
    problem_count: Mapped[int | None] = mapped_column(Integer)     # total problems, for % done
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    wall: Mapped["Wall"] = relationship(back_populates="sets")
    circuits: Mapped[list["SetCircuit"]] = relationship(
        back_populates="wall_set", cascade="all, delete-orphan"
    )


class Plan(Base):
    """An active training plan generated from a template (Phase Q3). One per user;
    creating a new plan replaces the old. Owns its scheduled sessions."""
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    template_key: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    sessions: Mapped[list["PlannedSession"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlannedSession.scheduled_date"
    )


class PlannedSession(Base):
    """One prescribed session in a plan. 'Done' is derived by matching the date
    against the user's real logged sessions — no manual bookkeeping."""
    __tablename__ = "planned_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False, index=True)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    focus: Mapped[str | None] = mapped_column(Text)

    plan: Mapped["Plan"] = relationship(back_populates="sessions")


class FingerboardProtocol(Base):
    """A saved hangboard protocol that prefills the fingerboard logger
    (Phase Q2). Mirrors the FingerboardEntry fields, plus a name."""
    __tablename__ = "fingerboard_protocols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    edge_mm: Mapped[int | None] = mapped_column(Integer)
    added_weight_kg: Mapped[float | None] = mapped_column(Float)
    hang_duration_s: Mapped[int | None] = mapped_column(Integer)
    num_sets: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SetCircuit(Base):
    """A colour circuit within a set — stores the optional total (denominator)
    for ``N/total`` progress. Per-colour tick counts are derived from ticks."""
    __tablename__ = "set_circuits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_set_id: Mapped[int] = mapped_column(ForeignKey("wall_sets.id"), nullable=False, index=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False)   # hex
    total_count: Mapped[int | None] = mapped_column(Integer)         # problems of this colour
    label: Mapped[str | None] = mapped_column(String(60))            # optional, e.g. "comp circuit"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    wall_set: Mapped["WallSet"] = relationship(back_populates="circuits")

    __table_args__ = (UniqueConstraint("wall_set_id", "color", name="uq_set_circuit"),)
