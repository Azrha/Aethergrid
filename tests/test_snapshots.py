import json
from pathlib import Path
import random

from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.worldpack import load_worldpack_json, worldpack_to_dsl


ROOT = Path(__file__).resolve().parents[1]
WORLD_DIR = ROOT / "examples" / "worldpacks"
SNAPSHOT_DIR = ROOT / "tests" / "fixtures" / "snapshots"


def _snapshot_summary(path: Path, steps: int = 20):
    pack = load_worldpack_json(path.read_text(encoding="utf-8"))
    random.seed(int(pack.seed))
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
        return {"id": path.name, "entities": 0}

    avg = lambda values: sum(values) / max(1, len(values))
    return {
        "id": path.name,
        "entities": count,
        "avg_x": round(avg([e.x for e in alive]), 4),
        "avg_y": round(avg([e.y for e in alive]), 4),
        "avg_vx": round(avg([e.vx for e in alive]), 4),
        "avg_vy": round(avg([e.vy for e in alive]), 4),
        "avg_energy": round(avg([e.energy for e in alive]), 4),
        "avg_wealth": round(avg([e.wealth for e in alive]), 4),
    }


def test_snapshot_regressions():
    assert SNAPSHOT_DIR.exists(), "Snapshot baselines missing. Run tools/generate_snapshot_baselines.py"
    for path in sorted(WORLD_DIR.glob("*.json")):
        baseline_path = SNAPSHOT_DIR / f"{path.stem}.json"
        assert baseline_path.exists(), f"Missing baseline for {path.name}"
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        current = _snapshot_summary(path)
        assert baseline["entities"] == current["entities"]
        for key in ("avg_x", "avg_y", "avg_vx", "avg_vy", "avg_energy", "avg_wealth"):
            assert abs(baseline[key] - current[key]) <= 0.25
