import React, { useEffect, useMemo, useRef } from "react";
import { Renderer, Entity } from "../engine/Renderer";
import type { AssetStyle } from "../engine/assets";

type FramePayload = {
  t: number;
  w: number;
  h: number;
  entities: Entity[];
};

type FieldPayload = {
  step: number;
  w: number;
  h: number;
  grid_w: number;
  grid_h: number;
  terrain: number[][];
  water: number[][];
  fertility: number[][];
  climate: number[][];
};

type Props = {
  mode: "2d" | "3d";
  apiBase?: string;
  initialFrame?: FramePayload | null;
  onFrame?: (payload: FramePayload) => void;
  onSelect?: (id: number | null) => void;
  fields?: FieldPayload | null;
  theme?: string;
  assetStyle?: AssetStyle;
  showDiagnostics?: boolean;
};

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

const normalizeApiBase = (value?: string) => {
  const raw = (value || "").trim();
  if (!raw) return DEFAULT_API_BASE;
  try {
    const candidate = raw.replace(/^ws/, "http");
    const parsed = new URL(candidate);
    if (parsed.port === "5173") {
      parsed.port = "8000";
    }
    if (!parsed.port && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      parsed.port = "8000";
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_API_BASE;
  }
};

const normalizeWsUrl = (apiBase?: string) => {
  const base = normalizeApiBase(apiBase);
  if (!base) return "";
  try {
    const parsed = new URL(base);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    parsed.pathname = "/ws/stream";
    return parsed.toString();
  } catch {
    return base.replace(/^http/, "ws").replace(/\/+$/, "") + "/ws/stream";
  }
};

export default function EngineView({
  mode,
  apiBase,
  initialFrame,
  onFrame,
  onSelect,
  fields,
  theme,
  assetStyle = "assets",
  showDiagnostics = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const worldRef = useRef({ w: 1, h: 1 });
  const pendingFrameRef = useRef<FramePayload | null>(null);
  const lastFrameRef = useRef<FramePayload | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ down: false, x: 0, y: 0, moved: false });
  const [hasFrame, setHasFrame] = React.useState(false);
  const [rendererReady, setRendererReady] = React.useState(false);
  const [rendererError, setRendererError] = React.useState<string | null>(null);
  const [assetsReady, setAssetsReady] = React.useState(assetStyle !== "assets");
  const [diagnostics, setDiagnostics] = React.useState({
    fps: 0,
    avgSpeed: 0,
    avgEnergy: 0,
    avgWealth: 0,
    count: 0,
  });
  const lastFrameTime = useRef<number | null>(null);

  const normalizedWsUrl = useMemo(() => {
    return normalizeWsUrl(apiBase);
  }, [apiBase]);

  const httpBase = useMemo(() => {
    return normalizeApiBase(apiBase);
  }, [apiBase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer(canvas);
    } catch (err) {
      setRendererError((err as Error).message || "Failed to initialize WebGL.");
      return;
    }
    rendererRef.current = renderer;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      renderer.resize(rect.width, rect.height);
    };
    resize();
    window.addEventListener("resize", resize);
    setRendererReady(true);

    let raf = 0;
    const loop = () => {
      const r = rendererRef.current;
      if (r) r.render(worldRef.current.w, worldRef.current.h);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const pending = pendingFrameRef.current;
    if (pending) {
      worldRef.current = { w: pending.w, h: pending.h };
      renderer.setEntities(pending.entities || []);
      setHasFrame(true);
      pendingFrameRef.current = null;
      onFrame?.(pending);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !fields) return;
    renderer.setFields(fields);
  }, [fields]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !theme) return;
    renderer.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    setAssetsReady(assetStyle !== "assets");
    renderer.setAssetStyle(assetStyle);
    if (assetStyle === "assets") {
      let active = true;
      renderer.preloadAssets().then(() => {
        if (active) setAssetsReady(true);
      });
      return () => {
        active = false;
      };
    }
  }, [assetStyle]);

  useEffect(() => {
    if (!showDiagnostics) return;
    const canvas = overlayCanvasRef.current;
    const frame = lastFrameRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(12, 14, 20, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / frame.w;
    const scaleY = canvas.height / frame.h;
    ctx.fillStyle = "rgba(90, 200, 255, 0.7)";
    for (const entity of frame.entities) {
      const x = entity.x * scaleX;
      const y = entity.y * scaleY;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [diagnostics, showDiagnostics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    const onPointerDown = (ev: PointerEvent) => {
      pointerRef.current = { down: true, x: ev.clientX, y: ev.clientY, moved: false };
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!pointerRef.current.down) return;
      const dx = Math.abs(ev.clientX - pointerRef.current.x);
      const dy = Math.abs(ev.clientY - pointerRef.current.y);
      if (dx + dy > 6) pointerRef.current.moved = true;
    };
    const onPointerUp = (ev: PointerEvent) => {
      const { down, moved } = pointerRef.current;
      pointerRef.current.down = false;
      if (!down || moved) return;
      const rect = canvas.getBoundingClientRect();
      const id = renderer.pick(ev.clientX, ev.clientY, rect);
      onSelect?.(id);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [onSelect]);

  useEffect(() => {
    setHasFrame(false);
    let ws: WebSocket | null = null;
    let timer: number | null = null;
    let pollTimer: number | null = null;
    let healthTimer: number | null = null;
    let lastMessage = 0;
    let closed = false;
    const hasWs = Boolean(normalizedWsUrl);

    const applyPayload = (payload: FramePayload) => {
      const renderer = rendererRef.current;
      if (!renderer || !rendererReady) {
        pendingFrameRef.current = payload;
        return;
      }
      worldRef.current = { w: payload.w, h: payload.h };
      renderer.setEntities(payload.entities || []);
      lastFrameRef.current = payload;
      const now = performance.now();
      const prev = lastFrameTime.current;
      const fps = prev ? 1000 / Math.max(1, now - prev) : 0;
      lastFrameTime.current = now;
      const count = payload.entities.length || 1;
      const speedSum = payload.entities.reduce(
        (sum, entity) => sum + Math.hypot(entity.vx || 0, entity.vy || 0),
        0
      );
      const energySum = payload.entities.reduce((sum, entity) => sum + (entity.energy ?? 0.6), 0);
      const wealthSum = payload.entities.reduce((sum, entity) => sum + (entity.wealth ?? 0), 0);
      setDiagnostics({
        fps: Number.isFinite(fps) ? fps : 0,
        avgSpeed: speedSum / count,
        avgEnergy: energySum / count,
        avgWealth: wealthSum / count,
        count: payload.entities.length,
      });
      setHasFrame(true);
      onFrame?.(payload);
    };

    const fetchFrame = async () => {
      if (!httpBase) return;
      try {
        const res = await fetch(`${httpBase}/api/frame`);
        if (!res.ok) return;
        if (res.status === 204) return;
        const payload = (await res.json()) as FramePayload;
        applyPayload(payload);
      } catch {
        return;
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = window.setInterval(fetchFrame, 1000);
      void fetchFrame();
    };

    const stopPolling = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const connect = () => {
      if (closed || !normalizedWsUrl) return;
      ws = new WebSocket(normalizedWsUrl);
      ws.onopen = () => {
        lastMessage = Date.now();
      };
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as { w: number; h: number; entities: Entity[] };
          lastMessage = Date.now();
          stopPolling();
          applyPayload(payload);
        } catch {
          return;
        }
      };
      ws.onclose = () => {
        if (closed) return;
        if (timer) window.clearTimeout(timer);
        startPolling();
        timer = window.setTimeout(connect, 1000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    startPolling();
    if (hasWs) {
      connect();
    }
    healthTimer = window.setInterval(() => {
      if (!hasWs) {
        startPolling();
        return;
      }
      if (lastMessage === 0) {
        startPolling();
        return;
      }
      if (Date.now() - lastMessage > 2000) {
        startPolling();
      }
    }, 1000);
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      if (healthTimer) window.clearInterval(healthTimer);
      stopPolling();
      ws?.close();
    };
  }, [normalizedWsUrl, httpBase, rendererReady]);

  useEffect(() => {
    if (!initialFrame) return;
    pendingFrameRef.current = initialFrame;
    const renderer = rendererRef.current;
    if (renderer && rendererReady) {
      worldRef.current = { w: initialFrame.w, h: initialFrame.h };
      renderer.setEntities(initialFrame.entities || []);
      setHasFrame(true);
      pendingFrameRef.current = null;
      onFrame?.(initialFrame);
    }
  }, [initialFrame, rendererReady]);

  return (
    <div className="canvas-wrap">
      {rendererError && (
        <div className="overlay">
          <div className="small">Renderer error: {rendererError}</div>
        </div>
      )}
      {!assetsReady && (
        <div className="overlay">
          <div className="loading-bar" aria-label="Loading">
            <div className="loading-bar__fill" />
          </div>
          <div className="small">Loading 3D models...</div>
        </div>
      )}
      {!hasFrame && (
        <div className="overlay">
          <div className="loading-bar" aria-label="Loading">
            <div className="loading-bar__fill" />
          </div>
          <div className="small">Waiting for frames...</div>
        </div>
      )}
      {showDiagnostics && (
        <div className="overlay diagnostics">
          <div className="diagnostics__panel">
            <div className="diagnostics__title">Diagnostics</div>
            <div>Entities: {diagnostics.count}</div>
            <div>FPS: {diagnostics.fps.toFixed(1)}</div>
            <div>Avg speed: {diagnostics.avgSpeed.toFixed(2)}</div>
            <div>Avg energy: {diagnostics.avgEnergy.toFixed(2)}</div>
            <div>Avg wealth: {diagnostics.avgWealth.toFixed(2)}</div>
          </div>
          <canvas ref={overlayCanvasRef} width={160} height={100} />
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
}
