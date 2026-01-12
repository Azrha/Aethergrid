# Aethergrid — Living Isometric Pixel Diorama Simulator

Aethergrid is a **fork-in-spirit** of the Mythos World Simulator: it keeps the useful simulation ideas, but the default presentation is rebuilt around a **pixel‑isometric diorama** look (layered height, visible walls, cozy “mini‑universe” vibe).

The core goal is simple: **the world should feel alive**.

---

## What this project aims to be

### Visual default
- Fixed **isometric** view (orthographic-style feel).
- **Layered terrain** (height steps + wall faces + overlays).
- **Pixel pipeline** (sprite atlases + metadata in-repo; no editor required to run).

### World “liveness”
- Ambient motion (water shimmer, wind, particles, subtle light shifts).
- Agents with readable intent (idle loops, turns, micro-walks, interactions).
- Optional “thinking” agent that can talk + act from a strict action set.

---

## Run (local)

This repo contains both frontend and backend. The exact run commands may evolve; see:
- `docs/DEV_GUIDE.md`

---

## Asset pipeline (plug-and-play)

Users do **not** need any sprite editor installed to run Aethergrid.

The repo commits only:
- exported atlases (`.png` / `.webp`)
- atlas metadata (`.json`)
- `docs/CREDITS.md` and any license notes

If someone wants to edit art, they can use any compatible pixel editor and re-export.

See:
- `docs/ASSETS.md`

---

## Key docs
- `docs/ARCHITECTURE.md` — system overview
- `docs/WORLD_FORMAT.md` — worldpack format (tiles/heights/spawns)
- `docs/AI_AGENT_PROTOCOL.md` — optional “thinking” character protocol
- `docs/ROADMAP.md` — milestones

---

## License / Credits
External assets must be listed in `docs/CREDITS.md` with license + source.
