#!/bin/bash
set -euo pipefail

echo "[INFO] Running worldpack validation..."
PYTHONPATH=. python3 tools/validate_worldpacks.py

echo "[INFO] Running tests..."
pytest -q
