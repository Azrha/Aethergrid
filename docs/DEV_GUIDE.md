# Dev Guide

## Repository layout (target)
- `frontend/` — UI + renderer
- `backend/` — simulation server + websocket
- `examples/worldpacks/` — world definitions
- `atlases/` — exported sprite atlases + metadata
- `docs/` — documentation

## Local development (suggested)
1) Start backend
2) Start frontend
3) Verify websocket updates arrive and render

> Exact commands depend on the current scripts in the repo. Keep this file updated as the run scripts evolve.

## Build & test expectations
- Frontend builds without requiring any external editor.
- Backend runs locally with a single command.
- Minimal sample worldpack renders a layered diorama.
