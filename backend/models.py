from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(100))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
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
