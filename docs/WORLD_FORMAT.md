# Worldpack Format (Aethergrid)

This document defines the world format Aethergrid expects today.

## Schema
A JSON schema is available at `docs/worldpack.schema.json`.

## Required fields
- `name`: string
- `profiles`: list of spawn profiles

## Core fields
- `description`: string
- `seed`: integer
- `mood`: string (optional theme key for audio/visual identity)
- `consts`: object of simulation constants (e.g., `W`, `H`, `DT`, `MAX_SPEED`)
- `profiles`: list of entity profile objects
- `laws`: list of law objects

## Profile fields
- `name`: string
- `color`: string (drives rendering + species mapping)
- `count`: integer
- `static`: boolean (optional)
- `aquatic`: boolean (optional)
- `mass_range`, `hardness_range`, `speed_range`, `depth_range`, `energy_range`, `wealth_range`: `[min, max]`

## Law fields
- `name`: string
- `priority`: integer
- `when`: string expression
- `actions`: string or list of strings

## Rendering assumptions
- Terrain + water are generated procedurally from `consts`.
- Entity silhouettes and palettes derive from `color` and world mood.
