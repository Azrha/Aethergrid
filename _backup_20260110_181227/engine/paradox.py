from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import numpy as np

from .laws import Law

@dataclass
class ParadoxReport:
    static_errors: List[str]
    warnings: List[str]

def static_check(consts: Dict[str, Any], laws: List[Law]) -> ParadoxReport:
    errs = []
    warns = []

    seen = {}
    for l in laws:
        key = (l.name, l.priority)
        if key in seen:
            warns.append(f"Duplicate law name+priority: {l.name} priority {l.priority}")
        seen[key] = True

    allowed_vars = {
        "x",
        "y",
        "z",
        "vx",
        "vy",
        "vz",
        "mass",
        "hardness",
        "seen",
        "alive",
        "sound",
        "color",
        "energy",
        "terrain",
        "water",
        "fertility",
        "season",
        "climate",
        "rain",
        "latitude",
        "road",
        "settlement",
        "home",
        "farm",
        "market",
        "wealth",
    }
    allowed_calls = {
        "emit_sound",
        "emit_food",
        "consume_food",
        "metabolize",
        "wind",
        "gust",
        "emit_water",
        "consume_water",
        "emit_road",
        "follow_road",
        "emit_settlement",
        "emit_home",
        "emit_farm",
        "emit_market",
        "seek_home",
        "seek_farm",
        "seek_market",
        "trade",
        "attract",
        "repel",
        "decay_unseen",
        "fade_color",
        "clamp_speed",
        "drag",
        "bounce",
        "collide",
        "wander",
        "seek",
        "avoid",
        "cohere",
        "align",
        "separate",
        "wrap",
    }
    call_arity = {
        "emit_sound": {0, 1},
        "emit_food": {0, 1},
        "consume_food": {0, 1, 2},
        "metabolize": {0, 1},
        "wind": {0, 1},
        "gust": {0, 1},
        "emit_water": {0, 1},
        "consume_water": {0, 1, 2},
        "emit_road": {0, 1},
        "follow_road": {0, 1},
        "emit_settlement": {0, 1},
        "emit_home": {0, 1},
        "emit_farm": {0, 1},
        "emit_market": {0, 1},
        "seek_home": {0, 1},
        "seek_farm": {0, 1},
        "seek_market": {0, 1},
        "trade": {0, 1},
        "attract": {2, 3},
        "repel": {2, 3},
        "decay_unseen": {0, 1},
        "fade_color": {0, 1},
        "clamp_speed": {0, 1},
        "drag": {0, 1},
        "bounce": {0, 1, 2, 3},
        "collide": {0, 1, 2, 3},
        "wander": {0, 1},
        "seek": {3},
        "avoid": {3},
        "cohere": {0, 1, 2, 3},
        "align": {0, 1, 2, 3},
        "separate": {0, 1, 2, 3},
        "wrap": {0, 2},
    }
    for l in laws:
        for a in l.actions:
            if a.kind == "assign":
                if a.name not in allowed_vars:
                    errs.append(f"Law '{l.name}': cannot assign to '{a.name}'")
            elif a.kind == "call":
                if a.name not in allowed_calls:
                    errs.append(f"Law '{l.name}': unknown call '{a.name}()'")
                else:
                    argc = len(a.args or [])
                    if argc not in call_arity[a.name]:
                        expected = sorted(call_arity[a.name])
                        errs.append(
                            f"Law '{l.name}': call '{a.name}()' expects {expected} args, got {argc}"
                        )

    return ParadoxReport(static_errors=errs, warnings=warns)

def dynamic_instability_flags(world, max_speed: float) -> Tuple[float, float]:
    speeds = []
    sounds = []
    for e in world.entities:
        if not e.alive:
            continue
        speeds.append((e.vx*e.vx + e.vy*e.vy) ** 0.5)
        sounds.append(e.sound)
    if not speeds:
        return (0.0, 0.0)
    vmax = float(np.max(speeds))
    smax = float(np.max(sounds)) if sounds else 0.0
    speed_score = max(0.0, (vmax - max_speed) / max_speed)
    sound_score = max(0.0, (smax - 1.5) / 1.5)
    return (speed_score, sound_score)
