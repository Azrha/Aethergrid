from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, List

from .backend import Backend, get_backend
import math

@dataclass
class Entity:
    id: int
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    mass: float
    hardness: float
    color: str
    age: float = 0.0
    seen: float = 1.0
    alive: bool = True
    sound: float = 0.0
    energy: float = 1.0
    wealth: float = 0.0

    def as_env(self) -> Dict[str, Any]:
        return {
            "x": self.x, "y": self.y, "z": self.z,
            "vx": self.vx, "vy": self.vy, "vz": self.vz,
            "mass": self.mass, "hardness": self.hardness, "color": self.color,
            "age": self.age, "seen": self.seen, "alive": self.alive, "sound": self.sound,
            "energy": self.energy, "wealth": self.wealth,
            "true": True, "false": False,
        }

    def apply_env(self, env: Dict[str, Any]) -> None:
        self.x = float(env.get("x", self.x))
        self.y = float(env.get("y", self.y))
        self.z = float(env.get("z", self.z))
        self.vx = float(env.get("vx", self.vx))
        self.vy = float(env.get("vy", self.vy))
        self.vz = float(env.get("vz", self.vz))
        self.mass = float(env.get("mass", self.mass))
        self.hardness = float(env.get("hardness", self.hardness))
        self.seen = float(env.get("seen", self.seen))
        self.alive = bool(env.get("alive", self.alive))
        self.sound = float(env.get("sound", self.sound))
        self.energy = float(env.get("energy", self.energy))
        self.wealth = float(env.get("wealth", self.wealth))
        if "color" in env:
            self.color = str(env["color"])

@dataclass
class World:
    w: int
    h: int
    dt: float
    time: float = 0.0
    entities: List[Entity] = None
    sound_field: Any = None
    paradox_heat: Any = None
    backend: Backend | None = None
    trail_field: Any = None
    food_field: Any = None
    terrain_field: Any = None
    water_field: Any = None
    fertility_field: Any = None
    climate_field: Any = None
    road_field: Any = None
    settlement_field: Any = None
    home_field: Any = None
    farm_field: Any = None
    market_field: Any = None
    day_cycle: float = 0.0
    weather_cycle: float = 0.0
    season_cycle: float = 0.0
    wind_x: float = 0.0
    wind_y: float = 0.0

    def __post_init__(self):
        if self.backend is None:
            self.backend = get_backend(False)
        if self.entities is None:
            self.entities = []
        if self.sound_field is None:
            self.sound_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.paradox_heat is None:
            self.paradox_heat = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.trail_field is None:
            self.trail_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.food_field is None:
            self.food_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.terrain_field is None:
            self.terrain_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.water_field is None:
            self.water_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.fertility_field is None:
            self.fertility_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.climate_field is None:
            self.climate_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.road_field is None:
            self.road_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.settlement_field is None:
            self.settlement_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.home_field is None:
            self.home_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.farm_field is None:
            self.farm_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)
        if self.market_field is None:
            self.market_field = self.backend.zeros((self.h, self.w), dtype=self.backend.xp.float32)

    def step_integrate(self, dt: float | None = None):
        step_dt = self.dt if dt is None else float(dt)
        self.time += step_dt

        self.sound_field *= 0.92
        sf = self.sound_field
        sf[:] = (
            sf
            + self.backend.roll(sf, 1, 0)
            + self.backend.roll(sf, -1, 0)
            + self.backend.roll(sf, 1, 1)
            + self.backend.roll(sf, -1, 1)
        ) / 5.0

        self.food_field *= 0.95
        ff = self.food_field
        ff[:] = (
            ff
            + self.backend.roll(ff, 1, 0)
            + self.backend.roll(ff, -1, 0)
            + self.backend.roll(ff, 1, 1)
            + self.backend.roll(ff, -1, 1)
        ) / 5.0
        if self.season_cycle and self.season_cycle > 0:
            season = 0.5 + 0.5 * math.sin((self.time / self.season_cycle) * 2.0 * math.pi)
        else:
            season = 0.7
        self.food_field += self.fertility_field * (0.012 + 0.02 * season)
        self.food_field[:] = self.backend.clip(self.food_field, 0.0, 2.0)

        self.water_field *= 0.985
        wf = self.water_field
        wf[:] = (
            wf
            + self.backend.roll(wf, 1, 0)
            + self.backend.roll(wf, -1, 0)
            + self.backend.roll(wf, 1, 1)
            + self.backend.roll(wf, -1, 1)
        ) / 5.0
        if self.weather_cycle and self.weather_cycle > 0:
            rain = 0.5 + 0.5 * math.sin((self.time / self.weather_cycle) * 2.0 * math.pi)
        else:
            rain = 0.2
        self.water_field += self.climate_field * (0.004 + 0.012 * rain)
        self._flow_water()
        self.water_field[:] = self.backend.clip(self.water_field, 0.0, 2.0)
        self.fertility_field += (self.water_field * 0.01) - (self.fertility_field * 0.004)
        self.fertility_field[:] = self.backend.clip(self.fertility_field, 0.0, 1.5)
        self.road_field *= 0.995
        self.settlement_field *= 0.997
        self.home_field *= 0.996
        self.farm_field *= 0.996
        self.market_field *= 0.996

        self.paradox_heat *= 0.96
        self.trail_field *= 0.92

        for e in self.entities:
            if not e.alive:
                continue
            e.x += e.vx * step_dt
            e.y += e.vy * step_dt
            e.z += e.vz * step_dt
            e.age += step_dt
            e.seen = max(0.0, e.seen - 0.01)

            ix = int(max(0, min(self.w-1, round(e.x))))
            iy = int(max(0, min(self.h-1, round(e.y))))
            e.sound = float(self.backend.asnumpy(self.sound_field[iy, ix]))
            self.trail_field[iy, ix] += 0.35

    def _flow_water(self):
        t = self.terrain_field
        w = self.water_field
        xp = self.backend.xp
        t_up = self.backend.roll(t, 1, 0)
        t_down = self.backend.roll(t, -1, 0)
        t_left = self.backend.roll(t, 1, 1)
        t_right = self.backend.roll(t, -1, 1)
        neighbors = xp.stack([t_up, t_down, t_left, t_right], axis=0)
        min_idx = xp.argmin(neighbors, axis=0)
        min_val = xp.min(neighbors, axis=0)
        mask = min_val < t
        flow = w * 0.04
        w[:] = w - flow * mask
        flow_up = flow * ((min_idx == 0) & mask)
        flow_down = flow * ((min_idx == 1) & mask)
        flow_left = flow * ((min_idx == 2) & mask)
        flow_right = flow * ((min_idx == 3) & mask)
        w[:] = w + self.backend.roll(flow_up, -1, 0)
        w[:] = w + self.backend.roll(flow_down, 1, 0)
        w[:] = w + self.backend.roll(flow_left, -1, 1)
        w[:] = w + self.backend.roll(flow_right, 1, 1)
