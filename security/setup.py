"""
Security Setup — Apply all security middleware to a FastAPI app
================================================================
Single import to harden any FastAPI service with defence-in-depth.

This is the primary entry point for security hardening. Instead of
manually adding each middleware, services call this one function.

MIDDLEWARE EXECUTION ORDER (outermost → innermost):
  1. CORS          — Reject requests from unknown origins (first line of defence)
  2. Rate Limiter  — Throttle excessive requests before they hit auth
  3. API Key Auth  — Verify service-to-service identity
  4. JWT Auth      — Verify user identity + attach roles
  5. Security Headers — Add headers to all responses (innermost, runs last)

Why this order matters:
  - CORS runs first: reject cross-origin requests before any processing
  - Rate limiter runs before auth: prevent brute-force attacks on login
  - API key before JWT: service identity checked before user identity
  - Headers run last: ensure all responses (including errors) have security headers

Usage:
    from security.setup import apply_security_middleware

    app = FastAPI()
    apply_security_middleware(
        app,
        enable_auth=True,       # Require JWT for user endpoints
        enable_api_key=True,    # Require API key for service-to-service
        cors_origins=["https://ramsatelec.co.za", "http://localhost:3000"],
        rate_limit=100,         # 100 requests per minute per IP
        rate_window=60,
    )
"""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from security.headers.security_headers import SecurityHeadersMiddleware
from security.auth.rate_limiter import RateLimiterMiddleware
from security.auth.jwt_middleware import JWTAuthMiddleware
from security.auth.api_key_middleware import APIKeyMiddleware
from security.logging.security_logger import SecurityLogger


def apply_security_middleware(
    app: FastAPI,
    enable_auth: bool = False,
    enable_api_key: bool = False,
    cors_origins: list[str] | None = None,
    rate_limit: int = 100,
    rate_window: int = 60,
    security_logger: SecurityLogger | None = None,
) -> None:
    """
    Apply all security middleware to a FastAPI application.

    This function replaces the insecure CORS wildcard pattern:
        app.add_middleware(CORSMiddleware, allow_origins=["*"])  # ❌ INSECURE

    With a layered defence-in-depth approach:
        CORS → Rate Limiter → API Key → JWT → Security Headers  # ✅ SECURE

    Parameters
    ----------
    app : FastAPI
        The FastAPI application instance to harden.
    enable_auth : bool
        If True, enable JWT authentication middleware.
        Use for services with user-facing endpoints (triage, dispatch).
    enable_api_key : bool
        If True, enable API key authentication middleware.
        Use for all services to verify service-to-service calls.
    cors_origins : list[str] | None
        Allowed CORS origins. Defaults to localhost:3000 only.
        In production, set to your actual frontend domain.
    rate_limit : int
        Maximum requests per IP address within the rate window.
        Default: 100 (suitable for most API endpoints).
    rate_window : int
        Rate limit window in seconds. Default: 60 (1 minute).
    security_logger : SecurityLogger | None
        When provided, wired into every middleware below so auth failures,
        rate-limit hits, API key usage, and input validation failures all
        emit real audit events instead of only a local log line. Pass the
        service's own `SecurityLogger(engine=None, service_name="...")`
        instance — constructed before this call.
    """
    # Default to localhost for development — override in production
    if cors_origins is None:
        cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ── Step 1: Remove any existing CORS middleware ─────────────────
    # This is critical: many services start with allow_origins=["*"]
    # which we must replace with specific origins.
    app.user_middleware = [
        m for m in app.user_middleware
        if m.cls != CORSMiddleware
    ]

    # ── Step 2: Add CORS with specific origins ──────────────────────
    # Only allow known frontend origins + specific HTTP methods.
    # X-API-Key header is required for service-to-service auth.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    # ── Step 3: Security headers on all responses ───────────────────
    # CSP, X-Frame-Options, HSTS, etc. — see security_headers.py
    app.add_middleware(SecurityHeadersMiddleware)

    # ── Step 4: Rate limiting per IP ────────────────────────────────
    # Prevents brute-force, DoS, and API abuse.
    # Uses in-memory sliding window (Redis in production).
    app.add_middleware(
        RateLimiterMiddleware,
        max_requests=rate_limit,
        window_seconds=rate_window,
        security_logger=security_logger,
    )

    # ── Step 5: API key authentication (optional) ───────────────────
    # Verifies service-to-service calls using SHA-256 hashed keys.
    # Enable for all services that receive internal API calls.
    if enable_api_key:
        app.add_middleware(APIKeyMiddleware, security_logger=security_logger)

    # ── Step 6: JWT authentication (optional) ───────────────────────
    # Verifies user identity and attaches role to request.state.
    # Enable for services with user-facing endpoints.
    if enable_auth:
        app.add_middleware(JWTAuthMiddleware, security_logger=security_logger)

    # ── Step 7: Audit-log every input validation failure ────────────
    # Pydantic validators (security/input_validation/validators.py) reject
    # malformed input via ValueError, which FastAPI surfaces as a
    # RequestValidationError. A burst of these from one IP is a probing
    # signal worth an audit trail, not just a silent 422.
    if security_logger is not None:
        _register_validation_failure_handler(app, security_logger)


def _register_validation_failure_handler(app: FastAPI, security_logger: SecurityLogger) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request: Request, exc: RequestValidationError):
        client_ip = request.client.host if request.client else "unknown"
        for error in exc.errors():
            field = ".".join(str(p) for p in error.get("loc", []) if p != "body")
            security_logger.log_validation_failure(
                source_ip=client_ip,
                endpoint=str(request.url.path),
                field=field or "unknown",
                value=str(error.get("input", ""))[:100],
                reason=error.get("msg", "validation error"),
            )
        # exc.errors() can contain raw exception objects (in ctx.error) from
        # our ValueError-raising validators — jsonable_encoder is required
        # here, the same way FastAPI's own default handler does it, or
        # JSONResponse's json.dumps() raises trying to serialize them.
        return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})
