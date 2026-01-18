# TASKS — Aethergrid Deep Review Findings

## Core priorities (do not lose sight)
- The world must feel alive: persistent motion, interaction loops, visible environmental response, and ambient motion.
- Pixel-isometric diorama default must be readable, animated, and visually cohesive.
- AI agent must follow a strict action protocol, be safe, and be visibly integrated.
- Assets must be credited and reproducible from exported files only.

## Critical breakages / blockers
- Fix Python syntax error in `server/main.py#L225` (unexpected indent before `await ws.send_text`) preventing the FastAPI server from starting.
- `engine/worldpack.py` returns a raw dict, but multiple callers (e.g., `app.py`, `tests/test_snapshots.py`) expect `pack.consts`, `pack.profiles`, and `pack.seed` attributes; unify the API to avoid runtime errors.
- Snapshot tests (`tests/test_snapshots.py`) reference attribute-style `pack.consts`/`pack.profiles` but current loader returns dict; tests currently fail or are skipped by luck.
 - Pixel diorama still renders far too many sprites (living_world screenshot still crowded) despite aggressive culling and reduced default entity count; readability target not met.
- Pixel diorama shows vertical streak/tearing artifacts from terrain sprite overlay; tile compositing still mismatched and needs a seam-free atlas strategy.
- `/api/health` hangs because `gpu_available()` blocks while probing GPU; this makes the backend appear offline even when uvicorn is listening.
- Backend startup stalls because `engine.backend` eagerly imports `cupy` at module load; needs lazy GPU import to keep CPU-only boot fast.
- Backend responses are still delayed >30s even after startup; CLI `curl`/`node fetch` requests time out while uvicorn logs 200 OK later. This blocks automated visual tests and needs root-cause analysis.
- Puppeteer screenshot run (`frontend/scripts/screenshot-test.cjs`) still times out because `/api/apply` never returns in time from the test harness.

## High priority gaps (roadmap + core experience)
- Pixel renderer only draws first 8 entities (`frontend/src/engine/PixelArtRenderer.ts`), making worlds look empty; must render full population with sensible LOD/culling.
- Pixel entities do not animate or face direction (Milestone 1 requirement in `docs/ROADMAP.md`); add per-entity animation frames and facing logic.
- 3D asset pipeline is declared in `frontend/src/engine/assets.ts` but never used in `frontend/src/engine/Renderer.ts`; `preloadAssets()` is a no-op and GLTFs are unused.
- AI agent does not follow `docs/AI_AGENT_PROTOCOL.md` (no action schema, no safety action whitelist enforcement, only speech bubbles).
- Entity speech bubbles are not positioned to entity coordinates; positions are randomized each update (`frontend/src/components/EngineView.tsx`).
- Character creator cannot be opened (no UI trigger), and the profile schema emitted does not match `engine/factory.seed_world` expectations.

## Visual / living-world realism issues
- Aquatic vs land traversal uses substring checks on `Entity.color` in `engine/model.py`, but worldpacks use `color` values like `fauna`, `settler`, `grove`; aquatic behavior never triggers correctly.
- No explicit ambient VFX layer in pixel view (Milestone 2 in `docs/ROADMAP.md`); living world currently lacks visible wind/particles/water shimmer.
- Isometric terrain renders but lacks wall faces/height shading for strong depth; entities can visually blend into terrain.
- 3D voxel designs are more detailed but still share silhouettes; more distinct human/alien/animal silhouettes are needed.
- Pixel diorama density is too high even after reducing default `n` to 180 and heavy culling; need stronger LOD strategy (per-cell cap + per-species quotas + density tied to zoom).
- 3D procedural voxel scale is oversized (`scale = 2.5`) and overwhelms terrain; models need size normalization + category-specific scale.
- Pixel terrain tiles still misalign with sprite art proportions; needs consistent TILE_W/TILE_H mapping and atlas bounds to avoid stretched textures.

## Data / assets compliance
- `docs/CREDITS.md` is empty while many external assets are in `frontend/public/assets/models` and `frontend/src/assets/*.png`; must document source + license for every external asset (project rule).
- Backup files (`*.bak`, `*_backup.png`, `*.bak_fix*`) exist across `engine/` and `frontend/src/engine/`; these should be removed or ignored to avoid shipping work-in-progress artifacts.
- Untracked asset tooling scripts and screenshots exist in `frontend/`; need to decide whether they belong in-repo or should be excluded/relocated.
- `frontend/public/assets/models/ATTRIBUTION.md` omits newly added external model files (animal/buggy/dragon/fish/etc); attribution needs to match actual assets.
- Tileset PNGs in `frontend/src/assets/` have no source/license recorded yet; must confirm origin or treat as internal assets with explicit license statement.

## QA / testing gaps
- No automated visual regression for pixel view despite new tilesets and renderer changes.
- Snapshot baselines may be out of sync with current worldpack definitions (see `tests/fixtures/snapshots`).
- No tests for AI action protocol, speech bubble positioning, or entity animation state.
- Puppeteer visual tests require a bundled Chrome (`npx puppeteer browsers install chrome`) before scripts can run.
- `/api/thumbnail/*.png` requests 404 and trigger ORB errors during screenshots; placeholder thumbnails or disabled requests needed for clean visual runs.
- `apply_program` ignores UI entity count when profiles are present (because `seed_world` only uses `n` for empty profiles); UI/engine behavior mismatch should be clarified or fixed.
- 3D asset variation parameters (`heightRange`, `extentRange`) are defined but not used, reducing visual variety.
- `uvicorn` import hangs in this environment (stuck in stdlib path resolution), so backend cannot be started for visual tests; visual verification is currently blocked.

## Docs / consistency gaps
- Root `ROADMAP.md` and `docs/ROADMAP.md` diverge significantly; need a single source of truth or cross-linking with explicit scope.
- `docs/ASSETS.md` and `docs/CREDITS.md` not updated to reflect new tilesets, GLTF assets, or procedural voxel pipeline.
- `docs/AI_AGENT_PROTOCOL.md` is not implemented; document current status or implement fully.

## Progress (recent)
- [x] Fix server startup regression (`server/main.py`) and DSL parser to accept multi-line `do` actions, comments, and semicolon-separated calls.
- [x] Restore `WorldPack` object semantics + snapshot tooling; regenerated snapshot baselines after worldpack changes.
- [x] Implement pixel view entity animation + culling + selection, plus ambient water/soil shimmer.
- [x] Add AI action generation + whitelist enforcement + sim application (move/say/emote/interact).
- [x] Improve voxel variety with distinct alien/machine/dino silhouettes and facing/idle motion.
- [x] Installed Puppeteer Chrome + system deps; ran `frontend/scripts/test-all-presets.cjs` and captured screenshots.
- [x] Tighten AI action parsing/sanitization + add tests (`tests/test_ai_protocol.py`).
- [x] Normalize 3D asset scaling variance + idle motion, reduce voxel scale in `frontend/src/engine/Renderer.ts`.
- [x] Add ambient wind/spore VFX and reduce pixel entity density/scale in `frontend/src/engine/PixelArtRenderer.ts`.
- [x] Update `frontend/public/assets/models/ATTRIBUTION.md` to cover new external models.
- [x] Added base-layer isometric tiles (solid diamonds) and removed terrain sprite overlay to reduce terrain noise.
- [x] Fixed PixelArtView frame callback refs/backoff and deduped thought position updates to reduce update-depth warnings.
- [x] Reduced default entity count for pixel view (`frontend/src/App.tsx`).
- [x] Updated visual test harness to wait for backend readiness and avoid "waiting for world data" captures.
- [x] Reintroduced terrain sprite overlay + tuned tile sizing to restore recognizable diorama sprites (still has seam artifacts to fix).
- [x] Make `/api/health` return cached GPU status to avoid blocking requests (`engine/backend.py`, `server/main.py`).
- [x] Make GPU import lazy so uvicorn can start without stalling on `cupy` (`engine/backend.py`).
- [x] Ensure pixel theme changes invalidate cached terrain render + keep terrain sprite bounds uniform to reduce seam drift (`frontend/src/engine/PixelArtRenderer.ts`).
- [x] Offload simulation stepping/persistence to background threads to keep API responses responsive (`server/sim_service.py`).
- [x] Reduce pixel tile seam artifacts by overdraw + rounded placement in terrain prerender (`frontend/src/engine/PixelArtRenderer.ts`).
- [x] Allow optional Z in AI `move_to` actions and document the protocol (`server/ollama_service.py`, `server/sim_service.py`, `docs/AI_AGENT_PROTOCOL.md`).
- [x] Add regression tests for profile scaling, mood inference, and voxel depth resizing.

## Recent visual verification
- `frontend/test-screenshot.png` confirms entities/terrain sprites render again, but seam artifacts and tiling mismatch remain.
