# Aethergrid Desktop (Electron)

This is a lightweight Electron shell that loads the existing frontend.

## Dev

1. Start backend: `python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8000`
2. Start frontend: `cd frontend && npm run dev -- --host 127.0.0.1 --port 5173`
3. Run Electron:
   - Windows: `set ELECTRON_START_URL=http://127.0.0.1:5173` then `cd desktop && npm run dev`
   - macOS/Linux: `ELECTRON_START_URL=http://127.0.0.1:5173 cd desktop && npm run dev`

Windows + WSL shortcut: `run_desktop.ps1` from the repo root will start backend/frontend in WSL and open Electron.

## Production (optional)

Build the frontend first: `cd frontend && npm run build`
Then run: `cd desktop && npm install && npm run start`
