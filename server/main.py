from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .sim_service import SimulationService
from engine.backend import gpu_available

logger = logging.getLogger("mythos")

app = FastAPI(title="Mythos Engine")
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


@app.get("/api/presets")
async def presets() -> List[Dict[str, Any]]:
    return service.list_presets()

@app.get("/")
async def root() -> Dict[str, Any]:
    return {"ok": True, "service": "mythos-engine"}

@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "gpu": gpu_available()}


@app.get("/api/preset/{name}")
async def preset(name: str) -> Dict[str, Any]:
    return service.load_worldpack(name)


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
            "gpu": gpu_available(),
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
async def fields(step: int = 4) -> Dict[str, Any]:
    payload = service.fields_payload(step=step)
    if payload is None:
        return Response(status_code=204)
    return payload


@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = service.frame_payload()
            if payload is None:
                await asyncio.sleep(0.05)
                continue
            try:
                await ws.send_text(json.dumps(payload, allow_nan=False))
            except WebSocketDisconnect:
                return
            except Exception:
                logger.exception("WebSocket frame serialization failed")
                return
            await asyncio.sleep(service.tick_ms / 1000.0)
    except WebSocketDisconnect:
        return
