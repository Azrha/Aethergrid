from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
import math

from engine.backend import get_backend, disable_gpu
from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.worldpack import load_worldpack_json, worldpack_to_dsl

from .db import SessionLocal
from .models import Snapshot, Metric, Base
from sqlalchemy import inspect

logger = logging.getLogger("mythos")

@dataclass
class Frame:
    t: float
    w: int
    h: int
    entities: List[Dict[str, Any]]


class SimulationService:
    def __init__(self):
        self.kernel: Kernel | None = None
        self.running = False
        self.tick_ms = 33
        self.steps = 1
        self.last_frame: Frame | None = None
        self._lock = asyncio.Lock()
        self._last_emit = 0.0
        self._persist_every = 1.5
        self._init_db()

    def _init_db(self):
        from .db import engine
        if not inspect(engine).has_table("snapshots"):
            Base.metadata.create_all(bind=engine)

    def load_worldpack(self, name: str) -> Dict[str, Any]:
        base = Path("examples/worldpacks")
        path = base / name
        # pack is now a dict
        pack = load_worldpack_json(path.read_text(encoding="utf-8"))
        
        # safely get profiles, assuming they are already dicts in the JSON
        profiles = pack.get("profiles", [])
        
        return {
            "name": pack.get("name", "Unknown"),
            "description": pack.get("description", ""),
            "dsl": worldpack_to_dsl(pack),
            "profiles": profiles,
            "seed": pack.get("seed", 42),
        }

    def list_presets(self) -> List[Dict[str, Any]]:
        base = Path("examples/worldpacks")
        items = []
        for path in base.glob("*.json"):
            try:
                # pack is a dict
                pack = load_worldpack_json(path.read_text(encoding="utf-8"))
                items.append({
                    "id": path.name,
                    "name": pack.get("name", path.stem),
                    "description": pack.get("description", ""),
                    "seed": pack.get("seed", 42),
                })
            except Exception as e:
                logger.warning(f"Failed to load preset {path}: {e}")
                
        return sorted(items, key=lambda x: x["name"])

    async def apply_program(
        self,
        dsl: str,
        profiles: Optional[List[Dict[str, Any]]],
        seed: int,
        n: int,
        backend_name: str = "gpu",
    ) -> None:
        async with self._lock:
            prog = compile_program(dsl)
            use_gpu = backend_name == "gpu"
            backend = get_backend(use_gpu)
            try:
                world = seed_world(64, 64, n=n, seed=seed, backend=backend, profiles=profiles)
                kernel = Kernel(world, prog.consts, prog.laws)
                W, H = kernel.world.w, kernel.world.h
                DT = kernel.world.dt
                world = seed_world(W, H, n=n, seed=seed, backend=backend, profiles=profiles)
                world.dt = DT
                kernel = Kernel(world, prog.consts, prog.laws)
            except Exception:
                if use_gpu:
                    logger.exception("GPU apply failed; falling back to CPU.")
                    disable_gpu()
                    backend = get_backend(False)
                    world = seed_world(64, 64, n=n, seed=seed, backend=backend, profiles=profiles)
                    kernel = Kernel(world, prog.consts, prog.laws)
                    W, H = kernel.world.w, kernel.world.h
                    DT = kernel.world.dt
                    world = seed_world(W, H, n=n, seed=seed, backend=backend, profiles=profiles)
                    world.dt = DT
                    kernel = Kernel(world, prog.consts, prog.laws)
                else:
                    raise
            self.kernel = kernel
            self.last_frame = self._make_frame()

    def set_run(self, value: bool):
        self.running = value

    def set_rate(self, tick_ms: int, steps: int):
        self.tick_ms = tick_ms
        self.steps = steps

    async def step(self):
        if not self.kernel:
            return
        start = time.perf_counter()
        for _ in range(max(1, self.steps)):
            self.kernel.tick(observer_xy=None, observer_radius=55)
        elapsed = (time.perf_counter() - start) * 1000.0
        frame = self._make_frame()
        self.last_frame = frame
        await self._persist(frame, elapsed)

    def _finite(self, value: Any, default: float = 0.0) -> float:
        try:
            num = float(value)
        except (TypeError, ValueError):
            return default
        if not math.isfinite(num):
            return default
        return num

    def _kind_from_color(self, color: str) -> str:
        key = (color or "").strip().lower()
        mapping = {
            "human": "humanoid",
            "settler": "humanoid",
            "fae": "humanoid",
            "tribe": "humanoid",
            "pilot": "humanoid",
            "animal": "animal",
            "fauna": "animal",
            "beast": "animal",
            "raptor": "animal",
            "alien": "alien",
            "outsider": "alien",
            "voidborn": "alien",
            "building": "building",
            "habitat": "building",
            "obelisk": "building",
            "station": "building",
            "tree": "tree",
            "grove": "tree",
            "cycad": "tree",
            "dino": "dino",
            "saurian": "dino",
            "wyrm": "dino",
            "metal": "machine",
            "gold": "machine",
            "synth": "machine",
        }
        return mapping.get(key, "creature")

    def _make_frame(self) -> Frame:
        kernel = self.kernel
        if not kernel:
            return Frame(t=0.0, w=1, h=1, entities=[])
        ents: List[Dict[str, Any]] = []
        for e in kernel.world.entities:
            if not e.alive:
                continue
            ents.append({
                "id": int(e.id),
                "x": self._finite(e.x),
                "y": self._finite(e.y),
                "z": self._finite(e.z),
                "vx": self._finite(e.vx),
                "vy": self._finite(e.vy),
                "vz": self._finite(e.vz),
                "mass": self._finite(e.mass),
                "hardness": self._finite(e.hardness),
                "color": str(e.color),
                "kind": self._kind_from_color(str(e.color)),
                "size": self._finite(3.0 + self._finite(e.hardness) * 0.6, 3.0),
                "energy": self._finite(e.energy),
                "wealth": self._finite(e.wealth),
            })
        return Frame(
            t=self._finite(kernel.world.time),
            w=int(kernel.world.w),
            h=int(kernel.world.h),
            entities=ents,
        )

    def frame_payload(self) -> Dict[str, Any] | None:
        frame = self.last_frame
        if frame is None:
            return None
        return {
            "t": self._finite(frame.t),
            "w": int(frame.w),
            "h": int(frame.h),
            "entities": frame.entities,
        }

    def fields_payload(self, step: int = 4) -> Dict[str, Any] | None:
        kernel = self.kernel
        if not kernel:
            return None
        step = max(1, int(step))
        backend = kernel.world.backend
        terrain = backend.asnumpy(kernel.world.terrain_field)[::step, ::step]
        water = backend.asnumpy(kernel.world.water_field)[::step, ::step]
        fertility = backend.asnumpy(kernel.world.fertility_field)[::step, ::step]
        climate = backend.asnumpy(kernel.world.climate_field)[::step, ::step]
        return {
            "step": step,
            "w": int(kernel.world.w),
            "h": int(kernel.world.h),
            "grid_w": int(terrain.shape[1]),
            "grid_h": int(terrain.shape[0]),
            "terrain": terrain.astype(float).tolist(),
            "water": water.astype(float).tolist(),
            "fertility": fertility.astype(float).tolist(),
            "climate": climate.astype(float).tolist(),
        }

    async def _persist(self, frame: Frame, elapsed_ms: float):
        now = time.time()
        if now - self._last_emit < self._persist_every:
            return
        self._last_emit = now
        payload = json.dumps({
            "t": frame.t,
            "w": frame.w,
            "h": frame.h,
            "entities": frame.entities,
        }, allow_nan=False)
        with SessionLocal() as session:
            session.add(Snapshot(t=frame.t, payload=payload))
            session.add(Metric(t=frame.t, elapsed_ms=elapsed_ms, steps=self.steps))
            session.commit()

    async def loop(self):
        while True:
            if self.running:
                try:
                    await self.step()
                except Exception:
                    logger.exception("Simulation step failed; pausing.")
                    if self.kernel and self.kernel.world.backend.name == "gpu":
                        disable_gpu()
                    self.running = False
            await asyncio.sleep(self.tick_ms / 1000.0)
