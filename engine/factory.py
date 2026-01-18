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
    w: int = 24,
    h: int = 24,
    depth: int = 16,
    n: int = 50,
    seed: int = 42,
    backend: Backend | None = None,
    profiles: list[dict] | None = None,
    terrain_seed: int | None = None,
    terrain_scale: float | None = None,
    terrain_smooth: int | None = None,
    sea_level: float | None = None,
) -> World:
    rng = random.Random(seed)
    world = World(w=w, h=h, dt=1.0, d=depth, entities=[], backend=backend or get_backend(False))
    depth_span = max(1.0, float(depth - 1))

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
            aquatic = bool(profile.get("aquatic", False))
            for _ in range(max(0, count)):
                x = rng.uniform(0, w - 1)
                y = rng.uniform(0, h - 1)
                z = rng.uniform(float(depth_min), float(depth_max)) * depth_span
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
                        aquatic=aquatic,
                    )
                )
                idx += 1
    else:
        for i in range(n):
            color = rng.choice(palette)
            x = rng.uniform(0, w-1)
            y = rng.uniform(0, h-1)
            z = rng.uniform(0.0, depth_span)
            vx = rng.uniform(-0.6, 0.6)
            vy = rng.uniform(-0.6, 0.6)
            vz = rng.uniform(-0.2, 0.2)
            mass = 1.0 + (0.8 if color == "metal" else 0.0) + rng.uniform(0.0, 0.6)
            hardness = 0.5 + (0.8 if color == "metal" else 0.0) + rng.uniform(0.0, 1.0)
            world.entities.append(Entity(
                id=i+1, x=x, y=y, z=z, vx=vx, vy=vy, vz=vz,
                mass=mass, hardness=hardness, color=color
            ))

    # --- Terrain Generation ---
    xp = world.backend.xp
    terrain_seed = seed if terrain_seed is None else int(terrain_seed)
    terrain_scale = 1.0 if terrain_scale is None else float(terrain_scale)
    terrain_smooth = 4 if terrain_smooth is None else max(0, int(terrain_smooth))
    sea_level = 0.45 if sea_level is None else float(sea_level)
    world.terrain_scale = terrain_scale
    world.sea_level = sea_level

    # Deterministic RNG per backend
    try:
        rng = xp.random.RandomState(int(terrain_seed))
        rand = rng.rand
    except Exception:
        xp.random.seed(int(terrain_seed))
        rand = xp.random.rand

    # Generate base noise
    noise = rand(h, w).astype(xp.float32)
    
    # Simple smoothing to create "hills" (iterative averaging)
    # This creates a heightmap effect without needing a Perlin library
    for _ in range(terrain_smooth):
        noise = (
            noise 
            + world.backend.roll(noise, 1, 0) 
            + world.backend.roll(noise, -1, 0) 
            + world.backend.roll(noise, 1, 1) 
            + world.backend.roll(noise, -1, 1)
        ) / 5.0
    
    # Scale to desired height range
    world.terrain_field[:] = noise * terrain_scale

    # Climate baseline: latitude gradient + subtle noise
    lat = xp.linspace(-1.0, 1.0, h, dtype=xp.float32)[:, None]
    climate_noise = rand(h, w).astype(xp.float32) * 0.3
    world.climate_field[:] = (1.0 - xp.abs(lat)) * 0.7 + climate_noise

    # Seed water and fertility based on terrain + climate
    sea_height = terrain_scale * sea_level
    water = xp.maximum(0.0, sea_height - world.terrain_field) * 2.0
    world.water_field[:] = water
    fertility = (world.climate_field * 0.6) + (world.water_field * 0.3)
    world.fertility_field[:] = xp.clip(fertility, 0.0, 1.5)

    # Initialize voxel grid: 0=air, 1=solid, 2=water
    d = int(max(1, world.d))
    z = xp.arange(d, dtype=xp.int32)[:, None, None]
    height_idx = xp.clip((world.terrain_field / max(terrain_scale, 0.001)) * (d - 1), 0, d - 1).astype(xp.int32)
    solid = z <= height_idx[None, ...]
    world.voxel_field[:] = solid.astype(xp.uint8)
    sea_idx = int(max(0, min(d - 1, round(sea_level * (d - 1)))))
    water = (z > height_idx[None, ...]) & (z <= sea_idx)
    world.voxel_field[water] = xp.uint8(2)
    # --------------------------

    return world
