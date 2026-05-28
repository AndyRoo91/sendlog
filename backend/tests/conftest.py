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
        yield c

    main.app.dependency_overrides.clear()
