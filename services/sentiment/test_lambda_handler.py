"""
Tests for the Lambda entry point (Module 11).

Two things are worth testing here and neither is the business logic — that is
already covered by test_health.py and is unchanged by deployment target:

  1. The SSM config loader, because it runs before `main` is imported and a
     mistake in it surfaces as a confusing failure somewhere else entirely.
  2. That a Function URL event actually traverses the security middleware. The
     reason for using Mangum instead of a native handler is that requests keep
     going through `security/`; a test that proves it is the difference between
     that being true and being an intention.

No AWS, no boto3, no credentials: CONFIG_SSM_PATH is unset here, which is the
branch that makes the module importable off Lambda.
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest

_SERVICE_DIR = Path(__file__).resolve().parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))

_spec = importlib.util.spec_from_file_location(
    "sentiment_lambda_handler", _SERVICE_DIR / "lambda_handler.py"
)
_lambda_handler = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_lambda_handler)


def _function_url_event(method: str, path: str, headers: dict | None = None) -> dict:
    """A Lambda Function URL invocation — payload format 2.0."""
    return {
        "version": "2.0",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "example.lambda-url.eu-west-1.on.aws", **(headers or {})},
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "203.0.113.7",
                "userAgent": "pytest",
            },
            "requestId": "test-request-id",
            "stage": "$default",
            "timeEpoch": 0,
        },
        "isBase64Encoded": False,
    }


class _Context:
    """Stand-in for the Lambda context object Mangum puts on the ASGI scope."""

    function_name = "rams-elec-sentiment"
    memory_limit_in_mb = 512
    invoked_function_arn = "arn:aws:lambda:eu-west-1:000000000000:function:test"
    aws_request_id = "test-request-id"

    def get_remaining_time_in_millis(self) -> int:
        return 30000


# ── SSM configuration loader ───────────────────────────────────────────


def test_no_ssm_path_is_a_no_op(monkeypatch):
    """The branch that lets this module be imported without AWS."""
    monkeypatch.setattr(_lambda_handler, "CONFIG_SSM_PATH", "")
    assert _lambda_handler._load_ssm_config() == []


def test_ssm_parameters_become_environment_variables(monkeypatch):
    monkeypatch.setattr(_lambda_handler, "CONFIG_SSM_PATH", "/rams-elec/sentiment/")
    monkeypatch.setitem(
        sys.modules,
        "boto3",
        _fake_boto3(
            [
                {"Name": "/rams-elec/sentiment/groq_api_key", "Value": "gsk_test"},
                {"Name": "/rams-elec/sentiment/api_key_hashes", "Value": "abc123"},
            ]
        ),
    )
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("API_KEY_HASHES", raising=False)

    loaded = _lambda_handler._load_ssm_config()

    assert sorted(loaded) == ["API_KEY_HASHES", "GROQ_API_KEY"]
    import os

    assert os.environ["GROQ_API_KEY"] == "gsk_test"
    assert os.environ["API_KEY_HASHES"] == "abc123"


def test_ssm_overwrites_an_existing_environment_variable(monkeypatch):
    """
    An unencrypted, console-visible Lambda env var must not silently shadow the
    SecureString it was meant to replace.
    """
    monkeypatch.setattr(_lambda_handler, "CONFIG_SSM_PATH", "/rams-elec/sentiment/")
    monkeypatch.setitem(
        sys.modules,
        "boto3",
        _fake_boto3(
            [{"Name": "/rams-elec/sentiment/api_key_hashes", "Value": "fromssm"}]
        ),
    )
    monkeypatch.setenv("API_KEY_HASHES", "stale-plaintext-value")

    _lambda_handler._load_ssm_config()

    import os

    assert os.environ["API_KEY_HASHES"] == "fromssm"


def test_ssm_failure_propagates(monkeypatch):
    """
    A function that cannot read its own configuration must fail to initialise,
    reporting the real cause. Swallowing this produces a later, misleading
    failure in the API key gate about configuration rather than about IAM.
    """
    monkeypatch.setattr(_lambda_handler, "CONFIG_SSM_PATH", "/rams-elec/sentiment/")

    def _explode():
        raise RuntimeError("AccessDeniedException: ssm:GetParametersByPath")

    monkeypatch.setitem(sys.modules, "boto3", _fake_boto3(None, on_call=_explode))

    with pytest.raises(RuntimeError, match="AccessDeniedException"):
        _lambda_handler._load_ssm_config()


def _fake_boto3(parameters, on_call=None):
    """Minimal boto3 stand-in exposing client('ssm').get_paginator(...)."""

    class _Paginator:
        def paginate(self, **_kwargs):
            if on_call is not None:
                on_call()
            return [{"Parameters": parameters}]

    class _Client:
        def get_paginator(self, _name):
            return _Paginator()

    module = types.ModuleType("boto3")
    module.client = lambda _service: _Client()
    return module


# ── Function URL events traverse the security middleware ───────────────


def test_health_is_reachable_without_an_api_key():
    response = _lambda_handler.handler(
        _function_url_event("GET", "/sentiment/health"), _Context()
    )
    assert response["statusCode"] == 200


def test_analyze_without_an_api_key_is_rejected():
    """
    The whole reason for Mangum over a native handler: a Function URL is public,
    and the request still has to pass the API key gate.
    """
    event = _function_url_event("POST", "/sentiment/analyze")
    event["headers"]["content-type"] = "application/json"
    event["body"] = '{"comment_text": "Great service"}'

    response = _lambda_handler.handler(event, _Context())

    assert response["statusCode"] == 401


def test_security_headers_are_present_on_lambda_responses():
    """SecurityHeadersMiddleware is innermost, so it must reach the Function URL
    response too — not just the uvicorn one."""
    response = _lambda_handler.handler(
        _function_url_event("GET", "/sentiment/health"), _Context()
    )
    headers = {k.lower(): v for k, v in response["headers"].items()}
    assert headers.get("x-frame-options") == "DENY"
    assert "content-security-policy" in headers
