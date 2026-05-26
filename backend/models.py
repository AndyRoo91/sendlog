from datetime import date
from sqlalchemy import Date, Float, ForeignKey, Integer, String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(100))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

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
    sent: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

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

    session: Mapped["Session"] = relationship(back_populates="lead_route_entries")


class EntryPhoto(Base):
    """Photo attached to a lead route or boulder entry."""
    __tablename__ = "entry_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entry_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "lead" | "boulder"
    entry_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
