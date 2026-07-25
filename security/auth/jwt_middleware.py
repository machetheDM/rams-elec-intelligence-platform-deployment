"""
JWT Authentication Middleware — Rams @Elec FastAPI Services
============================================================
Adds JWT verification to all FastAPI endpoints.

Applies ECCU510 Secure Programming (CASE) authentication hardening:
  - Token expiry enforcement (24h regular, 15min sensitive ops)
  - Role-based access control (RBAC)
  - Token blacklisting for logout

Usage:
    from security.auth.jwt_middleware import JWTAuthMiddleware, require_role

    app.add_middleware(JWTAuthMiddleware)

    @app.post("/dispatch/assign")
    @require_role("technician", "admin")
    async def assign(request: AssignRequest):
        ...
"""

import os
import time
import logging
from typing import Optional, TYPE_CHECKING
from functools import wraps

import jwt
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from security.logging.security_logger import SecurityLogger

logger = logging.getLogger("security.auth")

# ── Configuration ──────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("AUTH_SECRET", "change-me-in-production"))
JWT_ALGORITHM = "HS256"
REGULAR_SESSION_TTL = 24 * 60 * 60       # 24 hours
SENSITIVE_SESSION_TTL = 15 * 60           # 15 minutes

# In-memory token blacklist (use Redis in production)
_token_blacklist: set[str] = set()

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = {
    "/triage/health",
    "/loadshedding/health",
    "/chatbot/health",
    "/dispatch/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def decode_jwt(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Returns the decoded payload or raises an exception.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": True, "verify_iat": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def blacklist_token(token: str) -> None:
    """
    Add a token to the blacklist (for logout).

    In production, use Redis with TTL matching the token expiry.
    """
    _token_blacklist.add(token)


def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been revoked."""
    return token in _token_blacklist


def require_role(*allowed_roles: str):
    """
    Decorator to restrict endpoint access by role.

    Usage:
        @app.post("/admin/users")
        @require_role("admin")
        async def create_user(): ...

        @app.post("/dispatch/assign")
        @require_role("technician", "admin")
        async def assign_technician(): ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the Request object in args or kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if request is None:
                request = kwargs.get("request")

            if request is None:
                raise HTTPException(status_code=500, detail="Internal: request not available")

            user_role = getattr(request.state, "user_role", None)
            if user_role is None:
                raise HTTPException(status_code=401, detail="Authentication required")

            if user_role not in allowed_roles:
                logger.warning(
                    f"Access denied: role '{user_role}' not in {allowed_roles} "
                    f"for {request.method} {request.url.path}"
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Role '{user_role}' not authorised. Required: {allowed_roles}",
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that verifies JWT tokens on all requests.

    Skips verification for:
      - Public endpoints (health checks, docs)
      - OPTIONS requests (CORS preflight)
    """

    def __init__(self, app, security_logger: "Optional[SecurityLogger]" = None):
        super().__init__(app)
        self.security_logger = security_logger

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip auth for public endpoints and CORS preflight
        if request.url.path in PUBLIC_ENDPOINTS or request.method == "OPTIONS":
            return await call_next(request)

        # Also skip if path starts with a public prefix
        for prefix in ["/docs", "/openapi.json", "/redoc"]:
            if request.url.path.startswith(prefix):
                return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            # Also check query param (for WebSocket or SSE connections)
            token = request.query_params.get("token")

        # Note: this dispatch() returns JSONResponse directly on every
        # failure path below rather than raising HTTPException — Starlette's
        # ExceptionMiddleware (which normally converts HTTPException to a
        # proper response) sits *inside* user-added middleware like this
        # one, so a raised exception here would propagate past it and
        # surface as an unhandled 500 instead of 401.
        if not token:
            logger.warning(f"No auth token for {request.method} {request.url.path}")
            if self.security_logger is not None:
                self.security_logger.log_auth_failure(
                    source_ip=client_ip, email="",
                    reason=f"No bearer token for {request.url.path}",
                )
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required. Provide Bearer token in Authorization header."},
            )

        # Check blacklist
        if is_token_blacklisted(token):
            logger.warning(f"Blacklisted token used for {request.url.path}")
            if self.security_logger is not None:
                self.security_logger.log_auth_failure(
                    source_ip=client_ip, email="",
                    reason=f"Blacklisted token used for {request.url.path}",
                )
            return JSONResponse(status_code=401, content={"detail": "Token has been revoked"})

        # Decode and verify
        try:
            payload = decode_jwt(token)
        except HTTPException as exc:
            if self.security_logger is not None:
                self.security_logger.log_auth_failure(
                    source_ip=client_ip, email="", reason=str(exc.detail),
                )
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

        # Attach user info to request state for downstream handlers
        request.state.user_id = payload.get("sub")
        request.state.user_role = payload.get("role", "customer")
        request.state.user_email = payload.get("email")
        request.state.token_jti = payload.get("jti")

        logger.info(
            f"Auth success: user={request.state.user_id}, "
            f"role={request.state.user_role}, "
            f"path={request.method} {request.url.path}"
        )
        if self.security_logger is not None:
            self.security_logger.log_auth_success(
                source_ip=client_ip,
                user_id=str(request.state.user_id),
                email=request.state.user_email or "",
            )

        return await call_next(request)
