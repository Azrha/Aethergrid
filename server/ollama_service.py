"""
Ollama AI Service for Entity Conversations

This module provides AI-powered speech and thoughts for entities
in the Aethergrid simulation.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import httpx

logger = logging.getLogger("mythos")

# Default Ollama configuration
OLLAMA_HOST = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"  # Fast, small model

@dataclass
class EntityThought:
    """A thought or speech bubble for an entity"""
    entity_id: int
    text: str
    is_speech: bool  # True = speech bubble, False = thought bubble
    duration_ms: int
    timestamp: float


class OllamaService:
    """Manages Ollama API connections and generates entity text"""
    
    def __init__(self):
        self.host = OLLAMA_HOST
        self.model = DEFAULT_MODEL
        self.enabled = False
        self.thoughts_queue: List[EntityThought] = []
        self.last_generation_time: Dict[int, float] = {}  # entity_id -> timestamp
        self.generation_cooldown = 5.0  # seconds between generations per entity
        
    async def check_ollama_available(self) -> bool:
        """Check if Ollama server is running and available"""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{self.host}/api/tags")
                if response.status_code == 200:
                    self.enabled = True
                    logger.info(f"Ollama available at {self.host}")
                    return True
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
        self.enabled = False
        return False
    
    async def set_model(self, model: str) -> bool:
        """Set the Ollama model to use"""
        self.model = model
        return await self.check_ollama_available()
    
    def _build_entity_prompt(self, entity: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Build a prompt for generating entity speech/thoughts"""
        entity_kind = entity.get("kind", "creature")
        entity_color = entity.get("color", "unknown")
        energy = entity.get("energy", 50)
        wealth = entity.get("wealth", 0)
        
        # World context
        time_of_day = context.get("time", 0) % 24
        nearby_entities = context.get("nearby_count", 0)
        
        personality_hints = {
            "humanoid": "You are a curious settler, observing the world.",
            "animal": "You are a simple creature, focused on survival.",
            "building": "You are a structure, silent and observant.",
            "tree": "You are a tree, rooted and wise.",
            "creature": "You are an entity in a strange world.",
        }
        
        personality = personality_hints.get(entity_kind, personality_hints["creature"])
        
        prompt = f"""You are an entity in a pixel-art diorama world called Aethergrid.
{personality}

Current state:
- Type: {entity_kind}
- Energy: {energy}%
- Wealth: {wealth}
- Nearby entities: {nearby_entities}

Generate a SHORT thought or speech (max 8 words) that this {entity_kind} might have.
Be creative, whimsical, and match the pixel-art aesthetic.
Only output the thought text, nothing else."""

        return prompt
    
    async def generate_entity_thought(
        self, 
        entity: Dict[str, Any], 
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[EntityThought]:
        """Generate a thought or speech for an entity"""
        if not self.enabled:
            return None
            
        import time
        entity_id = entity.get("id", 0)
        now = time.time()
        
        # Check cooldown
        last_time = self.last_generation_time.get(entity_id, 0)
        if now - last_time < self.generation_cooldown:
            return None
            
        context = context or {}
        prompt = self._build_entity_prompt(entity, context)
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{self.host}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.9,
                            "num_predict": 20,  # Very short responses
                        }
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    text = data.get("response", "").strip()
                    
                    # Clean up the response
                    text = text.replace('"', '').replace("'", "")
                    text = text.split('\n')[0][:50]  # First line, max 50 chars
                    
                    if text:
                        self.last_generation_time[entity_id] = now
                        thought = EntityThought(
                            entity_id=entity_id,
                            text=text,
                            is_speech=random.random() > 0.5,
                            duration_ms=3000 + random.randint(0, 2000),
                            timestamp=now
                        )
                        self.thoughts_queue.append(thought)
                        return thought
                        
        except Exception as e:
            logger.warning(f"Ollama generation failed: {e}")
            
        return None
    
    async def generate_batch_thoughts(
        self,
        entities: List[Dict[str, Any]],
        max_count: int = 3,
        context: Optional[Dict[str, Any]] = None
    ) -> List[EntityThought]:
        """Generate thoughts for multiple entities (randomly selected)"""
        if not self.enabled or not entities:
            return []
            
        # Select random entities
        selected = random.sample(entities, min(max_count, len(entities)))
        thoughts = []
        
        for entity in selected:
            thought = await self.generate_entity_thought(entity, context)
            if thought:
                thoughts.append(thought)
                
        return thoughts
    
    def get_active_thoughts(self, max_age_ms: float = 5000) -> List[Dict[str, Any]]:
        """Get thoughts that should still be displayed"""
        import time
        now = time.time()
        cutoff = now - (max_age_ms / 1000.0)
        
        # Filter and clean old thoughts
        active = [t for t in self.thoughts_queue if t.timestamp > cutoff]
        self.thoughts_queue = active
        
        return [
            {
                "entity_id": t.entity_id,
                "text": t.text,
                "is_speech": t.is_speech,
                "duration_ms": t.duration_ms,
            }
            for t in active
        ]
    
    def clear_thoughts(self):
        """Clear all pending thoughts"""
        self.thoughts_queue = []


# Global singleton instance
ollama_service = OllamaService()
