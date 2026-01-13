from __future__ import annotations
import random
from .model import World, Entity
from .backend import Backend, get_backend


def _range_or(value, fallback):
    if value is None:
        return list(fallback)
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return [value[0], value[1]]
    return list(fallback)

def seed_world(
    w: int,
    h: int,
    n: int = 120,
    seed: int = 42,
    backend: Backend | None = None,
    profiles: list[dict] | None = None,
) -> World:
    rng = random.Random(seed)
    world = World(w=w, h=h, dt=1.0, entities=[], backend=backend or get_backend(False))

    palette = ["red", "blue", "green", "metal", "gold", "gray"]
    if profiles:
        idx = 1
        for profile in profiles:
            count = int(profile.get("count", 0))
            color = str(profile.get("color", "gray"))
            mass_min, mass_max = _range_or(profile.get("mass_range"), (1.0, 1.4))
            hard_min, hard_max = _range_or(profile.get("hardness_range"), (0.5, 1.5))
            speed_min, speed_max = _range_or(profile.get("speed_range"), (-0.6, 0.6))
            energy_min, energy_max = _range_or(profile.get("energy_range"), (1.0, 1.0))
            wealth_min, wealth_max = _range_or(profile.get("wealth_range"), (0.0, 0.0))
            depth_min, depth_max = _range_or(profile.get("depth_range"), (0.0, 1.0))
            static = bool(profile.get("static", False))
            for _ in range(max(0, count)):
                x = rng.uniform(0, w - 1)
                y = rng.uniform(0, h - 1)
                z = rng.uniform(float(depth_min), float(depth_max))
                if static:
                    vx = vy = 0.0
                    vz = 0.0
                else:
                    vx = rng.uniform(speed_min, speed_max)
                    vy = rng.uniform(speed_min, speed_max)
                    vz = rng.uniform(speed_min, speed_max) * 0.3
                mass = rng.uniform(float(mass_min), float(mass_max))
                hardness = rng.uniform(float(hard_min), float(hard_max))
                energy = rng.uniform(float(energy_min), float(energy_max))
                wealth = rng.uniform(float(wealth_min), float(wealth_max))
                world.entities.append(
                    Entity(
                        id=idx,
                        x=x,
                        y=y,
                        z=z,
                        vx=vx,
                        vy=vy,
                        vz=vz,
                        mass=mass,
                        hardness=hardness,
                        color=color,
                        energy=energy,
                        wealth=wealth,
                    )
                )
                idx += 1
    else:
        for i in range(n):
            color = rng.choice(palette)
            x = rng.uniform(0, w-1)
            y = rng.uniform(0, h-1)
            z = rng.uniform(0.0, 1.0)
            vx = rng.uniform(-0.6, 0.6)
            vy = rng.uniform(-0.6, 0.6)
            vz = rng.uniform(-0.2, 0.2)
            mass = 1.0 + (0.8 if color == "metal" else 0.0) + rng.uniform(0.0, 0.6)
            hardness = 0.5 + (0.8 if color == "metal" else 0.0) + rng.uniform(0.0, 1.0)
            world.entities.append(Entity(
                id=i+1, x=x, y=y, z=z, vx=vx, vy=vy, vz=vz,
                mass=mass, hardness=hardness, color=color
            ))
    return world
