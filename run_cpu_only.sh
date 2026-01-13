#!/bin/bash
set -e

echo "[INFO] FIXING DEPENDENCIES..."
# Explicitly install the missing packages that caused the crash
.venv/bin/pip install fastapi "uvicorn[standard]" sqlalchemy psycopg-binary python-dotenv numpy pillow

echo "[INFO] STARTING BACKEND..."
# Use absolute path for python execution to be safe
# Force CPU mode
export CUPY_ACCELERATORS=""
.venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "[INFO] STARTING FRONTEND..."
cd frontend || { echo "Frontend folder not found!"; exit 1; }
npm run dev -- --host &
FRONT_PID=$!

echo "[INFO] OPEN BROWSER AT: http://localhost:5173"
wait $BACK_PID $FRONT_PID
