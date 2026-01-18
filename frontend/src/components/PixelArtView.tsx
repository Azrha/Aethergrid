import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { PixelArtRenderer, Entity, FieldPayload } from "../engine/PixelArtRenderer";
import { EntityThoughts } from "./SpeechBubble";

type FramePayload = {
    t: number;
    w: number;
    h: number;
    entities: Entity[];
};

type Props = {
    apiBase?: string;
    initialFrame?: FramePayload | null;
    onFrame?: (payload: FramePayload) => void;
    onSelect?: (id: number | null) => void;
    fields?: FieldPayload | null;
    theme?: string;
};

export default function PixelArtView({
    apiBase,
    initialFrame,
    onFrame,
    onSelect,
    fields,
    theme = "living",
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PixelArtRenderer | null>(null);
    const frameRef = useRef<FramePayload | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const animRef = useRef<number>(0);
    const [thoughts, setThoughts] = useState<{ entity_id: number; text: string; is_speech: boolean; duration_ms: number; }[]>([]);
    const [entityPositions, setEntityPositions] = useState<Map<number, { x: number; y: number }>>(new Map());
    const [ollamaConnected, setOllamaConnected] = useState(false);
    const lastThoughtTick = useRef(0);
    const onFrameRef = useRef<Props["onFrame"]>(onFrame);
    const positionsHashRef = useRef(0);

    // Pan state
    const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
    const zoomRef = useRef(2.35);

    // Initialize renderer
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        rendererRef.current = new PixelArtRenderer(canvas);

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) return;
            rendererRef.current?.resize(rect.width, rect.height);
        };

        resize();
        window.addEventListener("resize", resize);

        // Animation loop
        const hashPositions = (positions: Map<number, { x: number; y: number }>) => {
            let hash = 0;
            let count = 0;
            for (const [id, pos] of positions.entries()) {
                hash = ((hash * 31) + id + Math.round(pos.x) + Math.round(pos.y)) >>> 0;
                count += 1;
                if (count > 80) break;
            }
            return hash ^ positions.size;
        };

        const loop = () => {
            const r = rendererRef.current;
            const frame = frameRef.current;
            if (r) {
                r.setOffset(panRef.current.x, panRef.current.y);
                r.setZoom(zoomRef.current);
                r.render(frame?.w || 96, frame?.h || 96);
                if (Date.now() - lastThoughtTick.current > 350) {
                    const nextPositions = r.getEntityScreenPositions();
                    const nextHash = hashPositions(nextPositions);
                    if (nextHash !== positionsHashRef.current) {
                        positionsHashRef.current = nextHash;
                        setEntityPositions(nextPositions);
                    }
                    lastThoughtTick.current = Date.now();
                }
            }
            animRef.current = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animRef.current);
        };
    }, []);

    useEffect(() => {
        onFrameRef.current = onFrame;
    }, [onFrame]);

    // Update theme
    useEffect(() => {
        if (rendererRef.current && theme) {
            rendererRef.current.setTheme(theme);
        }
    }, [theme]);

    // Update fields
    useEffect(() => {
        if (fields && rendererRef.current) {
            rendererRef.current.setFields(fields);
        }
    }, [fields]);

    // Handle initial frame
    useEffect(() => {
        if (initialFrame && rendererRef.current) {
            frameRef.current = initialFrame;
            rendererRef.current.setEntities(initialFrame.entities);
            onFrameRef.current?.(initialFrame);
        }
    }, [initialFrame]);

    // WebSocket connection
    useEffect(() => {
        if (!apiBase) return;

        const wsUrl = `${apiBase.replace(/^http/, "ws")}/ws/stream`;
        let reconnectTimer: number | null = null;
        let closed = false;
        let attempt = 0;

        const connect = () => {
            if (closed) return;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('PixelArtView: WebSocket connected');
                attempt = 0;
            };

            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.entities && data.t !== undefined) {
                        frameRef.current = data as FramePayload;
                        rendererRef.current?.setEntities(data.entities);
                        onFrameRef.current?.(data);
                    }
                    if (data.type === "fields" && data.data) {
                        rendererRef.current?.setFields(data.data);
                    }
                } catch (e) {
                    console.error("WebSocket parse error:", e);
                }
            };

            ws.onclose = () => {
                console.log('PixelArtView: WebSocket closed, reconnecting...');
                const delay = Math.min(15000, 1000 * Math.pow(1.4, attempt++));
                reconnectTimer = window.setTimeout(connect, delay);
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connect();

        return () => {
            closed = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            wsRef.current?.close();
        };
    }, [apiBase]);

    // Mouse handlers for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        panRef.current.dragging = true;
        panRef.current.startX = e.clientX - panRef.current.x;
        panRef.current.startY = e.clientY - panRef.current.y;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (panRef.current.dragging) {
            panRef.current.x = e.clientX - panRef.current.startX;
            panRef.current.y = e.clientY - panRef.current.startY;
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        panRef.current.dragging = false;
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
            const delta = -Math.sign(e.deltaY) * 0.15;
            zoomRef.current = Math.max(1.0, Math.min(4, zoomRef.current + delta));
    }, []);

    const httpBase = useMemo(() => {
        const base = apiBase || "";
        return base.replace(/^ws/, "http").replace(/\/+$/, "");
    }, [apiBase]);

    // Ollama status polling
    useEffect(() => {
        if (!httpBase) return;
        let cancelled = false;
        const check = async () => {
            try {
                const res = await fetch(`${httpBase}/api/ollama/status`);
                if (!res.ok) throw new Error("status");
                const data = await res.json();
                if (!cancelled) setOllamaConnected(Boolean(data.available));
            } catch {
                if (!cancelled) setOllamaConnected(false);
            }
        };
        void check();
        const timer = window.setInterval(check, 30000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [httpBase]);

    // Thought generation
    useEffect(() => {
        if (!ollamaConnected || !httpBase) return;
        const generate = async () => {
            try {
                const res = await fetch(`${httpBase}/api/ollama/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ max_count: 2, actions: true, apply_actions: true }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.thoughts?.length) {
                    setThoughts((prev) => [...prev, ...data.thoughts]);
                }
            } catch {
                return;
            }
        };
        const timer = window.setInterval(generate, 8000);
        void generate();
        return () => window.clearInterval(timer);
    }, [ollamaConnected, httpBase]);

    // Fallback village chatter when Ollama is unavailable.
    useEffect(() => {
        if (ollamaConnected) return;
        const barkSets: Record<string, string[]> = {
            settler: [
                "Morning rounds.",
                "Trade is brisk today.",
                "The market's lively.",
                "We should gather by the grove.",
                "Wind feels different.",
            ],
            outsider: [
                "Passing through.",
                "This village is thriving.",
                "New roads to explore.",
            ],
            fauna: [
                "*sniff*",
                "*chirp*",
                "*rustle*",
            ],
            default: [
                "Another busy day.",
                "All is calm.",
            ],
        };
        const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
        const timer = window.setInterval(() => {
            const frame = frameRef.current;
            if (!frame?.entities?.length) return;
            const entity = pick(frame.entities);
            const kind = (entity.kind || entity.color || "default").toLowerCase();
            const pool =
                kind.includes("fauna") || kind.includes("animal")
                    ? barkSets.fauna
                    : kind.includes("outsider") || kind.includes("alien")
                        ? barkSets.outsider
                        : kind.includes("settler") || kind.includes("human") || kind.includes("villager")
                            ? barkSets.settler
                            : barkSets.default;
            setThoughts((prev) => [
                ...prev,
                {
                    entity_id: entity.id,
                    text: pick(pool),
                    is_speech: true,
                    duration_ms: 2400,
                },
            ]);
        }, 11000);
        return () => window.clearInterval(timer);
    }, [ollamaConnected]);

    const handleThoughtExpire = useCallback((entityId: number) => {
        setThoughts((prev) => prev.filter((t) => t.entity_id !== entityId));
    }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!onSelect || !rendererRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const positions = rendererRef.current.getEntityScreenPositions();
        let picked: number | null = null;
        let bestDist = 24;
        for (const [id, pos] of positions.entries()) {
            const dx = pos.x - clickX;
            const dy = pos.y - clickY;
            const dist = Math.hypot(dx, dy);
            if (dist < bestDist) {
                bestDist = dist;
                picked = id;
            }
        }
        onSelect(picked);
    }, [onSelect]);

    return (
        <div
            className="pixel-art-view"
            style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
        >
            <EntityThoughts thoughts={thoughts} entityPositions={entityPositions} onThoughtExpire={handleThoughtExpire} />
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    imageRendering: "pixelated",
                    cursor: panRef.current.dragging ? "grabbing" : "grab"
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onClick={handleClick}
            />
        </div>
    );
}
