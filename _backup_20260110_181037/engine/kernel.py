from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, List, Tuple
import math
import random
import numpy as np

from .model import World, Entity
from .laws import Law, Action
from .safeexpr import eval_expr
from .paradox import dynamic_instability_flags

@dataclass
class RuntimeConfig:
    max_speed: float = 4.0
    substeps: int = 1

class Kernel:
    def __init__(self, world: World, consts: Dict[str, Any], laws: List[Law]):
        self.world = world
        self.consts_expr = consts
        self.laws = sorted(laws, key=lambda l: l.priority, reverse=True)
        self.consts: Dict[str, Any] = {}
        self.cfg = RuntimeConfig(max_speed=4.0)
        self._compile_consts()

    def _compile_consts(self):
        env = {"true": True, "false": False}
        for k, expr in self.consts_expr.items():
            env.update(self.consts)
            self.consts[k] = eval_expr(expr, env)

        if "MAX_SPEED" in self.consts:
            try:
                self.cfg.max_speed = float(self.consts["MAX_SPEED"])
            except Exception:
                pass
        if "SUBSTEPS" in self.consts:
            try:
                self.cfg.substeps = max(1, int(float(self.consts["SUBSTEPS"])))
            except Exception:
                self.cfg.substeps = 1

        if "W" in self.consts:
            self.world.w = int(float(self.consts["W"]))
        if "H" in self.consts:
            self.world.h = int(float(self.consts["H"]))
        if "DT" in self.consts:
            self.world.dt = float(self.consts["DT"])
        if "DAY_CYCLE" in self.consts:
            try:
                self.world.day_cycle = float(self.consts["DAY_CYCLE"])
            except Exception:
                self.world.day_cycle = 0.0
        if "WEATHER_CYCLE" in self.consts:
            try:
                self.world.weather_cycle = float(self.consts["WEATHER_CYCLE"])
            except Exception:
                self.world.weather_cycle = 0.0
        if "SEASON_CYCLE" in self.consts:
            try:
                self.world.season_cycle = float(self.consts["SEASON_CYCLE"])
            except Exception:
                self.world.season_cycle = 0.0
        if "WIND_X" in self.consts:
            try:
                self.world.wind_x = float(self.consts["WIND_X"])
            except Exception:
                self.world.wind_x = 0.0
        if "WIND_Y" in self.consts:
            try:
                self.world.wind_y = float(self.consts["WIND_Y"])
            except Exception:
                self.world.wind_y = 0.0

        self.world.sound_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.paradox_heat = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.trail_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.food_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.terrain_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.water_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.fertility_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.climate_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.road_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.settlement_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.home_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.farm_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self.world.market_field = self.world.backend.zeros(
            (self.world.h, self.world.w),
            dtype=self.world.backend.xp.float32,
        )
        self._init_terrain()

    def _init_terrain(self):
        if "TERRAIN_SEED" not in self.consts:
            return
        try:
            seed = int(float(self.consts.get("TERRAIN_SEED", 0)))
        except Exception:
            seed = 0
        scale = float(self.consts.get("TERRAIN_SCALE", 1.0))
        smooth = int(float(self.consts.get("TERRAIN_SMOOTH", 4)))
        xp = self.world.backend.xp
        rng = xp.random.RandomState(seed)
        field = rng.rand(self.world.h, self.world.w).astype(xp.float32)
        for _ in range(max(1, smooth)):
            field = (
                field
                + self.world.backend.roll(field, 1, 0)
                + self.world.backend.roll(field, -1, 0)
                + self.world.backend.roll(field, 1, 1)
                + self.world.backend.roll(field, -1, 1)
            ) / 5.0
        self.world.terrain_field[:] = field * scale
        water = self.world.backend.clip(0.6 - self.world.terrain_field, 0.0, 1.0)
        fertility = 0.3 + (1.0 - self.world.backend.clip(abs(self.world.terrain_field - 0.5) * 2.0, 0.0, 1.0)) * 0.9
        self.world.water_field[:] = water
        self.world.fertility_field[:] = fertility
        yy = self.world.backend.xp.linspace(0.0, 1.0, self.world.h, dtype=self.world.backend.xp.float32)[:, None]
        climate = 1.0 - self.world.backend.clip(abs(yy - 0.5) * 2.0, 0.0, 1.0)
        climate = climate * (0.6 + 0.4 * (1.0 - self.world.backend.clip(field, 0.0, 1.0)))
        self.world.climate_field[:] = climate

    def tick(self, observer_xy: Tuple[int,int] | None = None, observer_radius: int = 55):
        if observer_xy is not None:
            ox, oy = observer_xy
            r2 = observer_radius * observer_radius
            for e in self.world.entities:
                if not e.alive:
                    continue
                dx = e.x - ox
                dy = e.y - oy
                if dx*dx + dy*dy <= r2:
                    e.seen = 1.0

        substeps = max(1, self.cfg.substeps)
        step_dt = self.world.dt / substeps
        for _ in range(substeps):
            for e in self.world.entities:
                if not e.alive:
                    continue

                for law in self.laws:
                    if not e.alive:
                        break
                    env = e.as_env()
                    env.update(self.consts)
                    env["terrain"] = self._sample_terrain(e.x, e.y)
                    env["water"] = self._sample_water(e.x, e.y)
                    env["fertility"] = self._sample_fertility(e.x, e.y)
                    env["climate"] = self._sample_climate(e.x, e.y)
                    env["road"] = self._sample_road(e.x, e.y)
                    env["settlement"] = self._sample_settlement(e.x, e.y)
                    env["home"] = self._sample_home(e.x, e.y)
                    env["farm"] = self._sample_farm(e.x, e.y)
                    env["market"] = self._sample_market(e.x, e.y)
                    env["latitude"] = float(e.y) / max(1.0, float(self.world.h))
                    if self.world.season_cycle and self.world.season_cycle > 0:
                        env["season"] = 0.5 + 0.5 * math.sin((self.world.time / self.world.season_cycle) * 2.0 * math.pi)
                    else:
                        env["season"] = 0.7
                    if self.world.weather_cycle and self.world.weather_cycle > 0:
                        env["rain"] = 0.5 + 0.5 * math.sin((self.world.time / self.world.weather_cycle) * 2.0 * math.pi)
                    else:
                        env["rain"] = 0.2

                    ok = bool(eval_expr(law.when, env))
                    if not ok:
                        continue

                    for a in law.actions:
                        if a.kind == "assign":
                            val = eval_expr(a.expr, env)
                            cur = env.get(a.name)
                            if a.op == "=":
                                env[a.name] = val
                            elif a.op == "+=":
                                env[a.name] = cur + val
                            elif a.op == "-=":
                                env[a.name] = cur - val
                            elif a.op == "*=":
                                env[a.name] = cur * val
                            elif a.op == "/=":
                                env[a.name] = cur / val if val != 0 else cur
                        else:
                            self._call(a.name, a.args or [], env, e)

                    e.apply_env(env)

            self.world.step_integrate(dt=step_dt)

        speed_score, sound_score = dynamic_instability_flags(self.world, self.cfg.max_speed)
        if speed_score > 0 or sound_score > 0:
            self.world.paradox_heat[:] += float(speed_score + sound_score) * 0.15
            self.world.paradox_heat[:] = self.world.backend.clip(self.world.paradox_heat, 0.0, 1.0)

    def _call(self, name: str, args, env: Dict[str, Any], e: Entity):
        avals = [eval_expr(x, env) for x in args]

        if name == "emit_sound":
            amt = float(avals[0]) if avals else 0.1
            env["sound"] = float(env.get("sound", 0.0)) + amt
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.sound_field[iy, ix] += amt

        elif name == "emit_food":
            amt = float(avals[0]) if avals else 0.1
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.food_field[iy, ix] += amt

        elif name == "consume_food":
            if avals:
                rate = float(avals[0])
                gain = float(avals[1]) if len(avals) >= 2 else 1.0
            else:
                rate = 0.05
                gain = 1.0
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            available = float(self.world.backend.asnumpy(self.world.food_field[iy, ix]))
            take = min(rate, max(0.0, available))
            if take > 0:
                self.world.food_field[iy, ix] -= take
                env["energy"] = float(env.get("energy", e.energy)) + take * gain

        elif name == "metabolize":
            rate = float(avals[0]) if avals else 0.005
            env["energy"] = float(env.get("energy", e.energy)) - rate

        elif name == "wind":
            strength = float(avals[0]) if avals else 1.0
            env["vx"] = float(env.get("vx", e.vx)) + self.world.wind_x * strength
            env["vy"] = float(env.get("vy", e.vy)) + self.world.wind_y * strength

        elif name == "gust":
            strength = float(avals[0]) if avals else 0.2
            env["vx"] = float(env.get("vx", e.vx)) + (random.random() - 0.5) * strength + self.world.wind_x
            env["vy"] = float(env.get("vy", e.vy)) + (random.random() - 0.5) * strength + self.world.wind_y

        elif name == "emit_water":
            amt = float(avals[0]) if avals else 0.1
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.water_field[iy, ix] += amt

        elif name == "consume_water":
            if avals:
                rate = float(avals[0])
                gain = float(avals[1]) if len(avals) >= 2 else 0.5
            else:
                rate = 0.05
                gain = 0.5
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            available = float(self.world.backend.asnumpy(self.world.water_field[iy, ix]))
            take = min(rate, max(0.0, available))
            if take > 0:
                self.world.water_field[iy, ix] -= take
                env["energy"] = float(env.get("energy", e.energy)) + take * gain

        elif name == "emit_road":
            amt = float(avals[0]) if avals else 0.05
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.road_field[iy, ix] += amt

        elif name == "follow_road":
            strength = float(avals[0]) if avals else 0.05
            gx, gy = self._field_gradient(self.world.road_field, e.x, e.y)
            env["vx"] = float(env.get("vx", e.vx)) + gx * strength
            env["vy"] = float(env.get("vy", e.vy)) + gy * strength

        elif name == "emit_settlement":
            amt = float(avals[0]) if avals else 0.05
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.settlement_field[iy, ix] += amt

        elif name == "emit_home":
            amt = float(avals[0]) if avals else 0.04
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.home_field[iy, ix] += amt

        elif name == "emit_farm":
            amt = float(avals[0]) if avals else 0.05
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.farm_field[iy, ix] += amt

        elif name == "emit_market":
            amt = float(avals[0]) if avals else 0.05
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            self.world.market_field[iy, ix] += amt

        elif name == "seek_home":
            strength = float(avals[0]) if avals else 0.05
            gx, gy = self._field_gradient(self.world.home_field, e.x, e.y)
            env["vx"] = float(env.get("vx", e.vx)) + gx * strength
            env["vy"] = float(env.get("vy", e.vy)) + gy * strength

        elif name == "seek_farm":
            strength = float(avals[0]) if avals else 0.05
            gx, gy = self._field_gradient(self.world.farm_field, e.x, e.y)
            env["vx"] = float(env.get("vx", e.vx)) + gx * strength
            env["vy"] = float(env.get("vy", e.vy)) + gy * strength

        elif name == "seek_market":
            strength = float(avals[0]) if avals else 0.05
            gx, gy = self._field_gradient(self.world.market_field, e.x, e.y)
            env["vx"] = float(env.get("vx", e.vx)) + gx * strength
            env["vy"] = float(env.get("vy", e.vy)) + gy * strength

        elif name == "trade":
            rate = float(avals[0]) if avals else 0.02
            ex = float(env.get("x", e.x))
            ey = float(env.get("y", e.y))
            ix = int(max(0, min(self.world.w-1, round(ex))))
            iy = int(max(0, min(self.world.h-1, round(ey))))
            market = float(self.world.backend.asnumpy(self.world.market_field[iy, ix]))
            if market > 0.2:
                energy = float(env.get("energy", e.energy))
                wealth = float(env.get("wealth", e.wealth))
                if energy > 0.3:
                    env["energy"] = energy - rate * 0.5
                    env["wealth"] = wealth + rate
                else:
                    env["wealth"] = max(0.0, wealth - rate * 0.5)

        elif name in ("attract", "repel"):
            radius = float(avals[0])
            strength = float(avals[1])
            selector_expr = args[2] if len(args) >= 3 else None
            self._field_pull(env, e, radius, strength, selector_expr, mode=name)

        elif name == "decay_unseen":
            rate = float(avals[0]) if avals else 0.01
            if float(env.get("seen", 0.0)) <= 0.2:
                ex = float(env.get("x", e.x))
                ey = float(env.get("y", e.y))
                age = float(env.get("age", e.age))
                r = (math.sin(age*12.345 + ex*0.17 + ey*0.31) + 1.0) * 0.5
                if r < rate:
                    env["alive"] = False

        elif name == "fade_color":
            rate = float(avals[0]) if avals else 0.02
            if env.get("color", e.color) != "gray" and float(env.get("seen", 0.0)) < 0.6:
                age = float(env.get("age", e.age))
                r = (math.sin(age*3.21) + 1.0) * 0.5
                if r < rate:
                    env["color"] = "gray"

        elif name == "clamp_speed":
            ms = float(avals[0]) if avals else self.cfg.max_speed
            vx = float(env.get("vx", e.vx))
            vy = float(env.get("vy", e.vy))
            v = (vx*vx + vy*vy) ** 0.5
            if v > ms and v > 0:
                s = ms / v
                env["vx"] = vx * s
                env["vy"] = vy * s

        elif name == "drag":
            rate = float(avals[0]) if avals else 0.02
            vx = float(env.get("vx", e.vx))
            vy = float(env.get("vy", e.vy))
            damp = max(0.0, min(1.0, 1.0 - rate))
            env["vx"] = vx * damp
            env["vy"] = vy * damp

        elif name == "bounce":
            if len(avals) >= 3:
                W = int(float(avals[0]))
                H = int(float(avals[1]))
                restitution = float(avals[2])
            elif len(avals) == 2:
                W = int(float(avals[0]))
                H = int(float(avals[1]))
                restitution = 0.9
            elif len(avals) == 1:
                W = self.world.w
                H = self.world.h
                restitution = float(avals[0])
            else:
                W = self.world.w
                H = self.world.h
                restitution = 0.9
            restitution = max(0.0, min(1.5, restitution))
            x = float(env.get("x", e.x))
            y = float(env.get("y", e.y))
            vx = float(env.get("vx", e.vx))
            vy = float(env.get("vy", e.vy))
            max_x = max(0.0, W - 1.0)
            max_y = max(0.0, H - 1.0)
            if x < 0.0:
                x = 0.0
                vx = abs(vx) * restitution
            elif x > max_x:
                x = max_x
                vx = -abs(vx) * restitution
            if y < 0.0:
                y = 0.0
                vy = abs(vy) * restitution
            elif y > max_y:
                y = max_y
                vy = -abs(vy) * restitution
            env["x"] = x
            env["y"] = y
            env["vx"] = vx
            env["vy"] = vy

        elif name == "collide":
            if len(avals) >= 3:
                radius = float(avals[0])
                restitution = float(avals[1])
                friction = float(avals[2])
            elif len(avals) == 2:
                radius = float(avals[0])
                restitution = float(avals[1])
                friction = 0.1
            elif len(avals) == 1:
                radius = float(avals[0])
                restitution = 0.85
                friction = 0.1
            else:
                radius = 3.0
                restitution = 0.85
                friction = 0.1
            self._collide_entity(env, e, radius, restitution, friction)

        elif name == "wander":
            strength = float(avals[0]) if avals else 0.05
            env["vx"] = float(env.get("vx", e.vx)) + (random.random() - 0.5) * strength
            env["vy"] = float(env.get("vy", e.vy)) + (random.random() - 0.5) * strength

        elif name == "seek":
            if len(avals) >= 3:
                tx = float(avals[0])
                ty = float(avals[1])
                strength = float(avals[2])
                self._seek(env, e, tx, ty, strength)

        elif name == "avoid":
            if len(avals) >= 3:
                tx = float(avals[0])
                ty = float(avals[1])
                strength = float(avals[2])
                self._seek(env, e, tx, ty, -abs(strength))

        elif name == "cohere":
            radius = float(avals[0]) if len(avals) >= 1 else 20.0
            strength = float(avals[1]) if len(avals) >= 2 else 0.05
            selector_expr = args[2] if len(args) >= 3 else None
            self._boid_cohere(env, e, radius, strength, selector_expr)

        elif name == "align":
            radius = float(avals[0]) if len(avals) >= 1 else 20.0
            strength = float(avals[1]) if len(avals) >= 2 else 0.05
            selector_expr = args[2] if len(args) >= 3 else None
            self._boid_align(env, e, radius, strength, selector_expr)

        elif name == "separate":
            radius = float(avals[0]) if len(avals) >= 1 else 10.0
            strength = float(avals[1]) if len(avals) >= 2 else 0.08
            selector_expr = args[2] if len(args) >= 3 else None
            self._boid_separate(env, e, radius, strength, selector_expr)

        elif name == "wrap":
            if len(avals) >= 2:
                W = int(float(avals[0]))
                H = int(float(avals[1]))
            else:
                W = self.world.w
                H = self.world.h
            env["x"] = float(env.get("x", e.x)) % W
            env["y"] = float(env.get("y", e.y)) % H

    def _field_pull(self, env: Dict[str, Any], e: Entity, radius: float, strength: float, selector_expr, mode: str):
        r2 = radius * radius
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        vx = float(env.get("vx", e.vx))
        vy = float(env.get("vy", e.vy))
        mass = float(env.get("mass", e.mass))
        for other in self.world.entities:
            if (not other.alive) or other.id == e.id:
                continue
            dx = other.x - ex
            dy = other.y - ey
            d2 = dx*dx + dy*dy
            if d2 <= 1e-6 or d2 > r2:
                continue

            if selector_expr is not None:
                oenv = other.as_env()
                oenv.update(self.consts)
                if not bool(eval_expr(selector_expr, oenv)):
                    continue

            inv = 1.0 / (d2 + 8.0)
            fx = dx * inv * strength
            fy = dy * inv * strength
            if mode == "repel":
                fx, fy = -fx, -fy

            vx += fx / max(0.1, mass)
            vy += fy / max(0.1, mass)

        env["vx"] = vx
        env["vy"] = vy

    def _sample_terrain(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.terrain_field[iy, ix]))

    def _sample_water(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.water_field[iy, ix]))

    def _sample_fertility(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.fertility_field[iy, ix]))

    def _sample_climate(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.climate_field[iy, ix]))

    def _sample_road(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.road_field[iy, ix]))

    def _sample_settlement(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.settlement_field[iy, ix]))

    def _sample_home(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.home_field[iy, ix]))

    def _sample_farm(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.farm_field[iy, ix]))

    def _sample_market(self, x: float, y: float) -> float:
        ix = int(max(0, min(self.world.w - 1, round(x))))
        iy = int(max(0, min(self.world.h - 1, round(y))))
        return float(self.world.backend.asnumpy(self.world.market_field[iy, ix]))

    def _field_gradient(self, field, x: float, y: float) -> tuple[float, float]:
        ix = int(max(1, min(self.world.w - 2, round(x))))
        iy = int(max(1, min(self.world.h - 2, round(y))))
        xp = self.world.backend.xp
        gx = float(self.world.backend.asnumpy(field[iy, ix + 1] - field[iy, ix - 1]))
        gy = float(self.world.backend.asnumpy(field[iy + 1, ix] - field[iy - 1, ix]))
        return gx, gy

    def _seek(self, env: Dict[str, Any], e: Entity, tx: float, ty: float, strength: float):
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        vx = float(env.get("vx", e.vx))
        vy = float(env.get("vy", e.vy))
        dx = tx - ex
        dy = ty - ey
        d2 = dx * dx + dy * dy
        if d2 <= 1e-6:
            return
        inv = 1.0 / (math.sqrt(d2) + 1e-6)
        vx += dx * inv * strength
        vy += dy * inv * strength
        env["vx"] = vx
        env["vy"] = vy

    def _boid_cohere(self, env: Dict[str, Any], e: Entity, radius: float, strength: float, selector_expr):
        r2 = radius * radius
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        cx = cy = 0.0
        count = 0
        for other in self.world.entities:
            if (not other.alive) or other.id == e.id:
                continue
            dx = other.x - ex
            dy = other.y - ey
            d2 = dx * dx + dy * dy
            if d2 > r2:
                continue
            if selector_expr is not None:
                oenv = other.as_env()
                oenv.update(self.consts)
                if not bool(eval_expr(selector_expr, oenv)):
                    continue
            cx += other.x
            cy += other.y
            count += 1
        if count > 0:
            cx /= count
            cy /= count
            self._seek(env, e, cx, cy, strength)

    def _boid_align(self, env: Dict[str, Any], e: Entity, radius: float, strength: float, selector_expr):
        r2 = radius * radius
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        avx = avy = 0.0
        count = 0
        for other in self.world.entities:
            if (not other.alive) or other.id == e.id:
                continue
            dx = other.x - ex
            dy = other.y - ey
            d2 = dx * dx + dy * dy
            if d2 > r2:
                continue
            if selector_expr is not None:
                oenv = other.as_env()
                oenv.update(self.consts)
                if not bool(eval_expr(selector_expr, oenv)):
                    continue
            avx += other.vx
            avy += other.vy
            count += 1
        if count > 0:
            avx /= count
            avy /= count
            env["vx"] = float(env.get("vx", e.vx)) + (avx - e.vx) * strength
            env["vy"] = float(env.get("vy", e.vy)) + (avy - e.vy) * strength

    def _boid_separate(self, env: Dict[str, Any], e: Entity, radius: float, strength: float, selector_expr):
        r2 = radius * radius
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        vx = float(env.get("vx", e.vx))
        vy = float(env.get("vy", e.vy))
        count = 0
        for other in self.world.entities:
            if (not other.alive) or other.id == e.id:
                continue
            dx = ex - other.x
            dy = ey - other.y
            d2 = dx * dx + dy * dy
            if d2 <= 1e-6 or d2 > r2:
                continue
            if selector_expr is not None:
                oenv = other.as_env()
                oenv.update(self.consts)
                if not bool(eval_expr(selector_expr, oenv)):
                    continue
            inv = 1.0 / (math.sqrt(d2) + 1e-6)
            vx += dx * inv * strength
            vy += dy * inv * strength
            count += 1
        if count > 0:
            env["vx"] = vx
            env["vy"] = vy

    def _collide_entity(self, env: Dict[str, Any], e: Entity, radius: float, restitution: float, friction: float):
        ex = float(env.get("x", e.x))
        ey = float(env.get("y", e.y))
        evx = float(env.get("vx", e.vx))
        evy = float(env.get("vy", e.vy))
        mass = max(0.1, float(env.get("mass", e.mass)))
        r = max(0.5, radius)
        min_d = r * 2.0
        min_d2 = min_d * min_d
        restitution = max(0.0, min(1.5, restitution))
        friction = max(0.0, min(1.0, friction))

        for other in self.world.entities:
            if (not other.alive) or other.id <= e.id:
                continue
            dx = other.x - ex
            dy = other.y - ey
            d2 = dx * dx + dy * dy
            if d2 <= 1e-9 or d2 > min_d2:
                continue

            d = math.sqrt(d2)
            nx = dx / d
            ny = dy / d

            overlap = min_d - d
            if overlap > 0:
                push = overlap * 0.5
                ex -= nx * push
                ey -= ny * push
                other.x += nx * push
                other.y += ny * push

            ovx = other.vx
            ovy = other.vy
            omass = max(0.1, other.mass)
            rvx = ovx - evx
            rvy = ovy - evy
            vn = rvx * nx + rvy * ny
            if vn < 0:
                inv_mass = (1.0 / mass) + (1.0 / omass)
                j = -(1.0 + restitution) * vn / inv_mass
                impulse_x = j * nx
                impulse_y = j * ny
                evx -= impulse_x / mass
                evy -= impulse_y / mass
                other.vx += impulse_x / omass
                other.vy += impulse_y / omass

                tx = -ny
                ty = nx
                vt = rvx * tx + rvy * ty
                jt = -friction * vt / inv_mass
                evx -= (jt * tx) / mass
                evy -= (jt * ty) / mass
                other.vx += (jt * tx) / omass
                other.vy += (jt * ty) / omass

        env["x"] = ex
        env["y"] = ey
        env["vx"] = evx
        env["vy"] = evy
