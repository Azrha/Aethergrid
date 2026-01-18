from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
import math
import base64
import re

from engine.backend import get_backend, disable_gpu
from engine.compiler import compile_program
from engine.safeexpr import eval_expr
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



    def save_world_preset(self, name: str, description: str, dsl: str, profiles: List[Dict[str, Any]], thumbnail_b64: str) -> str:
        base = Path("data/worlds")
        base.mkdir(parents=True, exist_ok=True)
        
        # Sanitize name for filename
        safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name).lower()
        if not safe_name:
            safe_name = f"world_{int(time.time())}"
            
        # Save JSON
        data = {
            "name": name,
            "description": description,
            "dsl": dsl,
            "profiles": profiles,
            "seed": 42, # Save current seed? Logic passed 42 usually. We can pass it if we want.
        }
        (base / f"{safe_name}.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        
        # Save Thumbnail
        if thumbnail_b64:
            try:
                # Remove header if present "data:image/png;base64,"
                if "," in thumbnail_b64:
                    thumbnail_b64 = thumbnail_b64.split(",", 1)[1]
                img_data = base64.b64decode(thumbnail_b64)
                (base / f"{safe_name}.png").write_bytes(img_data)
            except Exception as e:
                logger.error(f"Failed to save thumbnail: {e}")
                
        return safe_name

    def load_worldpack(self, name: str) -> Dict[str, Any]:
        # Check presets first
        preset_path = Path("examples/worldpacks") / name
        if not preset_path.exists() and not name.endswith(".json"):
             preset_path = Path("examples/worldpacks") / f"{name}.json"
             
        user_path = Path("data/worlds") / name
        if not user_path.exists() and not name.endswith(".json"):
             user_path = Path("data/worlds") / f"{name}.json"

        path = preset_path if preset_path.exists() else user_path
        
        if not path.exists():
            return {
                "name": "Unknown",
                "dsl": "",
                "profiles": [],
                "seed": 42
            }

        pack = load_worldpack_json(path.read_text(encoding="utf-8"))
        
        # safely get profiles, assuming they are already dicts in the JSON
        profiles = pack.get("profiles", [])
        mood = (
            pack.get("mood")
            or pack.get("consts", {}).get("MOOD")
            or self._infer_mood(pack.get("name", "") or name)
        )
        
        return {
            "name": pack.get("name", "Unknown"),
            "description": pack.get("description", ""),
            "dsl": worldpack_to_dsl(pack),
            "profiles": profiles,
            "seed": pack.get("seed", 42),
            "mood": mood,
        }

    def list_presets(self) -> List[Dict[str, Any]]:
        base = Path("examples/worldpacks")
        items = []
        for path in base.glob("*.json"):
            try:
                pack = load_worldpack_json(path.read_text(encoding="utf-8"))
                mood = (
                    pack.get("mood")
                    or pack.get("consts", {}).get("MOOD")
                    or self._infer_mood(pack.get("name", "") or path.stem)
                )
                items.append({
                    "id": path.name,
                    "name": pack.get("name", path.stem),
                    "description": pack.get("description", ""),
                    "seed": pack.get("seed", 42),
                    "mood": mood,
                })
            except Exception as e:
                logger.warning(f"Failed to load preset {path}: {e}")
        
        # Load User Worlds
        user_base = Path("data/worlds")
        if user_base.exists():
            for path in user_base.glob("*.json"):
                try:
                    pack = json.loads(path.read_text(encoding="utf-8"))
                    items.append({
                        "id": path.name, # filename as id
                        "name": pack.get("name", path.stem),
                        "description": pack.get("description", ""),
                        "seed": pack.get("seed", 42),
                        "mood": self._infer_mood(pack.get("name", "") or path.stem),
                        "is_user": True
                    })
                except Exception as e:
                    logger.warning(f"Failed to load user world {path}: {e}")

        return sorted(items, key=lambda x: x["name"])

    def _infer_mood(self, name: str) -> str:
        key = (name or "").lower()
        if "space" in key:
            return "space"
        if "fantasy" in key:
            return "fantasy"
        if "dino" in key:
            return "dino"
        if "ocean" in key:
            return "oceanic"
        if "frost" in key:
            return "frostbound"
        if "ember" in key:
            return "emberfall"
        if "sky" in key:
            return "skyborne"
        if "iron" in key:
            return "ironwild"
        return "living"

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
            scaled_profiles = self._scale_profiles(profiles, n)
            try:
                consts = prog.consts
                const_values: Dict[str, Any] = {}
                for key, expr in consts.items():
                    env = {"true": True, "false": False}
                    env.update(const_values)
                    const_values[key] = eval_expr(expr, env)
                W = int(const_values.get("W", 96))
                H = int(const_values.get("H", 96))
                world = seed_world(W, H, n=n, seed=seed, backend=backend, profiles=scaled_profiles)
                kernel = Kernel(world, consts, prog.laws)
                W, H = kernel.world.w, kernel.world.h
                DT = kernel.world.dt
                depth = int(const_values.get("D", const_values.get("DEPTH", 16)))
                terrain_seed = int(const_values.get("TERRAIN_SEED", seed))
                terrain_scale = float(const_values.get("TERRAIN_SCALE", 1.0))
                terrain_smooth = int(const_values.get("TERRAIN_SMOOTH", 4))
                sea_level = const_values.get("SEA_LEVEL", const_values.get("SEA", None))
                sea_level = float(sea_level) if sea_level is not None else None
                world = seed_world(
                    W,
                    H,
                    depth,
                    n=n,
                    seed=seed,
                    backend=backend,
                    profiles=scaled_profiles,
                    terrain_seed=terrain_seed,
                    terrain_scale=terrain_scale,
                    terrain_smooth=terrain_smooth,
                    sea_level=sea_level,
                )
                world.dt = DT
                kernel = Kernel(world, consts, prog.laws)
            except Exception:
                if use_gpu:
                    logger.exception("GPU apply failed; falling back to CPU.")
                    disable_gpu()
                    backend = get_backend(False)
                    consts = prog.consts
                    const_values: Dict[str, Any] = {}
                    for key, expr in consts.items():
                        env = {"true": True, "false": False}
                        env.update(const_values)
                        const_values[key] = eval_expr(expr, env)
                    W = int(const_values.get("W", 96))
                    H = int(const_values.get("H", 96))
                    world = seed_world(W, H, n=n, seed=seed, backend=backend, profiles=scaled_profiles)
                    kernel = Kernel(world, consts, prog.laws)
                    W, H = kernel.world.w, kernel.world.h
                    DT = kernel.world.dt
                    depth = int(const_values.get("D", const_values.get("DEPTH", 16)))
                    terrain_seed = int(const_values.get("TERRAIN_SEED", seed))
                    terrain_scale = float(const_values.get("TERRAIN_SCALE", 1.0))
                    terrain_smooth = int(const_values.get("TERRAIN_SMOOTH", 4))
                    sea_level = const_values.get("SEA_LEVEL", const_values.get("SEA", None))
                    sea_level = float(sea_level) if sea_level is not None else None
                    world = seed_world(
                        W,
                        H,
                        depth,
                        n=n,
                        seed=seed,
                        backend=backend,
                        profiles=scaled_profiles,
                        terrain_seed=terrain_seed,
                        terrain_scale=terrain_scale,
                        terrain_smooth=terrain_smooth,
                        sea_level=sea_level,
                    )
                    world.dt = DT
                    kernel = Kernel(world, consts, prog.laws)
                else:
                    raise
            self.kernel = kernel
            self.last_frame = self._make_frame()

    def set_run(self, value: bool):
        self.running = value

    def set_rate(self, tick_ms: int, steps: int):
        self.tick_ms = tick_ms
        self.steps = steps

    def _scale_profiles(
        self,
        profiles: Optional[List[Dict[str, Any]]],
        n: int,
    ) -> Optional[List[Dict[str, Any]]]:
        if not profiles or n <= 0:
            return profiles
        total = sum(int(p.get("count", 0)) for p in profiles)
        if total <= 0 or total == n:
            return profiles

        def apply_scale(items: List[Dict[str, Any]], target_total: int) -> List[Dict[str, Any]]:
            scaled: List[Dict[str, Any]] = []
            fractions: List[tuple[float, int]] = []
            counts = []
            running = 0
            item_total = sum(int(p.get("count", 0)) for p in items)
            for idx, profile in enumerate(items):
                count = int(profile.get("count", 0))
                scaled_count = count
                if item_total > 0:
                    scaled_count = count * (target_total / item_total)
                base = max(0, int(scaled_count))
                frac = scaled_count - base
                counts.append(base)
                fractions.append((frac, idx))
                running += base
                clone = dict(profile)
                clone["count"] = base
                scaled.append(clone)
            diff = target_total - running
            if diff > 0:
                for _, idx in sorted(fractions, key=lambda item: item[0], reverse=True)[:diff]:
                    scaled[idx]["count"] += 1
            elif diff < 0:
                remaining = abs(diff)
                for _, idx in sorted(fractions, key=lambda item: item[0]):
                    if remaining <= 0:
                        break
                    if scaled[idx]["count"] > 0:
                        scaled[idx]["count"] -= 1
                        remaining -= 1
            return scaled

        if n < total:
            return apply_scale(list(profiles), n)

        static_profiles = [p for p in profiles if p.get("static")]
        dynamic_profiles = [p for p in profiles if not p.get("static")]
        static_total = sum(int(p.get("count", 0)) for p in static_profiles)
        dynamic_total = sum(int(p.get("count", 0)) for p in dynamic_profiles)

        if dynamic_total <= 0:
            return profiles

        target_dynamic = max(n - static_total, 0)
        scaled_dynamic = apply_scale(dynamic_profiles, target_dynamic)
        return list(static_profiles) + scaled_dynamic

    def _step_sync(self) -> tuple[Frame, float]:
        if not self.kernel:
            return Frame(t=0.0, w=1, h=1, entities=[]), 0.0
        start = time.perf_counter()
        for _ in range(max(1, self.steps)):
            self.kernel.tick(observer_xy=None, observer_radius=55)
        elapsed = (time.perf_counter() - start) * 1000.0
        frame = self._make_frame()
        return frame, elapsed

    async def step(self):
        if not self.kernel:
            return
        async with self._lock:
            frame, elapsed = await asyncio.to_thread(self._step_sync)
            self.last_frame = frame
        try:
            from .brain_service import brain_service
            payload = self.frame_payload()
            if payload:
                brain_service.ingest_frame(payload)
        except Exception:
            logger.exception("Brain ingest failed")
        await asyncio.to_thread(self._persist_sync, frame, elapsed)

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

    def fields_payload(self, step: int = 4, voxels: bool = False, z_step: int = 1) -> Dict[str, Any] | None:
        kernel = self.kernel
        if not kernel:
            return None
        step = max(1, int(step))
        z_step = max(1, int(z_step))
        backend = kernel.world.backend
        terrain = backend.asnumpy(kernel.world.terrain_field)[::step, ::step]
        water = backend.asnumpy(kernel.world.water_field)[::step, ::step]
        fertility = backend.asnumpy(kernel.world.fertility_field)[::step, ::step]
        climate = backend.asnumpy(kernel.world.climate_field)[::step, ::step]
        payload = {
            "step": step,
            "w": int(kernel.world.w),
            "h": int(kernel.world.h),
            "d": int(kernel.world.d),
            "grid_w": int(terrain.shape[1]),
            "grid_h": int(terrain.shape[0]),
            "terrain": terrain.astype(float).tolist(),
            "water": water.astype(float).tolist(),
            "fertility": fertility.astype(float).tolist(),
            "climate": climate.astype(float).tolist(),
        }
        if voxels:
            vox = backend.asnumpy(kernel.world.voxel_field)[::z_step, ::step, ::step]
            payload["voxels"] = vox.astype(int).tolist()
            payload["voxel_step"] = {"x": step, "y": step, "z": z_step}
        return payload

    def apply_ai_actions(self, actions: List[Dict[str, Any]]) -> None:
        if not self.kernel or not actions:
            return
        world = self.kernel.world
        max_speed = float(self.kernel.consts.get("MAX_SPEED", 1.2)) if hasattr(self.kernel, "consts") else 1.2
        for action in actions:
            try:
                entity_id = int(action.get("entity_id", 0))
            except (TypeError, ValueError):
                continue
            entity = next((e for e in world.entities if e.id == entity_id and e.alive), None)
            if not entity:
                continue
            kind = str(action.get("action", "")).lower()
            payload = action.get("payload", {}) or {}

            if kind == "move_to":
                try:
                    tx = float(payload.get("x", entity.x))
                    ty = float(payload.get("y", entity.y))
                    tz = payload.get("z", None)
                except (TypeError, ValueError):
                    continue
                tx = max(0.0, min(world.w - 1, tx))
                ty = max(0.0, min(world.h - 1, ty))
                dx = tx - entity.x
                dy = ty - entity.y
                dist = math.hypot(dx, dy)
                if dist > 0.01:
                    speed = min(max_speed, 0.9)
                    entity.vx = (dx / dist) * speed
                    entity.vy = (dy / dist) * speed
                if tz is not None:
                    try:
                        tz_val = float(tz)
                    except (TypeError, ValueError):
                        tz_val = entity.z
                    tz_val = max(0.0, min(world.d - 1, tz_val))
                    dz = tz_val - entity.z
                    if abs(dz) > 0.01:
                        entity.vz = max(-max_speed, min(max_speed, dz * 0.5))
            elif kind == "wait":
                entity.vx = 0.0
                entity.vy = 0.0
            elif kind in {"say", "emote", "interact"}:
                from .ollama_service import ollama_service
                if kind == "say":
                    text = str(payload.get("text", "")).strip()
                    if text:
                        ollama_service.queue_thought(entity.id, text, is_speech=True, duration_ms=3200)
                elif kind == "emote":
                    text = str(payload.get("type", "")).strip()
                    if text:
                        ollama_service.queue_thought(entity.id, text, is_speech=False, duration_ms=2600)
                elif kind == "interact":
                    verb = str(payload.get("verb", "")).strip() or "interacts"
                    ollama_service.queue_thought(entity.id, verb, is_speech=True, duration_ms=2600)

    def _persist_sync(self, frame: Frame, elapsed_ms: float) -> None:
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
