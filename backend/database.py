import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./climbing.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations() -> None:
    """Lightweight in-place SQLite migrations (no Alembic wired).

    Adds columns introduced after the initial schema and backfills the
    boulder ``sent`` boolean into the new ``send_type`` column.
    """
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "sessions" not in tables:
        return  # fresh DB — create_all handles everything

    def columns(table: str) -> set[str]:
        return {c["name"] for c in inspect(engine).get_columns(table)}

    with engine.begin() as conn:
        # Session timer
        sess_cols = columns("sessions")
        if "started_at" not in sess_cols:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN started_at DATETIME"))
        if "ended_at" not in sess_cols:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN ended_at DATETIME"))

        # Boulder send_type (migrated from sent) + logged_at
        b_cols = columns("boulder_entries")
        if "send_type" not in b_cols:
            conn.execute(text("ALTER TABLE boulder_entries ADD COLUMN send_type VARCHAR(20)"))
            if "sent" in b_cols:
                conn.execute(text(
                    "UPDATE boulder_entries SET send_type = "
                    "CASE WHEN sent THEN 'redpoint' ELSE 'working' END "
                    "WHERE send_type IS NULL"
                ))
            else:
                conn.execute(text("UPDATE boulder_entries SET send_type = 'redpoint' WHERE send_type IS NULL"))
        if "logged_at" not in b_cols:
            conn.execute(text("ALTER TABLE boulder_entries ADD COLUMN logged_at DATETIME"))
        # Drop the legacy NOT NULL `sent` column now that send_type carries it
        # (requires SQLite >= 3.35; harmless to skip on older engines).
        if "sent" in columns("boulder_entries"):
            try:
                conn.execute(text("ALTER TABLE boulder_entries DROP COLUMN sent"))
            except Exception:
                pass

        # Lead logged_at + route_id (project link)
        l_cols = columns("lead_route_entries")
        if "logged_at" not in l_cols:
            conn.execute(text("ALTER TABLE lead_route_entries ADD COLUMN logged_at DATETIME"))
        if "route_id" not in l_cols:
            conn.execute(text("ALTER TABLE lead_route_entries ADD COLUMN route_id INTEGER"))
