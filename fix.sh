#!/usr/bin/env bash
set -euo pipefail

ASSETS="frontend/src/engine/assets.ts"
RENDERER="frontend/src/engine/Renderer.ts"
ASSETS_BAK="${ASSETS}.bak"
RENDERER_BAK="${RENDERER}.bak"

[[ -f "$ASSETS_BAK" ]] || { echo "ERROR: missing $ASSETS_BAK"; exit 1; }
[[ -f "$RENDERER_BAK" ]] || { echo "ERROR: missing $RENDERER_BAK"; exit 1; }

# Restore clean originals (fixes the '...' corruption)
cp -a "$ASSETS_BAK" "$ASSETS"
cp -a "$RENDERER_BAK" "$RENDERER"

python3 - <<'PY'
import re
from pathlib import Path

assets_path = Path("frontend/src/engine/assets.ts")
renderer_path = Path("frontend/src/engine/Renderer.ts")

assets = assets_path.read_text(encoding="utf-8")
renderer = renderer_path.read_text(encoding="utf-8")

# ---------------------------
# Patch assets.ts
# ---------------------------

# 1) Extend AssetSpec
if "// [Mythos] asset normalization fields" not in assets:
    m = re.search(r"(export\s+type\s+AssetSpec\s*=\s*\{)([\s\S]*?)(\n\};)", assets)
    if not m:
        raise SystemExit("ERROR: AssetSpec block not found in assets.ts")

    head, body, tail = m.group(1), m.group(2), m.group(3)

    if "targetHeight?" not in body and "targetExtent?" not in body:
        body = body.rstrip() + (
            "\n"
            "  // [Mythos] asset normalization fields\n"
            "  targetHeight?: number;\n"
            "  heightRange?: [number, number];\n"
            "  targetExtent?: number;\n"
            "  extentRange?: [number, number];\n"
        )
        assets = assets[:m.start()] + head + body + tail + assets[m.end():]

# 2) Patch BASE_ASSETS entries by APPENDING ONLY the new fields (no url/scale duplication)
base = re.search(r"(const\s+BASE_ASSETS:\s*AssetSet\s*=\s*\{)([\s\S]*?)(\n\};)", assets)
if not base:
    raise SystemExit("ERROR: BASE_ASSETS block not found in assets.ts")

prefix, body, suffix = base.group(1), base.group(2), base.group(3)

def add_fields_to_key(body: str, key: str, fields: str) -> str:
    # Match a single top-level entry like: key: { ... },
    pat = rf"(^\s*{re.escape(key)}\s*:\s*\{{)([\s\S]*?)(\}}\s*,?\s*$)"
    m = re.search(pat, body, flags=re.M)
    if not m:
        raise SystemExit(f"ERROR: BASE_ASSETS entry not found: {key}")
    pre, inner, post = m.group(1), m.group(2), m.group(3)

    # If already has targetHeight/targetExtent, skip
    if "targetHeight" in inner or "targetExtent" in inner:
        return body

    # Ensure inner ends with comma if it has properties
    inner_stripped = inner.rstrip()
    if inner_stripped and not inner_stripped.rstrip().endswith(","):
        inner_stripped += ","
    inner_new = inner_stripped + " " + fields + " "

    replaced = pre + inner_new + post
    return body[:m.start()] + replaced + body[m.end():]

# Targets/ranges (meters) exactly as agreed
HEIGHT = {
  "settler":  ("targetHeight: 1.7, heightRange: [1.5, 1.9],"),
  "tribe":    ("targetHeight: 1.7, heightRange: [1.5, 1.9],"),
  "pilot":    ("targetHeight: 1.7, heightRange: [1.5, 1.9],"),
  "fae":      ("targetHeight: 1.7, heightRange: [1.5, 1.9],"),
  "fauna":    ("targetHeight: 1.6, heightRange: [1.3, 2.0],"),
  "beast":    ("targetHeight: 1.6, heightRange: [1.3, 2.0],"),
  "outsider": ("targetHeight: 1.9, heightRange: [1.6, 2.5],"),
  "voidborn": ("targetHeight: 1.9, heightRange: [1.6, 2.5],"),
  "synth":    ("targetHeight: 1.7, heightRange: [1.3, 2.3],"),
  "habitat":  ("targetHeight: 3.0, heightRange: [2.0, 6.0],"),
  "obelisk":  ("targetHeight: 5.0, heightRange: [3.0, 12.0],"),
  "grove":    ("targetHeight: 6.0, heightRange: [3.0, 15.0],"),
  "cycad":    ("targetHeight: 4.0, heightRange: [2.0, 10.0],"),
}

EXTENT = {
  "station": ("targetExtent: 10.0, extentRange: [5.0, 25.0],"),
  "saurian": ("targetExtent: 6.0, extentRange: [4.0, 10.0],"),
  "raptor":  ("targetExtent: 4.0, extentRange: [2.5, 6.0],"),
  "wyrm":    ("targetExtent: 8.0, extentRange: [5.0, 15.0],"),
}

for k,v in HEIGHT.items():
    body = add_fields_to_key(body, k, v)

for k,v in EXTENT.items():
    body = add_fields_to_key(body, k, v)

assets = assets[:base.start()] + prefix + body + suffix + assets[base.end():]
assets_path.write_text(assets, encoding="utf-8", newline="\n")

# ---------------------------
# Patch Renderer.ts
# ---------------------------
if "// [Mythos] size normalization" not in renderer:
    anchor = "clone.scale.multiplyScalar(assetScale);"
    if anchor not in renderer:
        raise SystemExit("ERROR: anchor not found in Renderer.ts: clone.scale.multiplyScalar(assetScale);")

    insert = """
    // [Mythos] size normalization: measure -> normalize outliers -> re-measure/verify
    {
      const __box = new THREE.Box3().setFromObject(clone);
      const __size = new THREE.Vector3();
      __box.getSize(__size);

      const __hasHeight = spec.targetHeight != null && spec.heightRange != null;
      const __hasExtent = spec.targetExtent != null && spec.extentRange != null;

      let __measured: number | null = null;
      if (__hasHeight) __measured = __size.y;
      else if (__hasExtent) __measured = Math.max(__size.x, __size.y, __size.z);

      const __isValid = __measured != null && Number.isFinite(__measured) && __measured > 1e-6;

      if (__isValid) {
        if (__hasHeight) {
          const [minH, maxH] = spec.heightRange!;
          if (__measured! < minH || __measured! > maxH) {
            const adj = spec.targetHeight! / __measured!;
            clone.scale.multiplyScalar(adj);
          }
        } else if (__hasExtent) {
          const [minE, maxE] = spec.extentRange!;
          if (__measured! < minE || __measured! > maxE) {
            const adj = spec.targetExtent! / __measured!;
            clone.scale.multiplyScalar(adj);
          }
        }

        // verify final size
        const __box2 = new THREE.Box3().setFromObject(clone);
        __box2.getSize(__size);
        const __final = __hasHeight ? __size.y : Math.max(__size.x, __size.y, __size.z);

        if (__hasHeight) {
          const [minH, maxH] = spec.heightRange!;
          if (__final < minH || __final > maxH) {
            console.warn(`[Mythos] Asset ${assetKey} final height ${__final.toFixed(3)}m out of range [${minH}, ${maxH}]`);
          }
        } else if (__hasExtent) {
          const [minE, maxE] = spec.extentRange!;
          if (__final < minE || __final > maxE) {
            console.warn(`[Mythos] Asset ${assetKey} final extent ${__final.toFixed(3)}m out of range [${minE}, ${maxE}]`);
          }
        }
      } else {
        console.warn(`[Mythos] Asset ${assetKey} could not be measured for normalization (invalid bounds).`);
      }
    }
"""
    renderer = renderer.replace(anchor, anchor + insert, 1)

renderer_path.write_text(renderer, encoding="utf-8", newline="\n")

print("OK: restored from .bak and applied clean normalization patches.")
PY

echo "OK: Restored from backups + patched cleanly:"
echo " - $ASSETS"
echo " - $RENDERER"
