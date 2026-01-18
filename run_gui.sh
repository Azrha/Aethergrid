#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

./run_stack_detached.sh 127.0.0.1 127.0.0.1:8000

# Launch Windows Edge in app mode as a dedicated GUI window.
if command -v cmd.exe >/dev/null 2>&1; then
  cmd.exe /c start "" "msedge" "--app=http://127.0.0.1:5173" || true
fi
