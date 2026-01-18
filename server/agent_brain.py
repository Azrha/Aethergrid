from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple
import time
import math

from .config import BRAIN_MEMORY_LIMIT, BRAIN_SUMMARY_INTERVAL, BRAIN_OBSERVE_INTERVAL, BRAIN_NEAR_RADIUS


@dataclass
class MemoryItem:
    t: float
    kind: str
    text: str
    importance: float


class AgentBrain:
    def __init__(self) -> None:
        self.memories: Dict[int, List[MemoryItem]] = {}
        self.summaries: Dict[int, str] = {}
        self.intents: Dict[int, str] = {}
        self.last_observed: Dict[int, float] = {}
        self.last_summary: Dict[int, float] = {}
        self.last_convo: Dict[Tuple[int, int], float] = {}

    def ingest_frame(self, frame: Dict[str, any]) -> None:
        entities = frame.get("entities", [])
        now = time.time()
        for e in entities:
            entity_id = int(e.get("id", -1))
            if entity_id < 0:
                continue
            last = self.last_observed.get(entity_id, 0.0)
            if now - last < BRAIN_OBSERVE_INTERVAL:
                continue
            self.last_observed[entity_id] = now
            obs = self._format_observation(e, entities)
            self._push_memory(entity_id, "observation", obs, 0.2)
            self._update_intent(entity_id, e, frame)

    def _format_observation(self, entity: Dict[str, any], entities: List[Dict[str, any]]) -> str:
        x = round(float(entity.get("x", 0.0)), 1)
        y = round(float(entity.get("y", 0.0)), 1)
        energy = round(float(entity.get("energy", 0.0)), 2)
        wealth = round(float(entity.get("wealth", 0.0)), 2)
        nearby = self._count_nearby(entity, entities)
        kind = str(entity.get("kind", entity.get("color", "entity")))
        return f"At ({x},{y}) as {kind}; energy {energy}, wealth {wealth}, sees {nearby} nearby."

    def _count_nearby(self, entity: Dict[str, any], entities: List[Dict[str, any]]) -> int:
        count = 0
        x = float(entity.get("x", 0.0))
        y = float(entity.get("y", 0.0))
        for other in entities:
            if other is entity:
                continue
            dx = float(other.get("x", 0.0)) - x
            dy = float(other.get("y", 0.0)) - y
            if dx * dx + dy * dy <= BRAIN_NEAR_RADIUS * BRAIN_NEAR_RADIUS:
                count += 1
        return count

    def _push_memory(self, entity_id: int, kind: str, text: str, importance: float) -> None:
        items = self.memories.setdefault(entity_id, [])
        items.append(MemoryItem(t=time.time(), kind=kind, text=text, importance=importance))
        if len(items) > BRAIN_MEMORY_LIMIT:
            self.memories[entity_id] = items[-BRAIN_MEMORY_LIMIT:]

    def record_memory(self, entity_id: int, kind: str, text: str, importance: float = 0.3) -> None:
        if entity_id < 0 or not text:
            return
        self._push_memory(entity_id, kind, text, importance)

    def _update_intent(self, entity_id: int, entity: Dict[str, any], frame: Dict[str, any]) -> None:
        kind = str(entity.get("kind", entity.get("color", "entity")))
        if kind in {"building", "tree"}:
            self.intents[entity_id] = "Stay rooted and observe"
            return
        energy = float(entity.get("energy", 1.0))
        wealth = float(entity.get("wealth", 0.0))
        t = float(frame.get("t", 0.0))
        hour = (t / 60.0) % 24.0
        if energy < 0.4:
            intent = "Find a calm spot to rest"
        elif wealth < 0.2:
            intent = "Seek something valuable or trade"
        elif hour < 10:
            intent = "Explore and look for neighbors"
        elif hour < 18:
            intent = "Socialize and learn about the area"
        else:
            intent = "Return to a quieter place"
        self.intents[entity_id] = intent

    def context_for_entity(self, entity: Dict[str, any], frame: Dict[str, any]) -> Dict[str, any]:
        entity_id = int(entity.get("id", -1))
        memories = [m.text for m in self.memories.get(entity_id, [])][-8:]
        summary = self.summaries.get(entity_id, "")
        intent = self.intents.get(entity_id, "")
        nearby = self._count_nearby(entity, frame.get("entities", []))
        return {
            "time": frame.get("t", 0.0),
            "nearby_count": nearby,
            "memories": memories,
            "summary": summary,
            "intent": intent,
            "world_w": frame.get("w", 0),
            "world_h": frame.get("h", 0),
        }

    def conversation_pair(self, frame: Dict[str, any]) -> Tuple[Dict[str, any], Dict[str, any]] | None:
        entities = frame.get("entities", [])
        now = time.time()
        for i, a in enumerate(entities):
            for b in entities[i + 1 :]:
                ax = float(a.get("x", 0.0))
                ay = float(a.get("y", 0.0))
                bx = float(b.get("x", 0.0))
                by = float(b.get("y", 0.0))
                if (ax - bx) ** 2 + (ay - by) ** 2 > 1.5 ** 2:
                    continue
                pair = tuple(sorted((int(a.get("id", -1)), int(b.get("id", -1)))))
                if pair[0] < 0 or pair[1] < 0:
                    continue
                last = self.last_convo.get(pair, 0.0)
                if now - last < 30.0:
                    continue
                self.last_convo[pair] = now
                return a, b
        return None

    def mark_summary(self, entity_id: int, summary: str) -> None:
        if summary:
            self.summaries[entity_id] = summary
            self.last_summary[entity_id] = time.time()

    def needs_summary(self, entity_id: int) -> bool:
        last = self.last_summary.get(entity_id, 0.0)
        return (time.time() - last) > BRAIN_SUMMARY_INTERVAL
