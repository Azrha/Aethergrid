import json
import os
from typing import Dict, Any, List

class WorldPack:
    def __init__(self, data: Dict[str, Any]):
        self.data = data
            
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

def load_worldpack_json(name_or_data: str) -> Dict[str, Any]:
    # Check if input is a JSON string (sim_service passes file content)
    s = name_or_data.strip()
    if s.startswith("{") and s.endswith("}"):
        try:
            return json.loads(s)
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
        return json.load(f)

def worldpack_to_dsl(data: Dict[str, Any]) -> str:
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
