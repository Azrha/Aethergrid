import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import EngineView from "./components/EngineView";
import PixelArtView from "./components/PixelArtView";
import { CharacterCreator } from "./components/CharacterCreator";
import { AmbientAudio } from "./engine/ambientAudio";

const DEFAULT_ENTITY_COUNT = 300;  // More entities for a living world
const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEFAULT_PRESET_ID = "ai_village.json";

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
  mood?: string;
};

type PresetDetail = {
  name: string;
  description: string;
  dsl: string;
  profiles: unknown[];
  seed: number;
  mood?: string;
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
  d?: number;
  voxels?: number[][][];
  voxel_step?: { x: number; y: number; z: number };
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

const resolveTheme = (presetId: string, mood?: string) => {
  const moodKey = (mood || "").toLowerCase();
  if (moodKey) return moodKey;
  return pickTheme(presetId);
};

export default function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<string>("");
  const [presetMood, setPresetMood] = useState<string>("");
  const [dsl, setDsl] = useState("");
  const [profiles, setProfiles] = useState<unknown[] | null>(null);
  const [seed, setSeed] = useState(42);
  const [n, setN] = useState(5);  // Default to a tiny village for the AI Village preset
  const [zoom, setZoom] = useState(1.0);  // Camera zoom level
  const [tickMs, setTickMs] = useState(33);
  const [steps, setSteps] = useState(1);
  const [run, setRun] = useState(false);
  const [backend, setBackend] = useState("cpu");
  const [gpuAvailable, setGpuAvailable] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [mode, setMode] = useState<"2d" | "3d" | "isometric" | "pixel">("pixel");
  const [assetStyle, setAssetStyle] = useState<"assets" | "procedural" | "sprites">("assets");
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
  const [showCharCreator, setShowCharCreator] = useState(false);
  const [customProfiles, setCustomProfiles] = useState<any[]>([]);
  const applyTimeoutMs = 15000;

  const fetchWithTimeout = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), applyTimeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }, [applyTimeoutMs]);

  const countProfiles = useCallback((items?: unknown[] | null) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, p) => sum + Number((p as any).count || 0), 0);
  }, []);

  const selectedEntity = selectedId && lastFrame
    ? lastFrame.entities.find((entity) => entity.id === selectedId) || null
    : null;

  useEffect(() => {
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

    return () => {
      cancelled = true;
      if (healthTimer) window.clearInterval(healthTimer);
    };
  }, []);

  useEffect(() => {
    if (!backendReady) return;
    let cancelled = false;
    setLoadingPresets(true);
    setStatus("Loading presets...");

    const fetchPresets = async (attempts = 0) => {
      try {
        const res = await fetch(`${API_BASE}/api/presets`);
        if (!res.ok) throw new Error("Failed to load presets");
        const data = await res.json();
        if (cancelled) return;
        setPresets(data);
      } catch (err) {
        if (attempts < 4 && !cancelled) {
          window.setTimeout(() => fetchPresets(attempts + 1), 1000);
          return;
        }
        if (!cancelled) setStatus(`Error: ${(err as Error).message}`);
      } finally {
        if (!cancelled) {
          setLoadingPresets(false);
          setStatus((prev) => (prev.startsWith("Error:") ? prev : "Idle"));
        }
      }
    };

    void fetchPresets();
    return () => {
      cancelled = true;
    };
  }, [backendReady]);

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
    const themeId = resolveTheme(activePreset, presetMood);
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
      setPresetMood(data.mood || "");
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

    const mergedProfiles = (profiles || []).concat(customProfiles);
    // If payload is provided, use it but we assume payload.profiles needs merging if not already done?
    // Actually, callsites usually pass specific profiles.
    // Let's check payload.
    // If payload exists, use payload.profiles.
    // If NOT payload, use state `profiles` merged with `customProfiles`.

    // Safer: Logic inside applyProgram to use 'nextPayload'.
    let nextPayload = payload || { dsl, profiles: mergedProfiles, seed, n, backend };
    // If payload WAS passed (e.g. from preset load), we should also append custom profiles?
    if (payload && payload.profiles) {
      // We want custom chars to persist across preset changes? 
      // Maybe yes? User creates a char, then switches world.
      // So we append customProfiles to payload.profiles too.
      nextPayload = { ...payload, profiles: (payload.profiles as any[]).concat(customProfiles) };
    }
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/apply`, {
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
      } else {
        void fetchFields();
      }
      if (data && data.gpu === false && nextPayload.backend === "gpu") {
        setBackend("cpu");
        setStatus("GPU unavailable. Falling back to CPU.");
      } else {
        setStatus("Applied");
      }
    } catch (err) {
      const message = (err as Error).name === "AbortError"
        ? "Apply timed out. Backend not responding."
        : (err as Error).message;
      setStatus(`Error: ${message}`);
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
      const step = mode === "pixel" ? 2 : 1;
      const includeVoxels = mode === "3d";
      const url = new URL(`${API_BASE}/api/fields`);
      url.searchParams.set("step", String(step));
      if (includeVoxels) {
        url.searchParams.set("voxels", "1");
        url.searchParams.set("z_step", "1");
      }
      const res = await fetch(url.toString());
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
      const presetCount = countProfiles(detail.profiles || []);
      if (presetCount > 0) {
        setN(presetCount);
      }
      await applyProgram({
        dsl: detail.dsl,
        profiles: detail.profiles || null,
        seed: detail.seed || 42,
        n: presetCount > 0 ? presetCount : n,
        backend,
      });
      if (!run) {
        await sendRun(true);
      }
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
    const presetCount = countProfiles(detail.profiles || []);
    if (presetCount > 0) {
      setN(presetCount);
    }
    await applyProgram({
      dsl: detail.dsl,
      profiles: detail.profiles || null,
      seed: detail.seed || 42,
      n: presetCount > 0 ? presetCount : n,
      backend,
    });
  };

  const openPopup = () => {
    const theme = resolveTheme(activePreset, presetMood);
    const params = new URLSearchParams({
      theme,
      assets: assetStyle,
      mode,
    });
    window.open(`/viewer?${params.toString()}`, "mythos_viewer", "width=1400,height=900");
  };

  const handleFrame = useCallback((payload: FramePayload) => {
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
  }, [selectedId]);

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand-block">
          <div className="eyebrow">Aethergrid</div>
          <h1>Worldforge Dashboard</h1>
          <div className="subtle">Realtime simulation, procedural ecology, pixel-isometric rendering.</div>
        </div>
        <div className="masthead-actions">
          <div className="chip-row">
            <span className={`chip ${backendReady ? "ok" : "warn"}`}>
              {backendReady ? "Core online" : "Core offline"}
            </span>
            <span className={`chip ${gpuAvailable ? "ok" : "warn"}`}>
              {gpuAvailable ? "GPU ready" : "CPU mode"}
            </span>
          </div>
          <div className="action-row">
            <button className="primary" onClick={() => applyProgram()} disabled={applying}>
              {applying ? "Applying..." : "Apply"}
            </button>
            <button className="secondary" onClick={() => sendRun(!run)} disabled={runningUpdate}>
              {run ? "Pause" : "Run"}
            </button>
            <button className="ghost" type="button" onClick={() => setShowCharCreator(true)}>
              + Create Char
            </button>
          </div>
        </div>
      </header>

      <div className="deck">
        <aside className="control-rail">
          <section className="panel">
            <h3>Scenario</h3>
            <label>Preset</label>
            <div className="preset-list">
              {presets.map((p) => {
                const isSelected = activePreset === p.id;
                const thumbUrl = `${API_BASE}/api/thumbnail/${p.id}`;
                // We need to handle 404s for thumbnails naturally by letting img fail to a fallback or background color
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-card ${isSelected ? "active" : ""}`}
                    onClick={() => handlePresetChange(p.id)}
                  >
                    <div className="preset-thumb">
                      <img
                        src={thumbUrl}
                        alt={p.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="preset-info">
                      <div className="preset-title">{p.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button className="secondary full" onClick={async () => {
              const name = prompt("Enter a name for your world:");
              if (!name) return;

              // Capture Thumbnail
              const canvas = document.querySelector("canvas");
              let thumb = "";
              if (canvas) {
                thumb = canvas.toDataURL("image/png", 0.5); // Low quality for thumbnail
              }

              // Save
              try {
                setStatus("Saving world...");
                const mergedProfiles = (profiles || []).concat(customProfiles);
                const res = await fetch(`${API_BASE}/api/save`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    description: "User saved world",
                    dsl,
                    profiles: mergedProfiles,
                    thumbnail: thumb
                  })
                });
                if (!res.ok) throw new Error("Save failed");
                const data = await res.json();
                setStatus(`Saved: ${name}`);

                // Refresh presets
                const r = await fetch(`${API_BASE}/api/presets`);
                const presetsData = await r.json();
                setPresets(presetsData);
                setActivePreset(data.id); // Select the new world
              } catch (e) {
                setStatus(`Error saving: ${(e as Error).message}`);
              }
            }}>
              💾 Save World
            </button>
            <div className="hint">{loadingPreset ? "Loading preset..." : "Pick a world or save your own."}</div>
          </section>

          <section className="panel">
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
            <div className="spacer" />
            <button className="secondary" onClick={() => setShowCharCreator(true)}>
              + Spawn Character
            </button>
          </section>

          <section className="panel">
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

          <section className="panel">
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

          <section className="panel">
            <h3>Renderer</h3>
            <label>View mode</label>
            <div className="mode-grid">
              <button className={mode === "pixel" ? "active" : "secondary"} onClick={() => setMode("pixel")}>
                🎨 FFT Pixel
              </button>
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
            <select value={assetStyle} onChange={(e) => setAssetStyle(e.target.value as "assets" | "procedural" | "sprites")}>
              <option value="assets">Real 3D assets</option>
              <option value="procedural">Procedural</option>
              <option value="sprites">Sprites (Billboard)</option>
            </select>
            <label>Diagnostics</label>
            <div className="pill-row">
              <button
                className={showDiagnostics ? "active" : "secondary"}
                onClick={() => setShowDiagnostics((prev) => !prev)}
              >
                {showDiagnostics ? "Overlay on" : "Overlay off"}
              </button>
            </div>
            <label>Mood audio</label>
            <div className="pill-row">
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

          <section className="panel">
            <h3>Program DSL</h3>
            <textarea value={dsl} onChange={(e) => setDsl(e.target.value)} rows={10} />
          </section>
        </aside>

        <main className="stage">
          <div className="stage-banner">
            <div className="stage-tag">{activePreset || "Custom"}</div>
            <div className="stage-meta">{status}</div>
            <div className="stage-meta">Stream: {wsDisplay}</div>
          </div>
          <div className="stage-frame">
            {mode === "pixel" ? (
              <PixelArtView
                apiBase={backendReady ? API_BASE : ""}
                initialFrame={initialFrame}
                onFrame={handleFrame}
                onSelect={setSelectedId}
                fields={fields}
                theme={resolveTheme(activePreset, presetMood)}
              />
            ) : (
              <EngineView
                mode={mode}
                apiBase={backendReady ? API_BASE : ""}
                initialFrame={initialFrame}
                onFrame={handleFrame}
                onSelect={setSelectedId}
                fields={fields}
                theme={resolveTheme(activePreset, presetMood)}
                assetStyle={assetStyle}
                showDiagnostics={showDiagnostics}
              />
            )}
          </div>
        </main>
      </div>


      {
        showCharCreator && (
          <CharacterCreator
            onSpawn={(profile) => {
              const newCustoms = [...customProfiles, profile];
              setCustomProfiles(newCustoms);
              setShowCharCreator(false);
              // We need to fetch current profiles/dsl to apply.
              // We can just call applyProgram({ dsl, profiles: (profiles||[]).concat(newCustoms), seed, n, backend });
              applyProgram({ dsl, profiles: (profiles as any[] || []).concat(newCustoms), seed, n, backend });
            }}
            onClose={() => setShowCharCreator(false)}
          />
        )
      }
    </div >
  );
}
