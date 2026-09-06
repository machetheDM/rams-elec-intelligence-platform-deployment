"""Tests for the follow-up trigger Lambda (Module 11 Phase 1).

The behaviour worth pinning down is the transactional one: a webhook failure
must leave NO follow_ups row, because the selection query excludes any job that
already has one. If a failed dispatch committed a row, that customer would be
permanently removed from consideration and never contacted — the bug this
function was written to fix, and the repo's recurring silent-no-op class.

No AWS and no database. SSM and the engine are injected through the handler's
module-level caches, which is what those globals are for.
"""

import importlib.util
import os
import sys
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Loaded by explicit path: the lambda/ tree is not a package, and `lambda` is a
# Python keyword so it could never be imported as one.
HANDLER_PATH = (
    Path(__file__).resolve().parents[1] / "lambda" / "followup_trigger" / "handler.py"
)

sqlalchemy = pytest.importorskip("sqlalchemy", reason="SQLAlchemy not installed")


def _load_handler():
    spec = importlib.util.spec_from_file_location("followup_handler", HANDLER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["followup_handler"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def handler(monkeypatch):
    monkeypatch.setenv("SSM_PARAM_PREFIX", "/rams-elec/test")
    mod = _load_handler()
    # Pre-populate the cold-start caches so nothing reaches for boto3.
    mod._webhook_base = "https://n8n.invalid"
    yield mod
    mod._engine = None
    mod._webhook_base = None


DUE_JOB = {
    "job_id": "job_abc",
    "customer_id": "cus_abc",
    "equipment_id": None,
    "urgency": "emergency",
    "service_name": "Cold room repair",
    "customer_name": "Test Customer",
    "customer_whatsapp": "+27835550000",
    "days_since_completion": 4,
    "completed_date": "2026-07-26T08:00:00",
}


class FakeConn:
    """Minimal SQLAlchemy connection double that records inserts."""

    def __init__(self, recorder):
        self.recorder = recorder

    def execute(self, statement, params=None):
        self.recorder.append(params)
        result = MagicMock()
        result.fetchone.return_value = MagicMock(id="fu_generated")
        return result


class FakeTransaction:
    """Mimics engine.begin(): rolls back by discarding recorded work on error."""

    def __init__(self, engine):
        self.engine = engine

    def __enter__(self):
        self.engine.pending = []
        return FakeConn(self.engine.pending)

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.engine.committed.extend(self.engine.pending)
        else:
            self.engine.rolled_back.extend(self.engine.pending)
        self.engine.pending = []
        return False  # never swallow — the handler catches what it means to


class FakeEngine:
    def __init__(self):
        self.committed = []
        self.rolled_back = []
        self.pending = []

    def begin(self):
        return FakeTransaction(self)


def test_successful_dispatch_commits_the_row(handler, monkeypatch):
    engine = FakeEngine()
    monkeypatch.setattr(handler, "_post_webhook", lambda url, payload: None)

    ok = handler._process_job(engine, DUE_JOB, "https://n8n.invalid/webhook/x")

    assert ok is True
    assert len(engine.committed) == 1
    assert engine.committed[0]["job_id"] == "job_abc"
    assert engine.rolled_back == []


def test_webhook_failure_rolls_the_row_back(handler, monkeypatch):
    """The whole point: a failed dispatch must not leave a row behind."""
    engine = FakeEngine()

    def boom(url, payload):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(handler, "_post_webhook", boom)

    ok = handler._process_job(engine, DUE_JOB, "https://n8n.invalid/webhook/x")

    assert ok is False
    assert engine.committed == [], "a failed dispatch must leave no follow_ups row"
    assert len(engine.rolled_back) == 1


def test_partial_failure_is_reported_not_raised(handler, monkeypatch):
    """One bad webhook must not abort the run or trigger a re-messaging retry."""
    engine = FakeEngine()
    monkeypatch.setattr(handler, "_get_engine", lambda: engine)
    monkeypatch.setattr(handler, "_get_webhook_base", lambda: "https://n8n.invalid")
    monkeypatch.setattr(
        handler,
        "_find_due_jobs",
        lambda _engine: [DUE_JOB, {**DUE_JOB, "job_id": "job_def"}],
    )

    calls = {"n": 0}

    def flaky(url, payload):
        calls["n"] += 1
        if calls["n"] == 1:
            raise urllib.error.URLError("first one fails")

    monkeypatch.setattr(handler, "_post_webhook", flaky)

    result = handler.lambda_handler({}, None)

    assert result == {"due": 2, "dispatched": 1, "failed": 1}
    assert len(engine.committed) == 1
    assert len(engine.rolled_back) == 1


def test_no_due_jobs_is_a_clean_noop(handler, monkeypatch):
    engine = FakeEngine()
    monkeypatch.setattr(handler, "_get_engine", lambda: engine)
    monkeypatch.setattr(handler, "_get_webhook_base", lambda: "https://n8n.invalid")
    monkeypatch.setattr(handler, "_find_due_jobs", lambda _engine: [])

    assert handler.lambda_handler({}, None) == {
        "due": 0,
        "dispatched": 0,
        "failed": 0,
    }


def test_thresholds_match_the_dag_they_replace(handler):
    """These drive a POPIA-adjacent customer contact; drift would be silent."""
    assert handler.URGENT_THRESHOLD_DAYS == 3
    assert handler.STANDARD_THRESHOLD_DAYS == 7


def test_consent_and_lowercase_status_survive_in_the_sql(handler):
    """The consent filter is the security control — assert it is still there.

    Job.status is lowercase; 'Complete' would match zero rows and report
    success, which has already happened once in this repo.
    """
    sql = str(handler.DUE_JOBS_SQL)
    assert "c.follow_up_consent = true" in sql
    assert "j.status = 'complete'" in sql
    assert "NOT EXISTS" in sql
    assert "make_interval" in sql


def test_database_url_is_rewritten_for_pg8000(handler, monkeypatch):
    """A URL copied from .env must not send SQLAlchemy looking for psycopg2."""
    captured = {}

    monkeypatch.setattr(
        handler,
        "_get_parameter",
        lambda name: "postgresql://u:p@host:5432/db",
    )
    monkeypatch.setattr(
        handler,
        "create_engine",
        lambda url, **kw: captured.setdefault("url", url),
    )
    handler._engine = None

    handler._get_engine()

    assert captured["url"].startswith("postgresql+pg8000://")


def test_secrets_are_not_read_from_environment(handler, monkeypatch):
    """Only the parameter PATH may come from the environment.

    Lambda environment variables are returned in plaintext by
    lambda:GetFunction, so a DATABASE_URL there would be readable by anyone with
    read-only Lambda access.
    """
    source = HANDLER_PATH.read_text(encoding="utf-8")
    for forbidden in ("DATABASE_URL", "N8N_WEBHOOK_URL"):
        assert f'os.environ.get("{forbidden}"' not in source
        assert f'os.getenv("{forbidden}"' not in source
    assert 'os.environ.get("SSM_PARAM_PREFIX"' in source
