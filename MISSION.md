# MISSION — Build Aethergrid (Agent Task Brief)

## Objective
Transform this repo into a pixel-isometric diorama simulator with layered height and a “living world” feel.

## Constraints
- Runtime must be plug-and-play (no sprite editor required).
- Keep assets as exported atlases + metadata.
- Prefer small, dense single-chunk diorama for initial correctness.

## Deliverables (in order)
1) Minimal runnable stack: backend websocket → frontend renders
2) Isometric pixel renderer default
3) Height layering (walls) + overlays
4) Entity sprite animation + facing
5) Ambient “life” VFX layer
6) Optional thinking agent behind a config flag

## Definition of done (MVP)
- One sample worldpack renders like a tiny living diorama
- ~50 entities runs smoothly
- Visible animation loops + subtle ambience
