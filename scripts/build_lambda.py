"""
Rams @Elec — Build the sentiment service Lambda deployment package (Module 11)

Run: py -3.14 scripts/build_lambda.py
Output: dist/sentiment-lambda.zip

WHY THIS SCRIPT EXISTS RATHER THAN `pip install -t . && zip`
-----------------------------------------------------------
Two problems it solves, both of which fail at runtime rather than at build time
if you get them wrong.

1. WHEEL PLATFORM. The dev machine is Windows; Lambda is Linux. `pip install -t`
   here resolves win_amd64 wheels for anything with compiled extensions —
   pydantic-core above all — and the function then fails on first invocation
   with a ModuleNotFoundError for `pydantic_core._pydantic_core`. The build
   therefore pins --platform/--only-binary explicitly, so a package with no
   Linux wheel fails the BUILD instead of the deploy.

2. LAYOUT. The zip is flat: main.py, lambda_handler.py and security/ all sit at
   the root, because Lambda puts /var/task on sys.path and that is what makes
   both `from main import app` and `from security.setup import ...` resolve.
   Copying the repo tree verbatim would break both.
   See services/sentiment/lambda_handler.py for the full explanation.

boto3 is excluded — the Lambda runtime provides it, and vendoring a second copy
adds roughly 15MB for nothing.
"""

import argparse
import compileall
import hashlib
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SERVICE_DIR = REPO_ROOT / "services" / "sentiment"
SECURITY_DIR = REPO_ROOT / "security"
BUILD_DIR = REPO_ROOT / "dist" / "lambda-build"
OUTPUT_ZIP = REPO_ROOT / "dist" / "sentiment-lambda.zip"

# Must match the Lambda runtime in terraform/aws/lambda.tf. A mismatch here
# produces wheels for the wrong Python and an import error at cold start.
PYTHON_VERSION = "3.12"
PLATFORM = "manylinux2014_x86_64"

# Excluded, for two different reasons — every megabyte is cold-start latency.
RUNTIME_PROVIDED = ("boto3", "botocore")
# Not needed under Lambda at all: Mangum replaces the ASGI server, and the test
# runner has no business in a deployment artifact.
NOT_NEEDED = ("uvicorn", "pytest")
EXCLUDED_PACKAGES = RUNTIME_PROVIDED + NOT_NEEDED

# Directories that are pure overhead in a deployment artifact.
PRUNE_DIRS = ("__pycache__", "tests", "test", ".pytest_cache")

# Console-script launchers. pip generates these as WINDOWS .exe files when it
# runs on Windows — even under --platform manylinux2014_x86_64, because the
# launcher is emitted by the local pip rather than taken from the wheel. They
# cannot execute on Lambda, nothing imports them, and pip embeds something
# non-reproducible in each one, so two consecutive builds of identical source
# produced different archive hashes until these were dropped.
PRUNE_TOP_LEVEL_DIRS = ("bin", "Scripts")

# RECORD lists every installed file with its hash, including the launchers
# above, so it inherits their non-determinism. It exists for `pip uninstall`,
# which never happens inside a Lambda package. The rest of *.dist-info stays —
# importlib.metadata.version() reads METADATA, and some clients call it.
PRUNE_FILENAMES = ("RECORD",)


def _run(cmd: list[str]) -> None:
    print(f"  $ {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def _filtered_requirements() -> Path:
    """Requirements minus what the runtime already provides."""
    source = SERVICE_DIR / "requirements.txt"
    kept = []
    for line in source.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        name = stripped.split("[")[0].split(">")[0].split("=")[0].split("<")[0].strip()
        if name.lower() in EXCLUDED_PACKAGES:
            reason = (
                "provided by the Lambda runtime"
                if name.lower() in RUNTIME_PROVIDED
                else "not needed under Lambda"
            )
            print(f"  - excluding {name} ({reason})")
            continue
        kept.append(stripped)

    target = BUILD_DIR.parent / "requirements-lambda.txt"
    target.write_text("\n".join(kept) + "\n", encoding="utf-8")
    return target


def _install_dependencies(requirements: Path) -> None:
    _run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--requirement",
            str(requirements),
            "--target",
            str(BUILD_DIR),
            # Cross-compilation guardrails. --only-binary=:all: is what turns a
            # missing Linux wheel into a build failure rather than a source
            # build against the local (Windows) toolchain.
            "--platform",
            PLATFORM,
            "--python-version",
            PYTHON_VERSION,
            "--implementation",
            "cp",
            "--only-binary=:all:",
            "--upgrade",
        ]
    )


def _copy_application_code() -> None:
    """Flatten the application into the package root — see the module docstring."""
    for name in ("main.py", "lambda_handler.py"):
        shutil.copy2(SERVICE_DIR / name, BUILD_DIR / name)
        print(f"  + {name}")

    shutil.copytree(
        SECURITY_DIR,
        BUILD_DIR / "security",
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(*PRUNE_DIRS, "*.pyc"),
    )
    print("  + security/")


def _dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def _prune() -> int:
    """Strip build residue. Returns bytes removed."""
    removed = 0

    for name in PRUNE_TOP_LEVEL_DIRS:
        target = BUILD_DIR / name
        if target.is_dir():
            removed += _dir_size(target)
            shutil.rmtree(target, ignore_errors=True)

    for directory in sorted(BUILD_DIR.rglob("*"), reverse=True):
        if directory.is_dir() and directory.name in PRUNE_DIRS:
            removed += _dir_size(directory)
            shutil.rmtree(directory, ignore_errors=True)

    for path in BUILD_DIR.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix in (".pyc", ".pyo") or path.name in PRUNE_FILENAMES:
            removed += path.stat().st_size
            path.unlink(missing_ok=True)

    return removed


def _write_zip() -> None:
    """
    Write the archive with fixed timestamps.

    Terraform triggers a redeploy on source_code_hash. Zip entries carry mtimes,
    so an unmodified rebuild would otherwise produce a different hash every time
    and Terraform would report a change on every plan — the kind of permanent
    diff that trains you to ignore plan output.
    """
    OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_ZIP.unlink(missing_ok=True)

    files = sorted(p for p in BUILD_DIR.rglob("*") if p.is_file())
    with zipfile.ZipFile(
        OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for path in files:
            info = zipfile.ZipInfo(
                str(path.relative_to(BUILD_DIR)).replace("\\", "/"),
                date_time=(1980, 1, 1, 0, 0, 0),
            )
            info.compress_type = zipfile.ZIP_DEFLATED
            # 0o755 for everything: Lambda needs the bits readable/executable and
            # Windows has no mode to preserve anyway.
            info.external_attr = 0o755 << 16
            archive.writestr(info, path.read_bytes())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--keep-build-dir",
        action="store_true",
        help="Leave dist/lambda-build/ in place for inspection.",
    )
    args = parser.parse_args()

    print(f"Building sentiment Lambda package (py{PYTHON_VERSION}, {PLATFORM})\n")

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)

    print("Dependencies:")
    _install_dependencies(_filtered_requirements())

    print("\nApplication code:")
    _copy_application_code()

    print("\nPruning:")
    print(f"  removed {_prune() / 1_048_576:.1f} MB of build residue")

    print("\nCompile check:")
    # Catches a syntax error now rather than at cold start. quiet=1 prints only
    # failures; the return value is False if any file failed to compile.
    if not compileall.compile_dir(str(BUILD_DIR), quiet=1, force=True):
        print("  FAILED — package contains code that does not compile", file=sys.stderr)
        return 1
    print("  ok")
    _prune()  # compileall just wrote .pyc files back

    print("\nArchive:")
    _write_zip()
    size_mb = OUTPUT_ZIP.stat().st_size / 1_048_576
    digest = hashlib.sha256(OUTPUT_ZIP.read_bytes()).hexdigest()

    print(f"  {OUTPUT_ZIP.relative_to(REPO_ROOT)}")
    print(f"  {size_mb:.1f} MB   sha256:{digest[:16]}…")

    # 50MB is the hard limit for a direct (non-S3) Lambda upload.
    if size_mb > 50:
        print(f"\n  Package exceeds the 50MB direct-upload limit.", file=sys.stderr)
        return 1
    if size_mb > 40:
        print("\n  Warning: approaching the 50MB direct-upload limit.")

    if not args.keep_build_dir:
        shutil.rmtree(BUILD_DIR, ignore_errors=True)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
