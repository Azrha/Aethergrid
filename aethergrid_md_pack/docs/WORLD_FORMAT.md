# Worldpack Format (Aethergrid)

This document defines the world format Aethergrid expects.

## Goals
- Single diorama chunk by default (small, dense, readable).
- Layered heights (top surface + wall faces).
- Deterministic spawn rules for “alive” feeling.

## Proposed fields (v1)
- `name`: string
- `size`: `{ "w": number, "h": number }` (tile dimensions)
- `tiles`: 2D array or flattened list of tile IDs
- `heights`: 2D array or flattened list of integers (height per tile)
- `biome`: optional info (palette/overlays)
- `spawns`: list of spawn rules (profiles + counts + areas)
- `props`: optional static props (trees, lamps, crates)
- `events`: optional ambient events (particles, birds, fog)

## Coordinate system
- Grid coordinates: (x, y)
- Height: z (integer steps)

## Rendering assumptions
- A tile at height z draws:
  - top tile sprite
  - wall sprites where neighboring tile has lower height
