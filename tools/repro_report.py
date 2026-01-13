from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Dict, Any

from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.worldpack import load_worldpack_json, worldpack_to_dsl

ROOT = Path(__file__).resolve().parents[1]
WORLD_DIR = ROOT / "examples" / "worldpacks"


def run_worldpack(path: Path, steps: int) -> Dict[str, Any]:
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

    start = time.perf_counter()
    for _ in range(steps):
        kernel.tick(observer_xy=None, observer_radius=55)
    elapsed = (time.perf_counter() - start) * 1000.0
    ms_per_step = elapsed / max(1, steps)

    alive = [e for e in kernel.world.entities if e.alive]
    avg_energy = sum(e.energy for e in alive) / max(1, len(alive))
    avg_wealth = sum(e.wealth for e in alive) / max(1, len(alive))
    avg_speed = sum((e.vx**2 + e.vy**2) ** 0.5 for e in alive) / max(1, len(alive))

    return {
        "id": path.name,
        "name": pack.name,
        "entities": len(alive),
        "avg_energy": round(avg_energy, 4),
        "avg_wealth": round(avg_wealth, 4),
        "avg_speed": round(avg_speed, 4),
        "ms_per_step": round(ms_per_step, 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=25)
    parser.add_argument("--out", type=str, default="")
    args = parser.parse_args()

    results = []
    for path in sorted(WORLD_DIR.glob("*.json")):
        results.append(run_worldpack(path, args.steps))

    report = {
        "steps": args.steps,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "worldpacks": results,
    }

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    else:
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
