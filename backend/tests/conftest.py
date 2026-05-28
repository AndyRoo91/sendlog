import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import database  # noqa: E402
import main  # noqa: E402
import models  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Fresh in-memory SQLite + temp photos dir per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # Lifespan runs run_migrations() + create_all on database.engine — point it
    # at the in-memory engine so the app's own startup wires up our test DB.
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", TestSession)
    monkeypatch.setattr(main, "engine", engine)  # lifespan create_all uses this

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[database.get_db] = override_get_db
    monkeypatch.setattr(main, "PHOTOS_DIR", tmp_path / "photos")
    (tmp_path / "photos").mkdir()

    with TestClient(main.app) as c:
        # Auto-register + log in a default test user so the legacy single-user
        # tests keep working without touching every call site. The cookie is
        # set on the client by FastAPI, so subsequent requests are auth'd.
        r = c.post("/api/auth/register", json={"username": "tester", "password": "testtest"})
        assert r.status_code in (201, 409), r.text
        if r.status_code == 409:
            c.post("/api/auth/login", json={"username": "tester", "password": "testtest"})
        yield c

    main.app.dependency_overrides.clear()


@pytest.fixture
def second_client(client, tmp_path, monkeypatch):
    """An *additional* logged-in TestClient sharing the same in-memory DB but
    a separate user — for cross-user isolation tests."""
    # Reuse the engine that the `client` fixture wired up via override_get_db.
    c = TestClient(main.app)
    r = c.post("/api/auth/register", json={"username": "other", "password": "othersecret"})
    assert r.status_code == 201, r.text
    yield c
