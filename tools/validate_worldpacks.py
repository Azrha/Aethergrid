from __future__ import annotations

from pathlib import Path
import sys

from engine.worldpack import load_worldpack_json, validate_worldpack


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    world_dir = root / "examples" / "worldpacks"
    if not world_dir.exists():
        print("Worldpack directory not found.")
        return 1
    failures = 0
    for path in sorted(world_dir.glob("*.json")):
        try:
            pack = load_worldpack_json(path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[FAIL] {path.name}: failed to load ({exc})")
            failures += 1
            continue
        errors = validate_worldpack(pack)
        if errors:
            failures += 1
            print(f"[FAIL] {path.name}:")
            for err in errors:
                print(f"  - {err}")
        else:
            print(f"[OK]   {path.name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
