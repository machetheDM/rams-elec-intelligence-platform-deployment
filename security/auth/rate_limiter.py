"""
Rate Limiting Middleware — Rams @Elec FastAPI Services
=======================================================
Simple in-memory rate limiter per IP address.

In production, replace with Redis-based rate limiter for
distributed rate limiting across multiple service instances.

Usage:
    from security.auth.rate_limiter import RateLimiterMiddleware

    app.add_middleware(RateLimiterMiddleware, max_requests=100, window_seconds=60)
"""

import time
import logging
from collections import defaultdict
from typing import Optional, TYPE_CHECKING

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from security.logging.security_logger import SecurityLogger

logger = logging.getLogger("security.rate_limiter")


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding window rate limiter.

    Tracks request counts per IP address within a time window.
    Returns 429 Too Many Requests when the limit is exceeded.
    """

    def __init__(
        self,
        app,
        max_requests: int = 100,
        window_seconds: int = 60,
        exempt_paths: Optional[list[str]] = None,
        security_logger: "Optional[SecurityLogger]" = None,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exempt_paths = exempt_paths or ["/health", "/docs", "/openapi.json", "/redoc"]
        self.security_logger = security_logger
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting X-Forwarded-For header."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup_old_entries(self) -> None:
        """Remove expired entries to prevent memory leaks."""
        now = time.time()
        cutoff = now - self.window_seconds
        expired_ips = [
            ip for ip, timestamps in self._requests.items()
            if not timestamps or timestamps[-1] < cutoff
        ]
        for ip in expired_ips:
            del self._requests[ip]

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for exempt paths. Services mount health checks
        # under their own prefix (/triage/health, /dispatch/health, ...),
        # not bare "/health", so that one entry is matched by suffix —
        # otherwise Docker's HEALTHCHECK could eventually get rate-limited.
        path = request.url.path
        for exempt in self.exempt_paths:
            if exempt == "/health":
                if path.endswith("/health"):
                    return await call_next(request)
            elif path.startswith(exempt):
                return await call_next(request)

        client_ip = self._get_client_ip(request)
        now = time.time()
        cutoff = now - self.window_seconds

        # Get or create request history for this IP
        timestamps = self._requests[client_ip]

        # Remove expired timestamps
        self._requests[client_ip] = [t for t in timestamps if t > cutoff]

        # Check limit
        if len(self._requests[client_ip]) >= self.max_requests:
            retry_after = int(self._requests[client_ip][0] + self.window_seconds - now) + 1
            logger.warning(
                f"Rate limit hit: IP={client_ip}, "
                f"path={request.url.path}, "
                f"count={len(self._requests[client_ip])}/{self.max_requests}"
            )
            if self.security_logger is not None:
                self.security_logger.log_rate_limit_hit(
                    source_ip=client_ip,
                    endpoint=request.url.path,
                    limit=self.max_requests,
                )
            # Note: raising HTTPException here would NOT be converted to a
            # proper error response — Starlette's ExceptionMiddleware (which
            # does that conversion) sits *inside* user-added middleware like
            # this one, so the exception would propagate past it and surface
            # as an unhandled 500 instead of 429. Build the response directly.
            return JSONResponse(
                status_code=429,
                content={"detail": f"Too many requests. Retry after {retry_after} seconds."},
                headers={"Retry-After": str(retry_after)},
            )

        # Record this request
        self._requests[client_ip].append(now)

        # Periodic cleanup (every 1000 requests)
        if sum(len(v) for v in self._requests.values()) % 1000 == 0:
            self._cleanup_old_entries()

        return await call_next(request)
