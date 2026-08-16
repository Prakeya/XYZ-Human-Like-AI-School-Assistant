"""
Shared fixtures for the E2E suite.

Key design points:
  - DATABASE_URL / AI_PROVIDER / AI_API_KEY are set BEFORE `app.*` is imported
    anywhere, because those modules read them as module-level constants at
    import time (see app/database.py, app/ai_provider.py). Getting the order
    wrong silently makes tests run against the real dev DB or a real LLM.
  - The test DB is a throwaway SQLite file in pytest's tmp dir -- never the
    project's own xyz_ai.db -- so running this suite can never corrupt or
    depend on your local dev data.
  - AI_PROVIDER is forced to "demo" so the suite exercises the deterministic
    rule-based NLU (app/intent_engine.py) regardless of what's in your local
    .env. This is intentional and matches how the demo-mode requirement in
    the spec is meant to be validated -- it is NOT a workaround for a broken
    Anthropic-provider path.
"""
import os
import sys
from pathlib import Path

# Make `import app...` resolve to backend/app regardless of how pytest is
# invoked (`pytest`, `python -m pytest`, from a different cwd, etc).
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def app_env(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("xyz_ai_test_db") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["AI_PROVIDER"] = "demo"
    os.environ["AI_API_KEY"] = ""
    os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-do-not-use-in-prod")
    return os.environ


@pytest.fixture(scope="session")
def app_modules(app_env):
    """Import the app package only after app_env has set the env vars above."""
    from app import main, models, translations, permissions  # noqa: F401
    return main, models, translations, permissions


@pytest.fixture(scope="session")
def client(app_modules):
    main, _, _, _ = app_modules
    from fastapi.testclient import TestClient
    # Using TestClient as a context manager triggers FastAPI's startup event,
    # which is what actually runs Base.metadata.create_all(...) + seed_data.seed(...).
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def db_session(app_modules):
    """A raw DB session for asserting on rows directly (e.g. support_requests)."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
