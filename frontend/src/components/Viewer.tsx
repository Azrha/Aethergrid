import React from "react";
import EngineView from "./EngineView";

export default function Viewer() {
  const raw = (import.meta.env.VITE_API_URL || window.location.origin || "").trim();
  let base = "http://127.0.0.1:8000";
  try {
    const parsed = new URL((raw || base).replace(/^ws/, "http"));
    if (parsed.port === "5173") {
      parsed.port = "8000";
    }
    if (!parsed.port && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      parsed.port = "8000";
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    base = parsed.toString().replace(/\/+$/, "");
  } catch {
    base = "http://127.0.0.1:8000";
  }
  const params = new URLSearchParams(window.location.search);
  const theme = (params.get("theme") || "living").trim();
  const assetStyle = (params.get("assets") || "assets").trim() as "assets" | "procedural" | "sprites";
  const modeParam = (params.get("mode") || "3d").trim();
  const mode = modeParam === "2d" ? "2d" : "3d";
  return (
    <EngineView mode={mode} apiBase={base} assetStyle={assetStyle} showDiagnostics={false} theme={theme} />
  );
}
