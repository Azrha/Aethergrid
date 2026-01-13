from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import json


@dataclass(frozen=True)
class LawSpec:
    name: str
    priority: int
    when: str
    actions: List[str]


@dataclass(frozen=True)
class ProfileSpec:
    name: str
    color: str
    count: int
    mass_range: List[float]
    hardness_range: List[float]
    speed_range: List[float]
    depth_range: List[float] | None = None
    static: bool = False
    energy_range: List[float] | None = None
    wealth_range: List[float] | None = None


@dataclass(frozen=True)
class WorldPack:
    name: str
    description: str
    consts: Dict[str, Any]
    laws: List[LawSpec]
    profiles: List[ProfileSpec]
    seed: int = 42


def _require(obj: Dict[str, Any], key: str, typ):
    if key not in obj:
        raise ValueError(f"WorldPack missing required field: {key}")
    val = obj[key]
    if not isinstance(val, typ):
        raise ValueError(f"WorldPack field '{key}' must be {typ}")
    return val


def _coerce_profile(data: Dict[str, Any]) -> ProfileSpec:
    name = _require(data, "name", str)
    color = _require(data, "color", str)
    count = int(_require(data, "count", int))
    mass_range = _require(data, "mass_range", list)
    hardness_range = _require(data, "hardness_range", list)
    speed_range = _require(data, "speed_range", list)
    depth_range = data.get("depth_range")
    static = bool(data.get("static", False))
    energy_range = data.get("energy_range")
    wealth_range = data.get("wealth_range")
    if energy_range is not None:
        energy_range = [float(energy_range[0]), float(energy_range[1])]
    if wealth_range is not None:
        wealth_range = [float(wealth_range[0]), float(wealth_range[1])]
    if depth_range is not None:
        depth_range = [float(depth_range[0]), float(depth_range[1])]
    return ProfileSpec(
        name=name,
        color=color,
        count=count,
        mass_range=[float(mass_range[0]), float(mass_range[1])],
        hardness_range=[float(hardness_range[0]), float(hardness_range[1])],
        speed_range=[float(speed_range[0]), float(speed_range[1])],
        depth_range=depth_range,
        static=static,
        energy_range=energy_range,
        wealth_range=wealth_range,
    )


def _coerce_law(data: Dict[str, Any]) -> LawSpec:
    name = _require(data, "name", str)
    priority = int(_require(data, "priority", int))
    when = _require(data, "when", str)
    actions = _require(data, "actions", list)
    return LawSpec(name=name, priority=priority, when=when, actions=[str(a) for a in actions])


def load_worldpack_json(text: str) -> WorldPack:
    raw = json.loads(text)
    if not isinstance(raw, dict):
        raise ValueError("WorldPack JSON must be an object")
    name = _require(raw, "name", str)
    description = _require(raw, "description", str)
    consts = _require(raw, "consts", dict)
    laws = [_coerce_law(l) for l in _require(raw, "laws", list)]
    profiles = [_coerce_profile(p) for p in _require(raw, "profiles", list)]
    seed = int(raw.get("seed", 42))
    return WorldPack(
        name=name,
        description=description,
        consts=consts,
        laws=laws,
        profiles=profiles,
        seed=seed,
    )


def worldpack_to_dsl(pack: WorldPack) -> str:
    lines: List[str] = []
    for k, v in pack.consts.items():
        lines.append(f"const {k} = {v}")
    lines.append("")
    for law in pack.laws:
        lines.append(f"law {law.name} priority {law.priority}")
        lines.append(f"  when {law.when}")
        if law.actions:
            lines.append(f"  do {law.actions[0]}")
            for action in law.actions[1:]:
                lines.append(f"  do {action}")
        lines.append("end")
        lines.append("")
    return "\n".join(lines).strip() + "\n"
