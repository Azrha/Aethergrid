# Mythos Roadmap — Alive World (Magnum Opus)

## Definition of "100% Alive"
An alive world is a system where autonomous agents exhibit persistent motion, social behavior, environmental response, resource loops (growth/consumption), temporal cycles, and observable emergent patterns. It should include visual depth, interaction feedback, and data/metrics to verify stability and realism.

## Phase 1 — Core Life Systems (Done)
- [x] Autonomous motion (wander/seek/avoid)
- [x] Social behavior (cohere/align/separate)
- [x] Day/night cycle and atmosphere lighting
- [x] Food field + metabolism + energy + survival
- [x] Living World preset (humans/animals/aliens/buildings/trees)
- [x] WorldPack format + loader + UI integration

## Phase 2 — Visual Depth & 3D (In Progress)
- [x] Add Z axis to entities and velocity
- [x] 3D render mode (interactive)
- [x] Depth-aware palette + visual cues (size/opacity)
- [x] Custom WebGL engine (React client)
- [x] Real 3D asset pipeline (GLTF loader + caching + UI toggle)
- [x] Per-world asset mapping (humanoids, fauna, dinos, structures)

## Phase 3 — Environment Complexity
- [x] Terrain/heightmap and biomes (foundation)
- [x] Weather system (wind + day/night + cloudiness)
- [x] Seasonal cycles (growth modulation)
- [x] Climate zones and rainfall gradients
- [x] Water/river flow and soil fertility (affects food)

## Phase 4 — Society & Economy
- [x] Settlements (basic emitters + fields)
- [x] Migration and route selection (road following)
- [x] Zoning (homes, markets, farms) foundation
- [x] Scarcity dynamics + trade loops (energy/wealth exchange)

## Phase 5 — Narrative WorldPacks
- [ ] Faction templates for lore worlds (e.g., “kingdoms”, “pirate fleets”)
- [ ] WorldPack tooling: schema validation + editor helpers
- [ ] Behavior libraries (role-based behaviors)
 - [x] Expand worldpack library (oceanic, frostbound, emberfall, skyborne, ironwild)

## Phase 5.1 — World Identity & Differentiation (New)
- [x] Distinct visual themes per worldpack (sky/terrain palettes, water tint, fog, lighting)
- [x] Unique species rosters per worldpack (avoid reusing human/alien/building defaults)
- [x] World-specific physics profiles (gravity/drag/collision ranges tuned per setting)
- [x] Terrain + climate signatures per world (seed/scale, rainfall, fertility bias)
- [ ] Per-world sound/mood profiles (ambient emitters + seasonal intensity curves)
- [x] Validation rule: each worldpack must change at least 3 axes (visual, species, physics, terrain)

## Phase 5.2 — 3D Asset Integration Plan (New)
- [x] Establish asset folder + attribution
- [x] Import CC0/Apache-2.0 models and generate custom GLB assets
- [x] Asset style switch (real assets vs procedural)
- [x] Model fidelity pass (higher detail trees, buildings, dinos)
- [x] Animated rigs per species (walk cycles and idle loops)
- [x] World-specific asset sets (fantasy vs dino vs space visuals)

## Phase 6 — Observability & QA
- [x] Diagnostics overlays (energy, density, motion)
- [x] Performance tests and reproducibility report
- [x] Snapshot render diffs for regressions

## Future Ideas to Add (Review and Expand)
- Ecosystem reproduction and aging curves
- Predation chains and fear/avoidance
- Day/night behaviors (sleep cycles)
- Events system (meteor strikes, plagues, discovery)
- Road/river pathing with attract/repel layers
- Fire/wildfire dynamics and recovery
- Ocean currents + tidal effects
- Multi-species memory/learning traits
- Procedural city generation with districts
- Neural “moods” that shift behavior over time
- Trade routes and caravan movement
- Infrastructure decay and repair loops
- Cultural diffusion and influence fields
- Ocean/river shipping lanes

## Current Findings (Post-Move Review)
- WorldPacks share too many defaults (humans/aliens/buildings), so worlds feel visually similar.
- Terrain/lighting themes are not explicitly tied to worldpack identity.
- Behavior sets overlap heavily; unique ecology loops per world are limited.

## Phase 5.3 — Comprehensive 3D Asset Upgrade (Completed)
- [x] Integrated "RobotExpressive" for generic humanoids/synths.
- [x] Integrated "CesiumMan" for settlers.
- [x] Integrated "Soldier" for tribes/warriors.
- [x] Integrated "Pilot/Astronaut" for space/sky themes.
- [x] Integrated "Fox" for standard animals/beasts.
- [x] Integrated "BarramundiFish" for Oceanic fauna.
- [x] Integrated "DragonAttenuation" for Fantasy/Dino behemoths.
- [x] Integrated "Buggy" for Ironwild machines.
- [x] Configured per-world asset sets (Oceanic, Frostbound, Emberfall, etc.).
- [x] Applied auto-normalization to fix scale issues across all models.
