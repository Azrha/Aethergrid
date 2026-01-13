# Architecture

## Big picture
Aethergrid separates the project into layers:

1) **Simulation layer** (backend)
- Produces world state and entity updates (snapshots and/or deltas).

2) **Presentation layer** (frontend)
- Renders an isometric pixel diorama:
  - terrain tiles
  - wall faces (height steps)
  - overlays/props
  - entities
  - VFX

3) **Optional cognition layer**
- One entity can be attached to an LLM endpoint to generate:
  - speech
  - actions from a strict whitelist

## Data flow
Backend → WebSocket → Frontend
- World: tile grid + heights + biome/material IDs
- Entities: id, position (grid), facing, anim state, tags
- Env: time-of-day, weather, events

## Rendering approach (default)
- Fixed isometric projection.
- Layered draw order for readability.
- Atlas-based rendering for performance.
