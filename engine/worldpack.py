import json
import os
from typing import Dict, Any, List, Iterable, Optional


class WorldPackProfile:
    def __init__(self, data: Dict[str, Any]):
        for key, value in data.items():
            setattr(self, key, value)

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)

class WorldPack:
    def __init__(self, data: Dict[str, Any]):
        self.data = data
        self.name = data.get("name", "")
        self.description = data.get("description", "")
        self.seed = data.get("seed", 42)
        self.consts = data.get("consts", {})
        self.laws = data.get("laws", [])
        raw_profiles = data.get("profiles", [])
        self.profiles = [WorldPackProfile(p) for p in raw_profiles]

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def as_dict(self) -> Dict[str, Any]:
        return dict(self.data)
            
    @property
    def dsl(self) -> str:
        lines = []
        if "consts" in self.data:
            for k, v in self.data["consts"].items():
                lines.append(f"const {k} = {v}")
        
        lines.append("")
        
        if "laws" in self.data:
            for law in self.data["laws"]:
                name = law.get("name", "Unknown")
                prio = law.get("priority", 1)
                cond = law.get("when", "true")
                actions = law.get("actions", [])
                
                if isinstance(actions, list):
                    action_str = "; ".join(actions)
                else:
                    action_str = str(actions)

                lines.append(f"law {name} priority {prio}")
                lines.append(f"  when {cond}")
                lines.append(f"  do {action_str}")
                lines.append("end")
                lines.append("")
                
        return "\n".join(lines)

def load_worldpack_json(name_or_data: str) -> WorldPack:
    # Check if input is a JSON string (sim_service passes file content)
    s = name_or_data.strip()
    if s.startswith("{") and s.endswith("}"):
        try:
            return WorldPack(json.loads(s))
        except json.JSONDecodeError:
            pass # Fallthrough to file check
            
    # Check if input is a filename
    base = os.path.join(os.path.dirname(__file__), "..", "examples", "worldpacks")
    path = os.path.join(base, s)
    if not os.path.exists(path) and not s.endswith(".json"):
        path += ".json"
    
    if not os.path.exists(path):
        # Fallback relative to root
        if os.path.exists(f"examples/worldpacks/{s}.json"):
             path = f"examples/worldpacks/{s}.json"
        elif os.path.exists(s): # Absolute or direct path
             path = s
        else:
             # Just in case it WAS a broken JSON string that failed decode
             if len(s) > 200: 
                 raise ValueError("Input looks like raw JSON but failed to decode.")
             raise FileNotFoundError(f"Worldpack not found: {s}")
        
    with open(path, "r", encoding="utf-8") as f:
        return WorldPack(json.load(f))

def worldpack_to_dsl(data: Dict[str, Any] | WorldPack) -> str:
    if isinstance(data, WorldPack):
        return data.dsl
    return WorldPack(data).dsl

def load_worldpack(name: str) -> Dict[str, Any]:
    data = load_worldpack_json(name)
    return {
        "name": data.get("name", name),
        "description": data.get("description", ""),
        "dsl": worldpack_to_dsl(data),
        "profiles": data.get("profiles", []),
        "seed": data.get("seed", 42)
    }


def validate_worldpack(data: Dict[str, Any] | WorldPack) -> List[str]:
    if isinstance(data, WorldPack):
        data = data.as_dict()
    errors: List[str] = []
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("name must be a non-empty string")
    seed = data.get("seed")
    if seed is not None:
        try:
            int(seed)
        except (TypeError, ValueError):
            errors.append("seed must be an integer")
    consts = data.get("consts", {})
    if consts is not None and not isinstance(consts, dict):
        errors.append("consts must be an object")
    profiles = data.get("profiles", [])
    if not isinstance(profiles, list):
        errors.append("profiles must be a list")
    else:
        for idx, profile in enumerate(profiles):
            if not isinstance(profile, dict):
                errors.append(f"profiles[{idx}] must be an object")
                continue
            if "count" in profile:
                try:
                    count = int(profile["count"])
                except (TypeError, ValueError):
                    errors.append(f"profiles[{idx}].count must be an integer")
                else:
                    if count < 0:
                        errors.append(f"profiles[{idx}].count must be >= 0")
            color = profile.get("color")
            if color is not None and not isinstance(color, str):
                errors.append(f"profiles[{idx}].color must be a string")
    laws = data.get("laws", [])
    if laws is not None and not isinstance(laws, list):
        errors.append("laws must be a list")
    return errors
