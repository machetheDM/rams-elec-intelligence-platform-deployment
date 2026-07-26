"""
AWS Lambda entry point for the sentiment service (Module 11).

Wraps the existing FastAPI app with Mangum rather than rewriting the endpoint as
a native Lambda handler. The point is that the request still passes through
`security/` on the way in — API key auth, rate limiting, security headers,
input validation, audit logging. A native handler would be less code and would
quietly drop every one of those.

  Function URL → Mangum → FastAPI middleware stack → /sentiment/analyze

ORDER OF OPERATIONS MATTERS HERE AND IS EASY TO GET WRONG.

`security/auth/api_key_middleware.py` resolves `VALID_API_KEY_HASHES` at *import*
time, from the environment. So configuration has to be in `os.environ` before
`main` is imported, not before the handler is invoked. That is why the import of
`main` sits at the bottom of this module, after `_load_ssm_config()`, instead of
at the top with the others — and why moving it back up would silently produce a
Lambda that raises on every request (APP_ENV set, API_KEY_HASHES not yet loaded).

The deferred import is deliberate. Do not "tidy" it.

PACKAGE LAYOUT — why `from main import app` resolves.

The deployment zip is FLAT, not a copy of the repo tree:

    lambda_handler.py     ← this file
    main.py               ← from services/sentiment/
    security/             ← from the repo root
    fastapi/ groq/ ...    ← dependencies

Lambda puts /var/task on sys.path, so both `main` and `security` are importable
from there. main.py's own `sys.path.insert(0, ".../../..")` becomes a harmless
no-op pointing outside the task root — it is not what makes `security` resolve,
and flattening is what keeps `from main import app` working. See
scripts/build_lambda.py.

boto3 is deliberately not vendored: the Lambda Python runtime already provides
it, and bundling a second copy adds ~15MB to a package for no benefit.
"""

import logging
import os

logger = logging.getLogger("sentiment.lambda")
logger.setLevel(logging.INFO)

# Path prefix in SSM Parameter Store holding this function's configuration,
# e.g. "/rams-elec/sentiment/". Each parameter's final path segment becomes an
# environment variable name, upper-cased: /rams-elec/sentiment/groq_api_key
# becomes GROQ_API_KEY.
#
# Unset locally and in tests, which is what makes this module importable without
# AWS, boto3, or credentials.
CONFIG_SSM_PATH = os.getenv("CONFIG_SSM_PATH", "").strip()


def _load_ssm_config() -> list[str]:
    """
    Copy SSM parameters under CONFIG_SSM_PATH into os.environ.

    Returns the names loaded, for logging. Values are never logged — the whole
    reason they are in Parameter Store as SecureString is that they should not
    appear in CloudWatch.

    SSM is authoritative and overwrites any existing environment variable of the
    same name. The alternative — letting a plain Lambda env var win — means an
    accidentally-set, console-visible, unencrypted value silently shadows the
    encrypted one, which is the failure you would least want to be silent.

    Failures here are deliberately NOT caught. If Parameter Store is unreachable
    or the role lacks ssm:GetParametersByPath, the function must fail to
    initialise. The alternative is booting with API_KEY_HASHES unset, and since
    APP_ENV is not "development" in Lambda, the middleware would then raise
    anyway — but with a confusing error about configuration rather than the real
    one about IAM. Fail on the actual cause.
    """
    if not CONFIG_SSM_PATH:
        return []

    import boto3  # imported lazily so local imports don't require it

    ssm = boto3.client("ssm")
    paginator = ssm.get_paginator("get_parameters_by_path")

    loaded: list[str] = []
    for page in paginator.paginate(
        Path=CONFIG_SSM_PATH, Recursive=True, WithDecryption=True
    ):
        for param in page["Parameters"]:
            name = param["Name"].rsplit("/", 1)[-1].upper()
            os.environ[name] = param["Value"]
            loaded.append(name)

    return loaded


_LOADED = _load_ssm_config()
if _LOADED:
    logger.info(
        "Loaded %d parameter(s) from %s: %s",
        len(_LOADED),
        CONFIG_SSM_PATH,
        ", ".join(sorted(_LOADED)),
    )
elif CONFIG_SSM_PATH:
    # An empty result is not a benign no-op: it means the path is wrong or the
    # parameters were never created, and the next thing to fail will be the API
    # key gate with a much less useful message.
    logger.warning(
        "No parameters found under %s — check the path and that they exist",
        CONFIG_SSM_PATH,
    )

# ── Deferred on purpose — see the module docstring ─────────────────────
from mangum import Mangum  # noqa: E402
from main import app  # noqa: E402

# lifespan="off": the app registers no startup/shutdown hooks, and Mangum's
# lifespan emulation would otherwise add a startup round trip to every cold
# start for nothing.
handler = Mangum(app, lifespan="off")
