#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///$HOME/.mythos/data.sqlite3}"
export VITE_API_URL="${BACKEND_URL}"
mkdir -p "$HOME/.mythos"
BACKEND_RELOAD="${BACKEND_RELOAD:-0}"
PORT_PID=""
PORT_CMD=""

check_port_in_use() {
  PORT_PID=""
  PORT_CMD=""
  if command -v lsof >/dev/null 2>&1; then
    local line
    line="$(lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $2, $1}')"
    if [[ -n "$line" ]]; then
      PORT_PID="$(echo "$line" | awk '{print $1}')"
      PORT_CMD="$(echo "$line" | awk '{print $2}')"
      return 0
    fi
  elif command -v ss >/dev/null 2>&1; then
    local match
    match="$(ss -ltnp "sport = :$BACKEND_PORT" 2>/dev/null | awk 'NR==2 {print $NF}')"
    if [[ -n "$match" ]]; then
      PORT_PID="$(echo "$match" | sed -n 's/.*pid=\\([0-9]*\\).*/\\1/p')"
      PORT_CMD="$(echo "$match" | sed -n 's/.*users:(("\\([^"]*\\)".*/\\1/p')"
      return 0
    fi
  fi
  return 1
}

ensure_nvm() {
  export NVM_DIR="$HOME/.nvm"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    echo "[INFO] Installing nvm..."
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    elif command -v wget >/dev/null 2>&1; then
      wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    else
      echo "[ERROR] curl or wget required to install nvm."
      exit 1
    fi
  fi
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
}

ensure_node() {
  ensure_nvm
  nvm install 20.19.0 >/dev/null
  nvm use 20.19.0 >/dev/null
}

ensure_venv() {
  local venv_dir="${VENV_DIR:-.venv}"
  echo "[INFO] Using venv: $venv_dir"
  if [[ ! -d "$venv_dir" ]]; then
    echo "[INFO] Creating virtualenv..."
    python3 -m venv --upgrade-deps "$venv_dir"
  else
    local activate_path="$venv_dir/bin/activate"
    if [[ -f "$activate_path" ]] && ! grep -q "$ROOT_DIR" "$activate_path"; then
      echo "[WARN] Venv path moved; repairing virtualenv..."
      python3 -m venv --upgrade-deps "$venv_dir"
    fi
  fi
  # shellcheck disable=SC1090
  source "$venv_dir/bin/activate"
  "$venv_dir/bin/python" -m pip install -r requirements.txt
  if command -v nvidia-smi >/dev/null 2>&1; then
    python - <<'PY' >/dev/null 2>&1 || pip install cupy-cuda12x
import cupy  # noqa: F401
PY
  fi
}

if [[ ! -w "." ]]; then
  echo "[ERROR] project directory not writable. Fix permissions first:"
  echo "  sudo chown -R $USER:$USER \"$ROOT_DIR\""
  exit 1
fi

ensure_venv
ensure_node

check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 2 "${BACKEND_URL}/api/health" >/dev/null 2>&1
    return $?
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "${BACKEND_URL}/api/health" >/dev/null 2>&1
    return $?
  fi
  python - <<PY >/dev/null 2>&1
import urllib.request
try:
    with urllib.request.urlopen("${BACKEND_URL}/api/health", timeout=2) as resp:
        print(resp.status)
except Exception:
    raise SystemExit(1)
PY
}

start_backend() {
  echo "[INFO] Backend reload: $([[ "$BACKEND_RELOAD" == "1" ]] && echo on || echo off)"
  if [[ "$BACKEND_RELOAD" == "1" ]]; then
    python -m uvicorn server.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
  else
    python -m uvicorn server.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
  fi
  BACK_PID=$!
}

echo "[INFO] Starting backend..."
BACK_PID=""
if pgrep -f "uvicorn server.main:app" >/dev/null 2>&1; then
  if check_health; then
    echo "[INFO] Backend already running."
  else
    echo "[WARN] Backend unhealthy. Restarting..."
    pkill -f "uvicorn server.main:app" >/dev/null 2>&1 || true
    sleep 1
    start_backend
  fi
else
  if check_port_in_use; then
    if [[ -n "$PORT_PID" ]]; then
      if command -v rg >/dev/null 2>&1; then
        ps -p "$PORT_PID" -o cmd= | rg -q "uvicorn.*server.main:app" && IS_UVICORN=1 || IS_UVICORN=0
      else
        ps -p "$PORT_PID" -o cmd= | grep -q "uvicorn.*server.main:app" && IS_UVICORN=1 || IS_UVICORN=0
      fi
      if [[ "${IS_UVICORN:-0}" -eq 1 ]]; then
        echo "[WARN] Killing stale backend process on port ${BACKEND_PORT} (PID ${PORT_PID})."
        kill "$PORT_PID" >/dev/null 2>&1 || true
        sleep 1
      else
        echo "[ERROR] Port ${BACKEND_PORT} already in use by PID ${PORT_PID} (${PORT_CMD:-unknown})."
        echo "        Stop it and retry:"
        echo "        kill ${PORT_PID}"
        exit 1
      fi
    else
      echo "[ERROR] Port ${BACKEND_PORT} already in use."
      exit 1
    fi
  fi
  start_backend
fi

cleanup() {
  if [[ -n "${BACK_PID:-}" ]]; then
    echo "[INFO] Stopping backend..."
    kill "$BACK_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[INFO] Starting frontend..."
cd frontend
if [[ -d node_modules && ! -w node_modules ]]; then
  echo "[ERROR] frontend/node_modules is not writable. Fix permissions first:"
  echo "  sudo chown -R $USER:$USER \"$ROOT_DIR/frontend\""
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo "[INFO] Installing frontend dependencies..."
  npm install
fi

echo "[INFO] Waiting for backend health..."
healthy=0
for i in {1..30}; do
  if check_health; then
    healthy=1
    break
  fi
  sleep 1
done
if [[ "$healthy" -ne 1 ]]; then
  echo "[ERROR] Backend not responding at ${BACKEND_URL}/api/health"
  echo "        Stop any old backend and retry:"
  echo "        pkill -f \"uvicorn server.main:app\""
  exit 1
fi
npm run dev
