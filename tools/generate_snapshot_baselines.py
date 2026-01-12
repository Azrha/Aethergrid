from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.worldpack import load_worldpack_json, worldpack_to_dsl

ROOT = Path(__file__).resolve().parents[1]
WORLD_DIR = ROOT / "examples" / "worldpacks"
OUT_DIR = ROOT / "tests" / "fixtures" / "snapshots"


def snapshot_summary(path: Path, steps: int = 20) -> Dict[str, Any]:
    pack = load_worldpack_json(path.read_text(encoding="utf-8"))
    dsl = worldpack_to_dsl(pack)
    prog = compile_program(dsl)
    consts = pack.consts or {}
    world = seed_world(
        int(consts.get("W", 320)),
        int(consts.get("H", 220)),
        n=sum(p.count for p in pack.profiles),
        seed=pack.seed,
        profiles=[p.__dict__ for p in pack.profiles],
    )
    kernel = Kernel(world, prog.consts, prog.laws)
    for _ in range(steps):
        kernel.tick(observer_xy=None, observer_radius=55)

    alive = [e for e in kernel.world.entities if e.alive]
    count = len(alive)
    if not alive:
        return {"id": path.name, "name": pack.name, "entities": 0}

    avg = lambda values: sum(values) / max(1, len(values))
    summary = {
        "id": path.name,
        "name": pack.name,
        "entities": count,
        "avg_x": round(avg([e.x for e in alive]), 4),
        "avg_y": round(avg([e.y for e in alive]), 4),
        "avg_vx": round(avg([e.vx for e in alive]), 4),
        "avg_vy": round(avg([e.vy for e in alive]), 4),
        "avg_energy": round(avg([e.energy for e in alive]), 4),
        "avg_wealth": round(avg([e.wealth for e in alive]), 4),
    }
    return summary


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(WORLD_DIR.glob("*.json")):
        summary = snapshot_summary(path)
        out_path = OUT_DIR / f"{path.stem}.json"
        out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
