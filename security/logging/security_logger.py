"""
Security Audit Logger — Rams @Elec Platform
=============================================
Structured JSON security audit logging for all services.

Applies ECCU510 Secure Programming (CASE) logging and monitoring
requirements (OWASP A09).

Logs these security events:
  - Authentication attempts (success and failure)
  - API key usage
  - Rate limit hits
  - Input validation failures
  - Authorisation failures (403 responses)
  - Suspicious patterns (multiple failures from same IP)

Log format (JSON):
  {
    "timestamp": "ISO8601",
    "event_type": "AUTH_FAILURE",
    "severity": "HIGH",
    "source_ip": "x.x.x.x",
    "user_id": "if authenticated",
    "endpoint": "/api/endpoint",
    "details": "..."
  }

Outputs to:
  1. stdout (for SIEM ingestion via Docker logs)
  2. PostgreSQL security_audit_log table (for dashboard queries)

Usage:
    from security.logging.security_logger import SecurityLogger

    logger = SecurityLogger(engine)

    # Log an auth failure
    logger.log_auth_failure(
        source_ip="192.168.1.1",
        email="user@example.com",
        reason="Invalid password",
    )

    # Log an authorisation failure
    logger.log_authz_failure(
        source_ip="192.168.1.1",
        user_id="user-123",
        endpoint="/dispatch/assign",
        required_role="technician",
        actual_role="customer",
    )
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Optional

# NOTE: sqlalchemy is imported lazily inside _persist_to_db() rather than at
# module level. Every service constructs SecurityLogger(engine=None) and logs
# only to stdout, so requiring a database driver just to emit an audit line
# made this shared package unusable by services that have no database — the
# CrewAI service (services/crew) hits exactly that. `create_engine` was also
# imported here and never used.

# ── Structured JSON logging to stdout ──────────────────────────────────
# Configure root logger to output JSON for SIEM ingestion
_json_handler = logging.StreamHandler(sys.stdout)
_json_handler.setFormatter(
    logging.Formatter(
        '{"timestamp":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":%(message)s}',
        datefmt="%Y-%m-%dT%H:%M:%S.%fZ",
    )
)

_security_log = logging.getLogger("security.audit")
_security_log.setLevel(logging.INFO)
_security_log.addHandler(_json_handler)
_security_log.propagate = False  # Don't duplicate to root logger


class SecurityLogger:
    """
    Structured security audit logger.

    Logs to stdout (JSON) for SIEM ingestion AND to PostgreSQL
    for dashboard queries and compliance reporting.
    """

    def __init__(self, engine=None, service_name: str = "unknown"):
        self.engine = engine
        self.service_name = service_name

    def _emit(self, event_type: str, severity: str, **kwargs) -> None:
        """Emit a structured security log event."""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "severity": severity,
            "service": self.service_name,
            **kwargs,
        }

        # Log to stdout as JSON
        _security_log.info(json.dumps(log_entry, default=str))

        # Log to database if engine is available
        if self.engine:
            self._persist_to_db(log_entry)

    def _persist_to_db(self, log_entry: dict) -> None:
        """Persist log entry to PostgreSQL security_audit_log table."""
        # Imported here, not at module scope — see the note at the top of the
        # file. Only reachable when a caller passed a real engine, which
        # means sqlalchemy is necessarily installed.
        from sqlalchemy import text
        from sqlalchemy.exc import SQLAlchemyError

        try:
            with self.engine.begin() as conn:
                # Create table if not exists (idempotent)
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS security_audit_log (
                        id SERIAL PRIMARY KEY,
                        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        event_type VARCHAR(50) NOT NULL,
                        severity VARCHAR(10) NOT NULL,
                        service VARCHAR(50),
                        source_ip VARCHAR(45),
                        user_id VARCHAR(100),
                        endpoint VARCHAR(500),
                        details JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                # Create index for common queries
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_audit_event_type
                    ON security_audit_log (event_type, timestamp DESC)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_audit_source_ip
                    ON security_audit_log (source_ip, timestamp DESC)
                """))

                # Insert log entry
                conn.execute(
                    text("""
                        INSERT INTO security_audit_log
                            (timestamp, event_type, severity, service, source_ip, user_id, endpoint, details)
                        VALUES
                            (:ts, :et, :sev, :svc, :ip, :uid, :ep, :det)
                    """),
                    {
                        "ts": log_entry["timestamp"],
                        "et": log_entry["event_type"],
                        "sev": log_entry["severity"],
                        "svc": log_entry.get("service"),
                        "ip": log_entry.get("source_ip"),
                        "uid": log_entry.get("user_id"),
                        "ep": log_entry.get("endpoint"),
                        "det": json.dumps(log_entry.get("details", {})),
                    },
                )
        except SQLAlchemyError as e:
            _security_log.warning(f"Failed to persist audit log to DB: {e}")

    # ── Convenience methods for common security events ─────────────────

    def log_auth_success(self, source_ip: str, user_id: str, email: str) -> None:
        self._emit(
            "AUTH_SUCCESS", "INFO",
            source_ip=source_ip, user_id=user_id,
            details={"email": email},
        )

    def log_auth_failure(self, source_ip: str, email: str, reason: str) -> None:
        self._emit(
            "AUTH_FAILURE", "HIGH",
            source_ip=source_ip,
            details={"email": email, "reason": reason},
        )

    def log_authz_failure(
        self, source_ip: str, user_id: str, endpoint: str,
        required_role: str, actual_role: str,
    ) -> None:
        self._emit(
            "AUTHZ_FAILURE", "HIGH",
            source_ip=source_ip, user_id=user_id, endpoint=endpoint,
            details={"required_role": required_role, "actual_role": actual_role},
        )

    def log_rate_limit_hit(self, source_ip: str, endpoint: str, limit: int) -> None:
        self._emit(
            "RATE_LIMIT_HIT", "MEDIUM",
            source_ip=source_ip, endpoint=endpoint,
            details={"limit": limit},
        )

    def log_validation_failure(
        self, source_ip: str, endpoint: str, field: str, value: str, reason: str,
    ) -> None:
        self._emit(
            "VALIDATION_FAILURE", "LOW",
            source_ip=source_ip, endpoint=endpoint,
            details={"field": field, "value": value[:100], "reason": reason},
        )

    def log_suspicious_pattern(
        self, source_ip: str, pattern: str, count: int, window_seconds: int,
    ) -> None:
        self._emit(
            "SUSPICIOUS_PATTERN", "HIGH",
            source_ip=source_ip,
            details={
                "pattern": pattern,
                "count": count,
                "window_seconds": window_seconds,
            },
        )

    def log_api_key_usage(self, source_ip: str, key_id: str, endpoint: str) -> None:
        self._emit(
            "API_KEY_USAGE", "INFO",
            source_ip=source_ip, endpoint=endpoint,
            details={"key_id": key_id},
        )

    def log_token_revoked(self, source_ip: str, user_id: str, reason: str) -> None:
        self._emit(
            "TOKEN_REVOKED", "MEDIUM",
            source_ip=source_ip, user_id=user_id,
            details={"reason": reason},
        )


# ── Module-level convenience ───────────────────────────────────────────

# Create a default logger for services that don't need DB persistence
default_logger = SecurityLogger(engine=None, service_name="default")
