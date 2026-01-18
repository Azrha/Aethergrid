from __future__ import annotations

import asyncio
import logging
from typing import Dict, Any, List

from .agent_brain import AgentBrain
from .config import (
    BRAIN_ENABLED,
    BRAIN_AUTO_THOUGHTS,
    BRAIN_AUTO_ACTIONS,
    BRAIN_AUTO_CONVO,
    BRAIN_TICK_MS,
)
from .ollama_service import ollama_service

logger = logging.getLogger("mythos")


class BrainService:
    def __init__(self) -> None:
        self.brain = AgentBrain()

    def ingest_frame(self, frame: Dict[str, Any]) -> None:
        if not BRAIN_ENABLED:
            return
        self.brain.ingest_frame(frame)

    def context_for(self, entity: Dict[str, Any], frame: Dict[str, Any]) -> Dict[str, Any]:
        return self.brain.context_for_entity(entity, frame)

    async def run_summary_pass(self, entities: List[Dict[str, Any]], frame: Dict[str, Any]) -> None:
        if not BRAIN_ENABLED or not ollama_service.enabled:
            return
        for entity in entities[:3]:
            entity_id = int(entity.get("id", -1))
            if entity_id < 0 or not self.brain.needs_summary(entity_id):
                continue
            memories = self.brain.memories.get(entity_id, [])
            memory_texts = [m.text for m in memories][-10:]
            summary = await ollama_service.generate_summary(entity, memory_texts)
            if summary:
                self.brain.mark_summary(entity_id, summary)

    async def auto_loop(self, sim_service) -> None:
        while True:
            try:
                frame = sim_service.frame_payload()
                if frame:
                    self.ingest_frame(frame)
                    entities = frame.get("entities", [])
                    if not isinstance(entities, list):
                        entities = []
                    if entities and (BRAIN_AUTO_THOUGHTS or BRAIN_AUTO_ACTIONS or BRAIN_AUTO_CONVO):
                        if not ollama_service.enabled:
                            await ollama_service.check_ollama_available()
                    if entities and ollama_service.enabled:
                        if BRAIN_AUTO_THOUGHTS:
                            await self._auto_thoughts(entities, frame)
                        if BRAIN_AUTO_ACTIONS:
                            await self._auto_actions(sim_service, entities, frame)
                        if BRAIN_AUTO_CONVO:
                            await self._auto_conversation(frame)
                        await self.run_summary_pass(entities, frame)
            except Exception:
                logger.exception("BrainService loop failed")
            await asyncio.sleep(BRAIN_TICK_MS / 1000.0)

    async def _auto_thoughts(self, entities: List[Dict[str, Any]], frame: Dict[str, Any]) -> None:
        for entity in entities[:2]:
            context = self.context_for(entity, frame)
            thought = await ollama_service.generate_entity_thought(entity, context)
            if thought:
                self.brain.record_memory(int(entity.get("id", -1)), "thought", thought.text, 0.4)

    async def _auto_actions(self, sim_service, entities: List[Dict[str, Any]], frame: Dict[str, Any]) -> None:
        actions = []
        for entity in entities[:1]:
            context = self.context_for(entity, frame)
            action = await ollama_service.generate_entity_action(entity, context)
            if action:
                actions.append({"entity_id": action.entity_id, "action": action.action, "payload": action.payload})
                self.brain.record_memory(action.entity_id, "action", f"Action: {action.action}", 0.5)
        if actions:
            sim_service.apply_ai_actions(actions)

    async def _auto_conversation(self, frame: Dict[str, Any]) -> None:
        pair = self.brain.conversation_pair(frame)
        if not pair:
            return
        entity_a, entity_b = pair
        lines = await ollama_service.generate_conversation(entity_a, entity_b, {})
        if not lines:
            return
        a_id = int(entity_a.get("id", -1))
        b_id = int(entity_b.get("id", -1))
        for idx, line in enumerate(lines):
            target_id = a_id if idx % 2 == 0 else b_id
            text = line.get("text", "")
            if text:
                ollama_service.queue_thought(target_id, text, is_speech=True, duration_ms=3200)
                self.brain.record_memory(target_id, "conversation", text, 0.6)


brain_service = BrainService()
