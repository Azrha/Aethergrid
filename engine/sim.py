from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import json
import time

from .kernel import Kernel
from .model import World, Entity


def _entity_to_dict(e: Entity) -> Dict[str, Any]:
    return {
        "id": e.id,
        "x": e.x,
        "y": e.y,
        "vx": e.vx,
        "vy": e.vy,
        "mass": e.mass,
        "hardness": e.hardness,
        "color": e.color,
        "age": e.age,
        "seen": e.seen,
        "alive": e.alive,
        "sound": e.sound,
    }


def world_snapshot(world: World, max_entities: Optional[int] = None) -> Dict[str, Any]:
    ents = world.entities
    if max_entities is not None:
        ents = ents[:max_entities]
    return {
        "time": world.time,
        "w": world.w,
        "h": world.h,
        "dt": world.dt,
        "entities": [_entity_to_dict(e) for e in ents],
    }


@dataclass
class Simulation:
    kernel: Kernel
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    snapshots: List[Dict[str, Any]] = field(default_factory=list)

    def step(self, steps: int = 1, observer_xy: Tuple[int, int] | None = None, observer_radius: int = 55):
        start = time.perf_counter()
        for _ in range(max(1, steps)):
            self.kernel.tick(observer_xy=observer_xy, observer_radius=observer_radius)
        elapsed = time.perf_counter() - start
        self.metrics.append(
            {
                "t": self.kernel.world.time,
                "steps": steps,
                "elapsed_ms": elapsed * 1000.0,
            }
        )

    def capture_snapshot(self, max_entities: Optional[int] = None, cap: int = 120):
        self.snapshots.append(self.snapshot(max_entities=max_entities))
        if len(self.snapshots) > cap:
            self.snapshots = self.snapshots[-cap:]

    def snapshot(self, max_entities: Optional[int] = None) -> Dict[str, Any]:
        snap = world_snapshot(self.kernel.world, max_entities=max_entities)
        snap["consts"] = dict(self.kernel.consts)
        snap["metrics_tail"] = list(self.metrics[-60:])
        return snap

    def snapshot_json(self, max_entities: Optional[int] = None) -> str:
        return json.dumps(self.snapshot(max_entities=max_entities), indent=2)

    def snapshots_jsonl(self) -> str:
        return "\n".join(json.dumps(s) for s in self.snapshots)
