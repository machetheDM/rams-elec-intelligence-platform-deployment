#!/usr/bin/env bash
# Build the deployment zip contents for the follow-up Lambda.
#
#   ./build.sh   ->   lambda/followup_trigger/build/
#
# Terraform's archive_file zips that directory (see terraform/aws/lambda_followup.tf).
# Run this before `terraform apply`, and again after changing handler.py.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="$HERE/build"

rm -rf "$BUILD"
mkdir -p "$BUILD"

# --only-binary=:all: would fail here: these are pure-Python packages published
# as universal wheels, which is exactly why no platform targeting is needed.
python -m pip install \
  --requirement "$HERE/requirements.txt" \
  --target "$BUILD" \
  --quiet

cp "$HERE/handler.py" "$BUILD/handler.py"

# Strip what does not need to ship. Smaller zip, faster cold start.
find "$BUILD" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "$BUILD" -type d -name "*.dist-info" -prune -exec rm -rf {} +

echo "Built $BUILD ($(du -sh "$BUILD" | cut -f1))"
