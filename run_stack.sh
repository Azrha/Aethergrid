#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Defaults
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///$HOME/.aethergrid/data.sqlite3}"
export VITE_API_URL="${BACKEND_URL}"
mkdir -p "$HOME/.aethergrid"

# Virtual Environment
VENV_DIR="${VENV_DIR:-.venv}"

if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
elif [ -f "$VENV_DIR/Scripts/activate" ]; then
    source "$VENV_DIR/Scripts/activate"
else
    echo "[ERROR] Virtual environment not found. Run ./setup_wsl.sh first."
    exit 1
fi

# GPU Support Check
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "[INFO] NVIDIA GPU detected. Checking for CuPy..."
    if ! "$VENV_DIR/bin/python" -c "import cupy" >/dev/null 2>&1; then
        echo "[INFO] Installing CuPy for CUDA 12..."
        "$VENV_DIR/bin/pip" install cupy-cuda12x
    fi
fi

check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 2 "${BACKEND_URL}/api/health" >/dev/null 2>&1
    return $?
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "${BACKEND_URL}/api/health" >/dev/null 2>&1
    return $?
  fi
  return 1
}

# Start Backend
echo "[INFO] Starting backend..."
python -m uvicorn server.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
BACK_PID=$!

cleanup() {
  if [[ -n "${BACK_PID:-}" ]]; then
    echo "[INFO] Stopping backend..."
    kill "$BACK_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Start Frontend
echo "[INFO] Starting frontend..."
cd frontend
npm run dev
