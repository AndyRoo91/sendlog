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

        # Friend-sticker rating (1..5, NULL = unrated). Lives on both routes
        # and lead_route_entries (per-tick rating).
        if "rating" not in columns("routes"):
            conn.execute(text("ALTER TABLE routes ADD COLUMN rating INTEGER"))
        if "rating" not in columns("lead_route_entries"):
            conn.execute(text("ALTER TABLE lead_route_entries ADD COLUMN rating INTEGER"))

        # Phase F1: ownership columns. We add them nullable here; the seed step
        # in main.run_seed() backfills them and the ORM enforces NOT NULL going
        # forward so new rows always carry a user_id.
        for table in ("sessions", "routes", "achievements"):
            if table not in tables:
                continue
            if "user_id" not in columns(table):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))

        # Phase O1: shared-feed opt-out. Default existing users to sharing (on).
        if "users" in tables and "share_to_feed" not in columns("users"):
            conn.execute(text("ALTER TABLE users ADD COLUMN share_to_feed BOOLEAN"))
            conn.execute(text("UPDATE users SET share_to_feed = 1 WHERE share_to_feed IS NULL"))

        # Phase Q1: weekly training goals.
        if "users" in tables and "weekly_session_goal" not in columns("users"):
            conn.execute(text("ALTER TABLE users ADD COLUMN weekly_session_goal INTEGER"))
        if "users" in tables and "weekly_tick_goal" not in columns("users"):
            conn.execute(text("ALTER TABLE users ADD COLUMN weekly_tick_goal INTEGER"))

        # Phase Q3: training plans + planned sessions.
        if "plans" not in tables:
            conn.execute(text("""
                CREATE TABLE plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    template_key VARCHAR(40) NOT NULL,
                    name VARCHAR(120) NOT NULL,
                    start_date DATE NOT NULL,
                    weeks INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_plans_user_id ON plans(user_id)"))
        if "planned_sessions" not in tables:
            conn.execute(text("""
                CREATE TABLE planned_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plan_id INTEGER NOT NULL REFERENCES plans(id),
                    scheduled_date DATE NOT NULL,
                    title VARCHAR(120) NOT NULL,
                    focus TEXT
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_planned_sessions_plan_id ON planned_sessions(plan_id)"))

        # Phase Q2: saved fingerboard protocols.
        if "fingerboard_protocols" not in tables:
            conn.execute(text("""
                CREATE TABLE fingerboard_protocols (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    name VARCHAR(80) NOT NULL,
                    edge_mm INTEGER,
                    added_weight_kg FLOAT,
                    hang_duration_s INTEGER,
                    num_sets INTEGER,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_fb_protocols_user_id ON fingerboard_protocols(user_id)"))

        # Phase O3: partner tagging on sessions.
        if "sessions" in tables and "partner" not in columns("sessions"):
            conn.execute(text("ALTER TABLE sessions ADD COLUMN partner VARCHAR(200)"))

        # Phase O3: beta notes on projects/routes.
        if "route_notes" not in tables:
            conn.execute(text("""
                CREATE TABLE route_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    route_id INTEGER NOT NULL REFERENCES routes(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    text TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_route_notes_route_id ON route_notes(route_id)"
            ))

        # Phase O2: reactions/"props" on feed events.
        if "reactions" not in tables:
            conn.execute(text("""
                CREATE TABLE reactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    feed_key VARCHAR(80) NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    emoji VARCHAR(8) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(feed_key, user_id, emoji)
                )
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_reactions_feed_key ON reactions(feed_key)"
            ))

        # Phase P1: gyms + walls (first-class indoor venues).
        if "gyms" not in tables:
            conn.execute(text("""
                CREATE TABLE gyms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    name VARCHAR(120) NOT NULL,
                    floorplan_filename VARCHAR(200),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_gyms_user_id ON gyms(user_id)"))
        if "walls" not in tables:
            conn.execute(text("""
                CREATE TABLE walls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gym_id INTEGER NOT NULL REFERENCES gyms(id),
                    name VARCHAR(120) NOT NULL,
                    angle INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_walls_gym_id ON walls(gym_id)"))
        # Session → gym link.
        if "sessions" in tables and "gym_id" not in columns("sessions"):
            conn.execute(text("ALTER TABLE sessions ADD COLUMN gym_id INTEGER REFERENCES gyms(id)"))

        # Phase P2: wall sets (reset generations) + tick → wall attribution.
        if "wall_sets" not in tables:
            conn.execute(text("""
                CREATE TABLE wall_sets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wall_id INTEGER NOT NULL REFERENCES walls(id),
                    label VARCHAR(120),
                    set_on DATE NOT NULL,
                    problem_count INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_wall_sets_wall_id ON wall_sets(wall_id)"))
        if "boulder_entries" in tables and "wall_id" not in columns("boulder_entries"):
            conn.execute(text("ALTER TABLE boulder_entries ADD COLUMN wall_id INTEGER REFERENCES walls(id)"))
        if "lead_route_entries" in tables and "wall_id" not in columns("lead_route_entries"):
            conn.execute(text("ALTER TABLE lead_route_entries ADD COLUMN wall_id INTEGER REFERENCES walls(id)"))

        # Phase P3a: hold/circuit colour on boulder ticks.
        if "boulder_entries" in tables and "hold_color" not in columns("boulder_entries"):
            conn.execute(text("ALTER TABLE boulder_entries ADD COLUMN hold_color VARCHAR(20)"))

        # Phase P3b: per-colour circuit totals within a set.
        if "set_circuits" not in tables:
            conn.execute(text("""
                CREATE TABLE set_circuits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wall_set_id INTEGER NOT NULL REFERENCES wall_sets(id),
                    color VARCHAR(20) NOT NULL,
                    total_count INTEGER,
                    label VARCHAR(60),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(wall_set_id, color)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_set_circuits_wall_set_id ON set_circuits(wall_set_id)"))

        # Buddy customisation: which animal fronts the climbing buddy.
        if "users" in tables and "buddy_species" not in columns("users"):
            conn.execute(text("ALTER TABLE users ADD COLUMN buddy_species VARCHAR(20)"))
            conn.execute(text("UPDATE users SET buddy_species = 'gecko' WHERE buddy_species IS NULL"))
