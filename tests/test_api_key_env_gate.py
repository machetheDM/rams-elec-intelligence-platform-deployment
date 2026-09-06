"""
Environment gate on the API key middleware — Module 11 prerequisite.

Three API keys are committed to this repository so `docker compose up` works
with no setup. Before Module 11 puts a service behind a *public* AWS Lambda
Function URL, the middleware has to stop treating those keys as acceptable
anywhere that is not a laptop.

These tests exercise the import-time resolution in
`security/auth/api_key_middleware.py`, which is a module-level constant — so
each case re-imports the module under a different environment via
`importlib.reload`. The fixture reloads it one final time with a clean
environment so the reload does not leak into the service test suites, which
share the same interpreter and do rely on the development default.
"""

import hashlib
import importlib
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from security.auth import api_key_middleware  # noqa: E402


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# A key that exists only inside this test file, so its hash is not a published
# value the way the three committed development keys are.
ROTATED_KEY = "test-only-rotated-key-8f3a1c"
ROTATED_HASH = _sha256(ROTATED_KEY)

COMMITTED_DEV_KEY = "rams-elec-frontend-2026"


@pytest.fixture
def reload_middleware(monkeypatch):
    """Re-import the middleware under a given environment, then restore it."""

    def _reload(**env):
        for name in ("APP_ENV", "API_KEY_HASHES"):
            monkeypatch.delenv(name, raising=False)
        for name, value in env.items():
            monkeypatch.setenv(name, value)
        return importlib.reload(api_key_middleware)

    yield _reload

    # Undo the env changes *before* the final reload, or the module would be
    # restored under the test's environment rather than the real one.
    monkeypatch.undo()
    importlib.reload(api_key_middleware)


def _client_for(module) -> TestClient:
    """Minimal app carrying only the freshly reloaded API key middleware."""
    app = FastAPI()
    app.add_middleware(module.APIKeyMiddleware)

    @app.get("/probe/health")
    async def health():
        return {"status": "healthy"}

    @app.get("/probe/protected")
    async def protected():
        return {"ok": True}

    return TestClient(app)


# ── Development: unchanged behaviour ───────────────────────────────────


def test_development_without_config_accepts_the_committed_keys(reload_middleware):
    """The laptop path must keep working — every service test depends on it."""
    module = reload_middleware(APP_ENV="development")
    assert _sha256(COMMITTED_DEV_KEY) in module.VALID_API_KEY_HASHES


def test_development_is_the_default_when_app_env_is_unset(reload_middleware):
    module = reload_middleware()
    assert module.IS_DEVELOPMENT is True
    assert _sha256(COMMITTED_DEV_KEY) in module.VALID_API_KEY_HASHES


def test_development_without_config_warns(reload_middleware, caplog):
    """A silent insecure default is the bug class this repo keeps finding."""
    with caplog.at_level("WARNING", logger="security.api_key"):
        reload_middleware(APP_ENV="development")
    assert any("NEVER run this configuration" in r.message for r in caplog.records)


def test_explicit_config_overrides_the_default_even_in_development(reload_middleware):
    module = reload_middleware(APP_ENV="development", API_KEY_HASHES=ROTATED_HASH)
    assert module.VALID_API_KEY_HASHES == {ROTATED_HASH}
    assert _sha256(COMMITTED_DEV_KEY) not in module.VALID_API_KEY_HASHES


# ── Deployed: fail closed ──────────────────────────────────────────────


@pytest.mark.parametrize("app_env", ["production", "staging"])
def test_deployed_without_config_refuses_to_start(reload_middleware, app_env):
    with pytest.raises(RuntimeError, match="API_KEY_HASHES must be set"):
        reload_middleware(APP_ENV=app_env)


def test_unrecognised_environment_fails_closed(reload_middleware):
    """A typo must not silently select the permissive branch."""
    with pytest.raises(RuntimeError, match="API_KEY_HASHES must be set"):
        reload_middleware(APP_ENV="prodution")


def test_empty_app_env_fails_closed(reload_middleware):
    with pytest.raises(RuntimeError, match="API_KEY_HASHES must be set"):
        reload_middleware(APP_ENV="")


def test_deployed_rejects_the_committed_key_hashes(reload_middleware):
    """
    The hashes are public — anyone can compute them from the repository.
    Moving a published key into an environment variable does not make it a
    secret, so supplying one explicitly must still fail.
    """
    with pytest.raises(RuntimeError, match="committed to this repository"):
        reload_middleware(
            APP_ENV="production",
            API_KEY_HASHES=f"{ROTATED_HASH},{_sha256(COMMITTED_DEV_KEY)}",
        )


def test_deployed_with_rotated_keys_starts(reload_middleware):
    module = reload_middleware(APP_ENV="production", API_KEY_HASHES=ROTATED_HASH)
    assert module.VALID_API_KEY_HASHES == {ROTATED_HASH}
    assert module.IS_DEVELOPMENT is False


def test_hashes_are_normalised(reload_middleware):
    """Whitespace and upper-case hex from a copy-paste must still match."""
    module = reload_middleware(
        APP_ENV="production",
        API_KEY_HASHES=f"  {ROTATED_HASH.upper()} , , {ROTATED_HASH}  ",
    )
    assert module.VALID_API_KEY_HASHES == {ROTATED_HASH}


# ── End to end through the middleware ──────────────────────────────────


def test_deployed_middleware_rejects_the_committed_key(reload_middleware):
    """The behaviour Module 11 actually depends on: a public Function URL
    must not accept a key that is printed in this repository."""
    module = reload_middleware(APP_ENV="production", API_KEY_HASHES=ROTATED_HASH)
    client = _client_for(module)

    assert client.get("/probe/health").status_code == 200
    assert client.get("/probe/protected").status_code == 401
    assert (
        client.get(
            "/probe/protected", headers={"X-API-Key": COMMITTED_DEV_KEY}
        ).status_code
        == 401
    )
    assert (
        client.get("/probe/protected", headers={"X-API-Key": ROTATED_KEY}).status_code
        == 200
    )


def test_query_parameter_key_is_also_gated(reload_middleware):
    """The api_key query param is the least secure of the three accepted
    locations — it must obey the same allowlist."""
    module = reload_middleware(APP_ENV="production", API_KEY_HASHES=ROTATED_HASH)
    client = _client_for(module)

    assert (
        client.get(f"/probe/protected?api_key={COMMITTED_DEV_KEY}").status_code == 401
    )
    assert client.get(f"/probe/protected?api_key={ROTATED_KEY}").status_code == 200
