from __future__ import annotations
import math
import numpy as np
from PIL import Image

from .backend import get_backend

COLOR_MAP = {
    "red": (255, 70, 70),
    "blue": (70, 120, 255),
    "green": (70, 255, 140),
    "metal": (190, 190, 210),
    "gray": (160, 160, 160),
    "gold": (255, 210, 90),
    "human": (255, 178, 140),
    "animal": (120, 200, 90),
    "alien": (120, 255, 220),
    "building": (150, 140, 160),
    "tree": (80, 160, 80),
    "dino": (90, 210, 140),
}


def color_rgb(color: str) -> tuple[int, int, int]:
    return COLOR_MAP.get(color, (220, 220, 220))

def render(
    world,
    show_sound: bool = True,
    show_paradox: bool = True,
    show_trails: bool = True,
    show_atmosphere: bool = True,
    show_food: bool = True,
    show_terrain: bool = True,
    show_water: bool = True,
    show_fertility: bool = False,
    show_roads: bool = False,
    show_settlements: bool = False,
    show_homes: bool = False,
    show_farms: bool = False,
    show_markets: bool = False,
) -> Image.Image:
    h, w = world.h, world.w
    img = np.zeros((h, w, 3), dtype=np.uint8)
    backend = world.backend or get_backend(False)

    if show_terrain:
        t = backend.asnumpy(world.terrain_field)
        t = np.clip(t, 0.0, 1.0)
        base = np.zeros((h, w, 3), dtype=np.uint8)
        base[..., 1] = (60 + t * 120).astype(np.uint8)
        base[..., 0] = (20 + t * 40).astype(np.uint8)
        base[..., 2] = (20 + t * 30).astype(np.uint8)
        img = np.maximum(img, base)

    if show_sound:
        s = backend.asnumpy(world.sound_field)
        s = np.clip(s, 0.0, 2.0) / 2.0
        img[..., 2] = (s * 140).astype(np.uint8)
        img[..., 1] = (s * 40).astype(np.uint8)

    if show_food:
        f = backend.asnumpy(world.food_field)
        f = np.clip(f, 0.0, 2.0) / 2.0
        img[..., 1] = np.maximum(img[..., 1], (f * 160).astype(np.uint8))
        img[..., 0] = np.maximum(img[..., 0], (f * 40).astype(np.uint8))

    if show_water:
        wv = backend.asnumpy(world.water_field)
        wv = np.clip(wv, 0.0, 2.0) / 2.0
        img[..., 2] = np.maximum(img[..., 2], (80 + wv * 160).astype(np.uint8))

    if show_fertility:
        fz = backend.asnumpy(world.fertility_field)
        fz = np.clip(fz, 0.0, 1.5) / 1.5
        img[..., 1] = np.maximum(img[..., 1], (60 + fz * 150).astype(np.uint8))

    if show_roads:
        rd = backend.asnumpy(world.road_field)
        rd = np.clip(rd, 0.0, 1.0)
        img[..., 0] = np.maximum(img[..., 0], (80 + rd * 160).astype(np.uint8))
        img[..., 2] = np.maximum(img[..., 2], (40 + rd * 80).astype(np.uint8))

    if show_settlements:
        st = backend.asnumpy(world.settlement_field)
        st = np.clip(st, 0.0, 1.0)
        img[..., 0] = np.maximum(img[..., 0], (120 + st * 120).astype(np.uint8))
        img[..., 1] = np.maximum(img[..., 1], (80 + st * 120).astype(np.uint8))

    if show_homes:
        hm = backend.asnumpy(world.home_field)
        hm = np.clip(hm, 0.0, 1.0)
        img[..., 2] = np.maximum(img[..., 2], (100 + hm * 120).astype(np.uint8))

    if show_farms:
        fm = backend.asnumpy(world.farm_field)
        fm = np.clip(fm, 0.0, 1.0)
        img[..., 1] = np.maximum(img[..., 1], (90 + fm * 140).astype(np.uint8))

    if show_markets:
        mk = backend.asnumpy(world.market_field)
        mk = np.clip(mk, 0.0, 1.0)
        img[..., 0] = np.maximum(img[..., 0], (130 + mk * 110).astype(np.uint8))

    for e in world.entities:
        if not e.alive:
            continue
        x = int(max(0, min(w-1, round(e.x))))
        y = int(max(0, min(h-1, round(e.y))))
        base = color_rgb(e.color)
        img[y, x, :] = base

        r = int(max(1, min(6, 1 + e.hardness * 0.6)))
        for dy in range(-r, r+1):
            yy = y + dy
            if yy < 0 or yy >= h:
                continue
            for dx in range(-r, r+1):
                xx = x + dx
                if xx < 0 or xx >= w:
                    continue
                if dx*dx + dy*dy <= r*r:
                    a = 0.20
                    img[yy, xx, 0] = int(img[yy, xx, 0] * (1-a) + base[0] * a)
                    img[yy, xx, 1] = int(img[yy, xx, 1] * (1-a) + base[1] * a)
                    img[yy, xx, 2] = int(img[yy, xx, 2] * (1-a) + base[2] * a)

    if show_trails:
        t = np.clip(backend.asnumpy(world.trail_field), 0.0, 2.0) / 2.0
        img[..., 0] = np.maximum(img[..., 0], (t * 60).astype(np.uint8))
        img[..., 1] = np.maximum(img[..., 1], (t * 120).astype(np.uint8))

    if show_paradox:
        p = np.clip(backend.asnumpy(world.paradox_heat), 0.0, 1.0)
        img[..., 0] = np.maximum(img[..., 0], (p * 255).astype(np.uint8))
        img[..., 1] = (img[..., 1] * (1.0 - 0.35*p)).astype(np.uint8)
        img[..., 2] = (img[..., 2] * (1.0 - 0.35*p)).astype(np.uint8)

    if show_atmosphere and world.day_cycle and world.day_cycle > 0:
        phase = (world.time / world.day_cycle) % 1.0
        light = 0.55 + 0.45 * math.sin(phase * 2.0 * math.pi)
        light = max(0.25, min(1.1, light))
        img[:] = np.clip(img * light, 0, 255).astype(np.uint8)
    if show_atmosphere and world.weather_cycle and world.weather_cycle > 0:
        phase = (world.time / world.weather_cycle) % 1.0
        cloud = 0.75 + 0.25 * math.sin(phase * 2.0 * math.pi + 1.3)
        img[:] = np.clip(img * cloud, 0, 255).astype(np.uint8)

    return Image.fromarray(img, mode="RGB")


def render_view(
    world,
    center_x: float,
    center_y: float,
    zoom: float,
    view_w: int,
    view_h: int,
    show_sound: bool = True,
    show_paradox: bool = True,
    show_trails: bool = True,
    show_atmosphere: bool = True,
    show_food: bool = True,
    show_terrain: bool = True,
    show_water: bool = True,
    show_fertility: bool = False,
    show_roads: bool = False,
    show_settlements: bool = False,
    show_homes: bool = False,
    show_farms: bool = False,
    show_markets: bool = False,
    resample: str = "nearest",
) -> Image.Image:
    zoom = max(0.2, min(6.0, zoom))
    base = render(
        world,
        show_sound=show_sound,
        show_paradox=show_paradox,
        show_trails=show_trails,
        show_atmosphere=show_atmosphere,
        show_food=show_food,
        show_terrain=show_terrain,
        show_water=show_water,
        show_fertility=show_fertility,
        show_roads=show_roads,
        show_settlements=show_settlements,
        show_homes=show_homes,
        show_farms=show_farms,
        show_markets=show_markets,
    )
    w, h = base.size
    crop_w = max(8, int(view_w / zoom))
    crop_h = max(8, int(view_h / zoom))
    cx = int(round(center_x))
    cy = int(round(center_y))
    left = max(0, min(w - 1, cx - crop_w // 2))
    top = max(0, min(h - 1, cy - crop_h // 2))
    right = min(w, left + crop_w)
    bottom = min(h, top + crop_h)
    crop = base.crop((left, top, right, bottom))
    resample_map = {
        "nearest": Image.NEAREST,
        "bilinear": Image.BILINEAR,
        "lanczos": Image.LANCZOS,
    }
    return crop.resize((view_w, view_h), resample=resample_map.get(resample, Image.NEAREST))
