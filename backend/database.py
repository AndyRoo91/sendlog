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
        if "mood" not in sess_cols:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN mood INTEGER"))

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

        # Boulder route_id (boulder project link)
        if "route_id" not in columns("boulder_entries"):
            conn.execute(text("ALTER TABLE boulder_entries ADD COLUMN route_id INTEGER"))

        # Route kind (lead | boulder), default existing rows to 'lead'
        if "kind" not in columns("routes"):
            conn.execute(text("ALTER TABLE routes ADD COLUMN kind VARCHAR(10)"))
            conn.execute(text("UPDATE routes SET kind = 'lead' WHERE kind IS NULL"))

        # Friend-sticker rating (1..3, NULL = unrated)
        if "rating" not in columns("routes"):
            conn.execute(text("ALTER TABLE routes ADD COLUMN rating INTEGER"))

        # Phase F1: ownership columns. We add them nullable here; the seed step
        # in main.run_seed() backfills them and the ORM enforces NOT NULL going
        # forward so new rows always carry a user_id.
        for table in ("sessions", "routes", "achievements"):
            if table not in tables:
                continue
            if "user_id" not in columns(table):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))
