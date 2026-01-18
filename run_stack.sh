#!/bin/bash
set -e
set -x  # Print commands as they are executed

# self-healing: check if uvicorn exists
if [ ! -f ".venv/bin/uvicorn" ]; then
    echo "[WARN] .venv/bin/uvicorn not found. Rebuilding environment..."
    rm -rf .venv
    
    echo "[INFO] Creating venv..."
    python3 -m venv .venv
    
    echo "[INFO] Installing backend dependencies (VERBOSE)..."
    .venv/bin/pip install -v -r requirements.txt
    
    echo "[INFO] Attempting to install GPU dependencies (This is LARGE ~500MB)..."
    .venv/bin/pip install -v cupy-cuda12x || echo "[WARN] GPU Libs install failed, proceeding with CPU only."
fi

echo "[INFO] Checking frontend dependencies..."
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd frontend
    npm install --verbose
    cd ..
fi

# Trap SIGINT to kill background processes
trap 'kill $(jobs -p)' SIGINT

BACKEND_HOST="${AETHER_BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${AETHER_BACKEND_PORT:-8000}"
FRONTEND_HOST="${AETHER_FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${AETHER_FRONTEND_PORT:-5173}"
VITE_API_URL="${VITE_API_URL:-${AETHER_API_URL:-}}"

echo "[INFO] Starting backend on ${BACKEND_HOST}:${BACKEND_PORT}..."
.venv/bin/uvicorn server.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
BACKEND_PID=$!

echo "[INFO] Starting frontend..."
cd frontend
if [ -n "$VITE_API_URL" ]; then
    export VITE_API_URL
fi
npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

echo "[INFO] Stack running."
wait $BACKEND_PID $FRONTEND_PID
