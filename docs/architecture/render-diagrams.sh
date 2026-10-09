#!/usr/bin/env bash
# Redraws the pictures in docs/architecture/img from the Mermaid source in the Markdown
# files, so a picture never says something its source does not.
#
#   bash docs/architecture/render-diagrams.sh
#
# The source of truth is the ```mermaid block in each .md file. Edit that, run this,
# commit both. Needs Node and a Chrome or Edge already on the machine; the renderer
# (@mermaid-js/mermaid-cli) is fetched by npx into its own cache, not into this repository.
set -euo pipefail
cd "$(dirname "$0")"

browser=""
for candidate in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
  if [ -n "$candidate" ] && [ -e "$candidate" ]; then browser="$candidate"; break; fi
done
[ -n "$browser" ] || { echo "No Chrome or Edge found - install one, or set the path in this script."; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }' "$(cygpath -m "$browser" 2>/dev/null || echo "$browser")" > "$work/puppeteer.json"
mkdir -p img

# file.md | which mermaid block in it (from 1) | picture name
while IFS='|' read -r file block name; do
  python - "$file" "$block" "$work/$name.mmd" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
blocks = re.findall(r"```mermaid\n(.*?)```", text, flags=re.S)
open(sys.argv[3], "w", encoding="utf-8", newline="\n").write(blocks[int(sys.argv[2]) - 1])
PY
  PUPPETEER_SKIP_DOWNLOAD=true npx -y @mermaid-js/mermaid-cli@12.0.0 -q \
    -i "$work/$name.mmd" -o "img/$name.png" -b white -s 2 -p "$work/puppeteer.json"
  echo "drew img/$name.png"
done <<'LIST'
as-built.md|1|as-built-local-stack
target-state.md|1|target-runtime-and-security
target-state.md|2|target-data-and-models
target-state.md|3|target-delivery-pipeline
LIST
