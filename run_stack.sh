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

echo "[INFO] Starting backend..."
.venv/bin/uvicorn server.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "[INFO] Starting frontend..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

echo "[INFO] Stack running."
wait $BACKEND_PID $FRONTEND_PID
