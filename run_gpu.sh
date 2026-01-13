#!/bin/bash
set -e

echo "[INFO] === AETHERGRID GPU LAUNCH ==="

echo "[INFO] Checking GPU Dependencies..."
# Install CuPy for CUDA 12.x (Large Download ~500MB)
.venv/bin/pip install cupy-cuda12x

echo "[INFO] Verifying Core Dependencies..."
.venv/bin/pip install fastapi "uvicorn[standard]" sqlalchemy psycopg-binary python-dotenv numpy pillow

echo "[INFO] STARTING BACKEND (GPU MODE)..."
# Enable CUDA
export CUPY_ACCELERATORS="cuda"

# Bind to 0.0.0.0 for WSL compatibility
./.venv/bin/python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACK_PID=$!

echo "[INFO] STARTING FRONTEND..."
cd frontend || { echo "Frontend folder not found!"; exit 1; }
npm run dev -- --host &
FRONT_PID=$!

echo "[INFO] OPEN BROWSER AT: http://localhost:5173"
wait $BACK_PID $FRONT_PID
