# Roadmap

Note: This roadmap covers the pixel‑isometric frontend. The core simulation/3D milestone roadmap is in `ROADMAP.md`.

## Milestone 0 — Fork bootstrap
- Repo structure stabilized
- Docs in place
- Minimal runnable dev flow

## Milestone 1 — Pixel-isometric renderer default
- Single diorama chunk renders
- Height layering (walls) works
- Entity sprites animate + face directions

## Milestone 2 — “Living world”
- Ambient VFX layer (subtle)
- Agent idle/micro behaviors
- Basic interactions

## Milestone 3 — Optional thinking agent
- LLM endpoint integration behind a feature flag
- Action whitelist + cooldowns enforced
- Visible speech bubbles / logs

## Current status (high-level)
- Milestone 1: mostly implemented; remaining work focuses on terrain seam cleanup and density tuning.
- Milestone 2: ambient VFX + micro behaviors are present; continue polish for readability.
- Milestone 3: action whitelist/cooldowns implemented; add remaining tests + UI polish.

## Milestone 4 — Streaming / chunk expansion
- Optional neighbor chunk loading
- Culling + performance verification
