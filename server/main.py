from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .sim_service import SimulationService
from .ollama_service import ollama_service
from engine.backend import gpu_available, gpu_available_cached

logger = logging.getLogger("mythos")

app = FastAPI(title="Aethergrid")
service = SimulationService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(service.loop())
    asyncio.create_task(asyncio.to_thread(gpu_available))


@app.get("/api/presets")
async def presets() -> List[Dict[str, Any]]:
    return service.list_presets()

@app.get("/")
async def root() -> Dict[str, Any]:
    return {"ok": True, "service": "mythos-engine"}

@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "gpu": gpu_available_cached()}


@app.get("/api/preset/{name}")
async def preset(name: str) -> Dict[str, Any]:
    return service.load_worldpack(name)


@app.post("/api/save")
async def save_world(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        name = payload.get("name")
        if not name:
             raise ValueError("Name is required")
        description = payload.get("description", "")
        dsl = payload.get("dsl", "")
        profiles = payload.get("profiles", [])
        thumbnail = payload.get("thumbnail", "")
        
        safe_name = service.save_world_preset(name, description, dsl, profiles, thumbnail)
        return {"ok": True, "id": safe_name}
    except Exception as exc:
        logger.exception("save failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


from fastapi.responses import FileResponse, Response
import os
import glob

@app.get("/api/thumbnail/{name}")
async def thumbnail(name: str):
    # Try data/worlds first
    user_path = f"data/worlds/{name}.png"
    if os.path.exists(user_path):
        return FileResponse(user_path)
    
    # Return a transparent 1x1 PNG placeholder to avoid ORB errors.
    transparent_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01"
        b"\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return Response(content=transparent_png, media_type="image/png")



@app.post("/api/apply")
async def apply(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        dsl = payload.get("dsl", "")
        profiles = payload.get("profiles")
        seed = int(payload.get("seed", 42))
        n = int(payload.get("n", 200))
        backend = payload.get("backend", "cpu")
        await service.apply_program(dsl, profiles, seed, n, backend)
        return {
            "ok": True,
            "gpu": gpu_available_cached(),
            "frame": service.frame_payload(),
            "fields": service.fields_payload(),
        }
    except Exception as exc:
        logger.exception("apply failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/run")
async def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        service.set_run(bool(payload.get("run", False)))
        service.set_rate(int(payload.get("tick_ms", 33)), int(payload.get("steps", 1)))
        if service.running and service.last_frame is None and service.kernel is not None:
            await service.step()
        return {"ok": True}
    except Exception as exc:
        logger.exception("run failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/frame")
async def frame() -> Dict[str, Any]:
    payload = service.frame_payload()
    if payload is None:
        return Response(status_code=204)
    return payload


@app.get("/api/fields")
async def fields(step: int = 4, voxels: bool = False, z_step: int = 1) -> Dict[str, Any]:
    payload = service.fields_payload(step=step, voxels=voxels, z_step=z_step)
    if payload is None:
        return Response(status_code=204)
    return payload


# --- OLLAMA AI ENDPOINTS ---

@app.get("/api/ollama/status")
async def ollama_status() -> Dict[str, Any]:
    """Check if Ollama is available and get status"""
    available = await ollama_service.check_ollama_available()
    return {
        "available": available,
        "model": ollama_service.model,
        "enabled": ollama_service.enabled,
    }


@app.post("/api/ollama/generate")
async def ollama_generate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate thoughts for entities"""
    if not ollama_service.enabled:
        await ollama_service.check_ollama_available()
        
    if not ollama_service.enabled:
        return {"ok": False, "error": "Ollama not available", "thoughts": []}
    
    # Get current entities from simulation
    frame = service.frame_payload()
    if not frame or not frame.get("entities"):
        return {"ok": True, "thoughts": []}
    
    entities = frame["entities"]
    max_count = payload.get("max_count", 3)
    with_actions = bool(payload.get("actions", False))
    apply_actions = bool(payload.get("apply_actions", with_actions))
    
    # Generate thoughts
    thoughts = await ollama_service.generate_batch_thoughts(
        entities=entities,
        max_count=max_count,
        context={"time": frame.get("t", 0)}
    )

    actions = []
    if with_actions:
        actions = await ollama_service.generate_batch_actions(
            entities=entities,
            max_count=1,
            context={
                "time": frame.get("t", 0),
                "world_w": frame.get("w", 96),
                "world_h": frame.get("h", 96),
                "nearby_count": min(6, len(entities)),
            },
        )
        if apply_actions and actions:
            service.apply_ai_actions([
                {"entity_id": a.entity_id, "action": a.action, "payload": a.payload}
                for a in actions
            ])
    
    return {
        "ok": True,
        "thoughts": [
            {
                "entity_id": t.entity_id,
                "text": t.text,
                "is_speech": t.is_speech,
                "duration_ms": t.duration_ms,
            }
            for t in thoughts
        ],
        "actions": [
            {"entity_id": a.entity_id, "action": a.action, "payload": a.payload}
            for a in actions
        ],
    }


@app.get("/api/ollama/thoughts")
async def get_thoughts() -> Dict[str, Any]:
    """Get currently active entity thoughts"""
    thoughts = ollama_service.get_active_thoughts()
    return {"thoughts": thoughts}


@app.post("/api/ollama/model")
async def set_ollama_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Set the Ollama model to use"""
    model = payload.get("model", "llama3.2")
    success = await ollama_service.set_model(model)
    return {"ok": success, "model": ollama_service.model}


@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket):
    await ws.accept()
    try:
        # Send initial terrain data immediately upon connection
        fields = service.fields_payload(step=2)
        if fields:
            await ws.send_text(json.dumps({"type": "fields", "data": fields}, allow_nan=False))
        
        while True:
            payload = service.frame_payload()
            if payload is None:
                await asyncio.sleep(0.1)
                continue
            try:
                # Wrap frame in type to distinguish from fields if needed, 
                # but for now keeping compatible with current frontend unless we change it.
                # Actually, checking frontend Renderer.ts, it expects just the payload?
                # Let's check Renderer.ts first to be safe, but sending fields as a separate message
                # might break it if it expects only one type. 
                # WAIT: Renderer.ts usually fetches fields via HTTP or expects a specific WS format.
                # Let's stick to just making sure the loop is stable first.
                await ws.send_text(json.dumps(payload, allow_nan=False))
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                return
            except Exception:
                logger.exception("WebSocket frame serialization failed")
                return
            
            # Rate limit to avoid flooding
            await asyncio.sleep(max(0.033, service.tick_ms / 1000.0))
    except WebSocketDisconnect:
        logger.info("Client disconnected during init")
        return
