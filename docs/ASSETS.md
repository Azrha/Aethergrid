# Assets & Pipeline

## What gets committed
Only exported runtime assets:
- `atlases/*.png` or `atlases/*.webp`
- `atlases/*.json`
- `docs/CREDITS.md`
- any required license text (if applicable)

## Recommended structure
- `atlases/terrain_atlas.webp`
- `atlases/terrain_atlas.json`
- `atlases/entities_atlas.webp`
- `atlases/entities_atlas.json`

## 3D models
- Runtime GLB assets live under `frontend/public/assets/models/`.
- Attribution notes live in `frontend/public/assets/models/ATTRIBUTION.md`.
- External sources are also listed in `docs/CREDITS.md`.

## Style goals (vibe)
- Readable silhouettes
- Subtle animation loops (life without noise)
- Height steps: clear top surface + visible walls
- Consistent palette and scale

## Notes for contributors
You can use any pixel editor. Export format must remain compatible with the runtime loader.
