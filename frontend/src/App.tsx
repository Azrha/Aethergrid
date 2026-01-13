import React, { useEffect, useMemo, useState, useRef } from "react";
import EngineView from "./components/EngineView";
import { AmbientAudio } from "./engine/ambientAudio";

const DEFAULT_ENTITY_COUNT = 300;  // More entities for a living world
const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEFAULT_PRESET_ID = "living_world.json";

const normalizeApiBase = (value?: string) => {
  const raw = (value || "").trim();
  if (!raw) return DEFAULT_API_BASE;
  try {
    const parsed = new URL(raw.replace(/^ws/, "http"));
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

const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "")
);

type Preset = {
  id: string;
  name: string;
  description: string;
  seed: number;
};

type PresetDetail = {
  name: string;
  description: string;
  dsl: string;
  profiles: unknown[];
  seed: number;
};

type FrameEntity = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  kind?: string;
  energy?: number;
  wealth?: number;
  mass?: number;
  hardness?: number;
};

type FramePayload = {
  t: number;
  w: number;
  h: number;
  entities: FrameEntity[];
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

const formatNumber = (value: number, digits = 1) => {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits);
};

const pickTheme = (presetId: string) => {
  if (presetId.includes("space")) return "space";
  if (presetId.includes("fantasy")) return "fantasy";
  if (presetId.includes("dino")) return "dino";
  if (presetId.includes("oceanic")) return "oceanic";
  if (presetId.includes("frostbound")) return "frostbound";
  if (presetId.includes("emberfall")) return "emberfall";
  if (presetId.includes("skyborne")) return "skyborne";
  if (presetId.includes("ironwild")) return "ironwild";
  return "living";
};

export default function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<string>("");
  const [dsl, setDsl] = useState("");
  const [profiles, setProfiles] = useState<unknown[] | null>(null);
  const [seed, setSeed] = useState(42);
  const [n, setN] = useState(400);  // Large entity count for living world
  const [zoom, setZoom] = useState(1.0);  // Camera zoom level
  const [tickMs, setTickMs] = useState(33);
  const [steps, setSteps] = useState(1);
  const [run, setRun] = useState(false);
  const [backend, setBackend] = useState("cpu");
  const [gpuAvailable, setGpuAvailable] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [mode, setMode] = useState<"2d" | "3d" | "isometric">("isometric");
  const [assetStyle, setAssetStyle] = useState<"assets" | "procedural">("assets");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.18);
  const audioRef = useRef<AmbientAudio | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [applying, setApplying] = useState(false);
  const [runningUpdate, setRunningUpdate] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [initialFrame, setInitialFrame] = useState<FramePayload | null>(null);
  const [fields, setFields] = useState<FieldPayload | null>(null);
  const [lastFrame, setLastFrame] = useState<FramePayload | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [liveStats, setLiveStats] = useState({
    time: 0,
    entities: 0,
    energy: 0,
    wealth: 0,
    kinds: [] as string[],
  });

  const selectedEntity = selectedId && lastFrame
    ? lastFrame.entities.find((entity) => entity.id === selectedId) || null
    : null;

  useEffect(() => {
    setLoadingPresets(true);
    setStatus("Loading presets...");
    let cancelled = false;
    let healthTimer: number | null = null;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
        if (!res.ok) throw new Error("Health check failed");
        const data = await res.json();
        if (cancelled) return;
        setGpuAvailable(Boolean(data.gpu));
        setBackendReady(true);
      } catch {
        if (cancelled) return;
        setGpuAvailable(false);
        setBackendReady(false);
      }
    };

    void checkHealth();
    healthTimer = window.setInterval(checkHealth, 2000);

    fetch(`${API_BASE}/api/presets`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load presets");
        return r.json();
      })
      .then((data) => setPresets(data))
      .catch((err) => {
        setStatus(`Error: ${err.message}`);
      })
      .finally(() => {
        setLoadingPresets(false);
        setStatus((prev) => (prev.startsWith("Error:") ? prev : "Idle"));
      });

    return () => {
      cancelled = true;
      if (healthTimer) window.clearInterval(healthTimer);
    };
  }, []);

  const wsDisplay = useMemo(() => {
    return `${API_BASE.replace(/^http/, "ws")}/ws/stream`;
  }, []);

  useEffect(() => {
    if (mode === "3d") {
      if (gpuAvailable) {
        if (backend !== "gpu") {
          setBackend("gpu");
          setStatus("3D mode selected. GPU enabled.");
        }
      } else {
        if (backend !== "cpu") {
          setBackend("cpu");
        }
        setStatus("3D mode selected but GPU unavailable. Using CPU.");
      }
    }
  }, [mode, gpuAvailable]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new AmbientAudio();
    }
    const themeId = pickTheme(activePreset);
    const audio = audioRef.current;
    if (!audioEnabled) {
      audio.disable();
      return;
    }
    void audio.enable(themeId, audioVolume);
  }, [audioEnabled, audioVolume, activePreset]);

  const loadPreset = async (id: string) => {
    if (!id) return null;
    setLoadingPreset(true);
    setStatus("Loading preset...");
    try {
      const res = await fetch(`${API_BASE}/api/preset/${id}`);
      if (!res.ok) throw new Error("Failed to load preset");
      const data = (await res.json()) as PresetDetail;
      setActivePreset(id);
      setDsl(data.dsl);
      setProfiles(data.profiles || null);
      setSeed(data.seed || 42);
      setStatus("Preset loaded");
      return data;
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
      return null;
    } finally {
      setLoadingPreset(false);
    }
  };

  const applyProgram = async (payload?: {
    dsl: string;
    profiles: unknown[] | null;
    seed: number;
    n: number;
    backend: string;
  }) => {
    setApplying(true);
    setStatus("Applying program...");
    const nextPayload = payload || { dsl, profiles, seed, n, backend };
    try {
      const res = await fetch(`${API_BASE}/api/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      });
      if (!res.ok) {
        const msg = await res.json().catch(async () => ({ detail: await res.text() }));
        throw new Error(msg.detail || "Apply failed");
      }
      const data = (await res.json().catch(() => null)) as
        | { gpu?: boolean; frame?: FramePayload | null; fields?: FieldPayload | null }
        | null;
      if (data?.frame) {
        setInitialFrame(data.frame);
      }
      if (data?.fields) {
        setFields(data.fields);
      }
      if (data && data.gpu === false && nextPayload.backend === "gpu") {
        setBackend("cpu");
        setStatus("GPU unavailable. Falling back to CPU.");
      } else {
        setStatus("Applied");
      }
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setApplying(false);
    }
  };

  const sendRun = async (value: boolean) => {
    setRun(value);
    setRunningUpdate(true);
    setStatus(value ? "Running..." : "Paused");
    try {
      const res = await fetch(`${API_BASE}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: value, tick_ms: tickMs, steps }),
      });
      if (!res.ok) throw new Error("Failed to update run state");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setRunningUpdate(false);
    }
  };

  const fetchFields = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fields?step=4`);
      if (!res.ok) return;
      if (res.status === 204) return;
      const payload = (await res.json()) as FieldPayload;
      setFields(payload);
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (!backendReady) return;
    // FETCH FIELDS ALWAYS to ensure terrain is visible, even if paused
    void fetchFields();

    // Continue polling if running
    if (run) {
      const timer = window.setInterval(fetchFields, 4000);
      return () => window.clearInterval(timer);
    }
  }, [backendReady, run]);

  useEffect(() => {
    if (autoStarted) return;
    if (!backendReady || presets.length === 0) return;
    const target = presets.find((preset) => preset.id === DEFAULT_PRESET_ID) || presets[0];
    const autoInit = async () => {
      const detail = await loadPreset(target.id);
      if (!detail) return;
      setAutoStarted(true);
      await applyProgram({
        dsl: detail.dsl,
        profiles: detail.profiles || null,
        seed: detail.seed || 42,
        n,
        backend,
      });
    };
    void autoInit();
  }, [backendReady, presets, autoStarted]);

  const handlePresetChange = async (value: string) => {
    if (!value) return;
    if (run) {
      await sendRun(false);
    }
    const detail = await loadPreset(value);
    if (!detail) return;
    await applyProgram({
      dsl: detail.dsl,
      profiles: detail.profiles || null,
      seed: detail.seed || 42,
      n,
      backend,
    });
  };

  const openPopup = () => {
    const theme = pickTheme(activePreset);
    const params = new URLSearchParams({
      theme,
      assets: assetStyle,
      mode,
    });
    window.open(`/viewer?${params.toString()}`, "mythos_viewer", "width=1400,height=900");
  };

  const handleFrame = (payload: FramePayload) => {
    setLastFrame(payload);
    const entityCount = payload.entities.length;
    const energy = payload.entities.reduce((sum, entity) => sum + (entity.energy ?? 0.6), 0);
    const wealth = payload.entities.reduce((sum, entity) => sum + (entity.wealth ?? 0), 0);
    const kinds = Array.from(
      new Set(payload.entities.map((entity) => entity.kind || entity.color))
    ).slice(0, 5);
    setLiveStats({
      time: payload.t,
      entities: entityCount,
      energy: entityCount ? energy / entityCount : 0,
      wealth: entityCount ? wealth / entityCount : 0,
      kinds,
    });
    if (selectedId && !payload.entities.some((entity) => entity.id === selectedId)) {
      setSelectedId(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Aethergrid</div>
          <h1>Worldforge Dashboard</h1>
          <div className="subtle">Realtime simulation, procedural ecology, pixel-isometric rendering.</div>
        </div>
        <div className="topbar-actions">
          <div className={`status-pill ${backendReady ? "ok" : "warn"}`}>
            {backendReady ? "Core online" : "Core offline"}
          </div>
          <div className={`status-pill ${gpuAvailable ? "ok" : "warn"}`}>
            {gpuAvailable ? "GPU ready" : "CPU mode"}
          </div>
          <button onClick={() => applyProgram()} disabled={applying}>
            {applying ? "Applying..." : "Apply"}
          </button>
          <button className="secondary" onClick={() => sendRun(!run)} disabled={runningUpdate}>
            {run ? "Pause" : "Run"}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="side-panel">
          <section className="card">
            <h3>Scenario</h3>
            <label>Preset</label>
            <select value={activePreset} onChange={(e) => handlePresetChange(e.target.value)}>
              <option value="">{loadingPresets ? "Loading..." : "Select a preset"}</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="hint">{loadingPreset ? "Loading preset..." : "Pick a worldpack to seed life."}</div>
          </section>

          <section className="card">
            <h3>Simulation</h3>
            <div className="grid-two">
              <div>
                <label>Entities</label>
                <input type="number" value={n} onChange={(e) => setN(Number(e.target.value))} />
              </div>
              <div>
                <label>Seed</label>
                <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              </div>
              <div>
                <label>Tick (ms)</label>
                <input type="number" value={tickMs} onChange={(e) => setTickMs(Number(e.target.value))} />
              </div>
              <div>
                <label>Steps</label>
                <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} />
              </div>
            </div>
            <label>Compute backend</label>
            <select value={backend} onChange={(e) => setBackend(e.target.value)}>
              <option value="cpu">CPU</option>
              <option value="gpu" disabled={!gpuAvailable}>
                GPU {gpuAvailable ? "" : "(unavailable)"}
              </option>
            </select>
            <div className="hint">Flow: Preset → Apply → Run. Re-apply after backend changes.</div>
          </section>

          <section className="card">
            <h3>Live feed</h3>
            <div className="stat-grid">
              <div>
                <div className="stat-label">Simulation time</div>
                <div className="stat-value">{formatNumber(liveStats.time, 2)}</div>
              </div>
              <div>
                <div className="stat-label">Entities</div>
                <div className="stat-value">{liveStats.entities}</div>
              </div>
              <div>
                <div className="stat-label">Avg energy</div>
                <div className="stat-value">{formatNumber(liveStats.energy, 2)}</div>
              </div>
              <div>
                <div className="stat-label">Avg wealth</div>
                <div className="stat-value">{formatNumber(liveStats.wealth, 2)}</div>
              </div>
            </div>
            <div className="kind-list">
              {liveStats.kinds.length ? liveStats.kinds.map((kind) => (
                <span key={kind}>{kind}</span>
              )) : "No entities yet"}
            </div>
          </section>

          <section className="card">
            <h3>Entity Inspector</h3>
            {selectedEntity ? (
              <div className="inspector">
                <div>
                  <div className="stat-label">Entity #{selectedEntity.id}</div>
                  <div className="stat-value">{selectedEntity.kind || selectedEntity.color}</div>
                </div>
                <div className="grid-two">
                  <div>
                    <div className="stat-label">Energy</div>
                    <div className="stat-value">{formatNumber(selectedEntity.energy ?? 0, 2)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Wealth</div>
                    <div className="stat-value">{formatNumber(selectedEntity.wealth ?? 0, 2)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Mass</div>
                    <div className="stat-value">{formatNumber(selectedEntity.mass ?? 0, 2)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Hardness</div>
                    <div className="stat-value">{formatNumber(selectedEntity.hardness ?? 0, 2)}</div>
                  </div>
                </div>
                <div className="hint">Position: {formatNumber(selectedEntity.x, 1)}, {formatNumber(selectedEntity.y, 1)}</div>
              </div>
            ) : (
              <div className="hint">Click any creature or structure to inspect it.</div>
            )}
          </section>

          <section className="card">
            <h3>Renderer</h3>
            <label>View mode</label>
            <div className="toggle-row">
              <button className={mode === "isometric" ? "active" : "secondary"} onClick={() => setMode("isometric")}>
                Px-Iso
              </button>
              <button className={mode === "3d" ? "active" : "secondary"} onClick={() => setMode("3d")}>
                Cinematic 3D
              </button>
              <button className={mode === "2d" ? "active" : "secondary"} onClick={() => setMode("2d")}>
                Tactical 2D
              </button>
            </div>
            <label>3D assets</label>
            <select value={assetStyle} onChange={(e) => setAssetStyle(e.target.value as "assets" | "procedural")}>
              <option value="assets">Real 3D assets</option>
              <option value="procedural">Procedural</option>
            </select>
            <label>Diagnostics</label>
            <div className="toggle-row">
              <button
                className={showDiagnostics ? "active" : "secondary"}
                onClick={() => setShowDiagnostics((prev) => !prev)}
              >
                {showDiagnostics ? "Overlay on" : "Overlay off"}
              </button>
            </div>
            <label>Mood audio</label>
            <div className="toggle-row">
              <button
                className={audioEnabled ? "active" : "secondary"}
                onClick={() => setAudioEnabled((prev) => !prev)}
              >
                {audioEnabled ? "Ambient on" : "Ambient off"}
              </button>
              <input
                className="range"
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={audioVolume}
                onChange={(e) => setAudioVolume(Number(e.target.value))}
              />
            </div>
            <label>Camera Zoom</label>
            <div className="slider-row">
              <input
                className="range"
                type="range"
                min="0.3"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span className="slider-value">{zoom.toFixed(1)}x</span>
            </div>
            <div className="hint">Drag to orbit. Scroll to zoom. Click to inspect.</div>
            <button className="secondary" onClick={openPopup}>
              Popout 3D View
            </button>
          </section>

          <section className="card">
            <h3>Program DSL</h3>
            <textarea value={dsl} onChange={(e) => setDsl(e.target.value)} rows={10} />
          </section>
        </aside>

        <main className="main-panel">
          <div className="status-row">
            <div className="badge">{activePreset || "Custom"}</div>
            <div className="status-text">{status}</div>
            <div className="status-text">Stream: {wsDisplay}</div>
          </div>
          <div className="viewer-card">
            <EngineView
              mode={mode}
              apiBase={backendReady ? API_BASE : ""}
              initialFrame={initialFrame}
              onFrame={handleFrame}
              onSelect={setSelectedId}
              fields={fields}
              theme={pickTheme(activePreset)}
              assetStyle={assetStyle}
              showDiagnostics={showDiagnostics}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
