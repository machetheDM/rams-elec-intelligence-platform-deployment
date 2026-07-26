"""
API Key Authentication Middleware — Rams @Elec FastAPI Services
================================================================
Validates API keys for service-to-service communication.

API keys are hashed (SHA-256) before storage. The middleware
compares the hash of the provided key against stored hashes.

Configuration:
    APP_ENV         "development" (default) | "staging" | "production"
    API_KEY_HASHES  comma-separated SHA-256 hex digests of the accepted keys

    Required whenever APP_ENV is not "development" — the module raises at
    import if it is missing, or if it contains a hash of one of the
    development keys committed to this repository. See _load_valid_key_hashes.

Usage:
    from security.auth.api_key_middleware import APIKeyMiddleware

    app.add_middleware(APIKeyMiddleware)
"""

import os
import hashlib
import logging
from typing import Optional, TYPE_CHECKING

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from security.logging.security_logger import SecurityLogger

logger = logging.getLogger("security.api_key")

# ── Pre-configured API key hashes ──────────────────────────────────────
# Keys are hashed with SHA-256 — the raw key is NEVER stored.
#
# To generate a hash for a new key:
#   python -c "import secrets, hashlib; k = secrets.token_urlsafe(32); \
#              print(k, hashlib.sha256(k.encode()).hexdigest())"
#
# Configure via API_KEY_HASHES — a comma-separated list of SHA-256 hex digests.


def _hash_key(key: str) -> str:
    """Hash an API key with SHA-256."""
    return hashlib.sha256(key.encode()).hexdigest()


# ── Deployment environment ─────────────────────────────────────────────
# Only the literal string "development" is treated as a laptop. Everything
# else — including an unrecognised value, a typo, or an empty string that
# someone set deliberately — is treated as deployed and fails closed. An
# unknown environment must never be the permissive branch.
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_DEVELOPMENT = APP_ENV == "development"

# ── Known-compromised keys ─────────────────────────────────────────────
# These three strings are committed to this public repository — in this file's
# git history, in .env.example, in docker-compose.yml, in .github/workflows/ci.yml,
# and in every service's test_health.py. They exist so `docker compose up` works
# on a laptop with no setup.
#
# Because the plaintext is public, so are the hashes: anyone can compute them.
# They are not secrets and cannot be made into secrets by moving them into an
# environment variable. So they are rejected outright in a deployed environment,
# even when someone explicitly puts them in API_KEY_HASHES — which is exactly
# what would happen if a deployment copied .env.example forward.
DEV_ONLY_API_KEYS = (
    "rams-elec-frontend-2026",
    "rams-elec-airflow-2026",
    "rams-elec-n8n-2026",
)
COMPROMISED_KEY_HASHES = frozenset(_hash_key(k) for k in DEV_ONLY_API_KEYS)


def _load_valid_key_hashes() -> set[str]:
    """
    Resolve the accepted key hashes for this environment.

    Raises RuntimeError — at import, before the app can serve a single
    request — rather than starting a service that authenticates nobody or
    authenticates everybody. A service that refuses to boot is a visible
    failure; a service quietly accepting a published key is not.
    """
    raw = os.getenv("API_KEY_HASHES", "").strip()
    configured = {h.strip().lower() for h in raw.split(",") if h.strip()}

    if IS_DEVELOPMENT:
        if configured:
            return configured
        logger.warning(
            "APP_ENV=development and API_KEY_HASHES is unset — accepting the "
            "committed development keys. NEVER run this configuration on a "
            "public endpoint."
        )
        return set(COMPROMISED_KEY_HASHES)

    # Deployed: staging, production, or anything unrecognised.
    if not configured:
        raise RuntimeError(
            f"API_KEY_HASHES must be set when APP_ENV={APP_ENV!r}. Refusing to "
            "start: falling back to the committed development keys would leave "
            "this endpoint open to anyone who has read the repository. "
            "See .env.example for how to generate a key and its hash."
        )

    leaked = configured & COMPROMISED_KEY_HASHES
    if leaked:
        raise RuntimeError(
            f"API_KEY_HASHES contains {len(leaked)} hash(es) of API keys that are "
            f"committed to this repository, and APP_ENV={APP_ENV!r}. These keys are "
            "public. Refusing to start — rotate them before deploying."
        )

    return configured


VALID_API_KEY_HASHES: set[str] = _load_valid_key_hashes()

# Public endpoints that don't require API key
PUBLIC_ENDPOINTS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Validate API keys on incoming requests.

    Looks for the API key in:
      1. X-API-Key header (preferred)
      2. Authorization: Bearer <key> header
      3. api_key query parameter (least secure — only for dev)

    Skips validation for public endpoints and OPTIONS requests.
    """

    def __init__(self, app, security_logger: "Optional[SecurityLogger]" = None):
        super().__init__(app)
        self.security_logger = security_logger

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip for public endpoints and CORS preflight.
        # Services mount health checks under their own prefix
        # (e.g. /triage/health, /dispatch/health), not bare "/health",
        # so match on suffix — this is what Docker's HEALTHCHECK hits
        # unauthenticated on every service.
        if (
            request.url.path in PUBLIC_ENDPOINTS
            or request.url.path.endswith("/health")
            or request.method == "OPTIONS"
        ):
            return await call_next(request)

        for prefix in ["/docs", "/openapi.json", "/redoc"]:
            if request.url.path.startswith(prefix):
                return await call_next(request)

        # Extract API key
        api_key = None

        # 1. X-API-Key header (preferred)
        api_key = request.headers.get("X-API-Key")

        # 2. Authorization: Bearer <key>
        if not api_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header[7:]

        # 3. Query parameter (least secure)
        if not api_key:
            api_key = request.query_params.get("api_key")

        client_ip = request.client.host if request.client else "unknown"

        if not api_key:
            logger.warning(f"No API key for {request.method} {request.url.path}")
            if self.security_logger is not None:
                self.security_logger.log_auth_failure(
                    source_ip=client_ip, email="",
                    reason=f"No API key provided for {request.url.path}",
                )
            # Note: raising HTTPException here would NOT be converted to a
            # proper error response — Starlette's ExceptionMiddleware (which
            # does that conversion) sits *inside* user-added middleware like
            # this one, so the exception would propagate past it and surface
            # as an unhandled 500 instead of 401. Build the response directly.
            return JSONResponse(
                status_code=401,
                content={"detail": "API key required. Provide via X-API-Key header."},
            )

        # Validate key hash
        key_hash = _hash_key(api_key)
        if key_hash not in VALID_API_KEY_HASHES:
            logger.warning(f"Invalid API key for {request.method} {request.url.path}")
            if self.security_logger is not None:
                self.security_logger.log_auth_failure(
                    source_ip=client_ip, email="",
                    reason=f"Invalid API key for {request.url.path}",
                )
            return JSONResponse(status_code=401, content={"detail": "Invalid API key."})

        # Attach key info to request state
        request.state.api_key_authenticated = True
        request.state.api_key_hash = key_hash[:8]  # Truncated for logging

        if self.security_logger is not None:
            self.security_logger.log_api_key_usage(
                source_ip=client_ip, key_id=key_hash[:8], endpoint=request.url.path,
            )

        return await call_next(request)
