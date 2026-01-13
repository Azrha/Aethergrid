#!/usr/bin/env bash
set -u
set +e

echo "[*] Starting Mythos Asset Upgrade..."
echo "[*] Creating asset directories..."
mkdir -p frontend/public/assets/models/external

# --- 1. DOWNLOAD REALISTIC MODELS (Reliable Sources) ---
echo "[*] Downloading reliable GLB models..."

# Humanoid (Robot Expressive - Three.js standard, animated)
curl -L -o frontend/public/assets/models/external/humanoid.glb \
    https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb

# Settler (CesiumMan - Khronos standard, animated)
curl -L -o frontend/public/assets/models/external/settler.glb \
    https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb

# Animal (Fox - Khronos standard, animated)
curl -L -o frontend/public/assets/models/external/animal.glb \
    https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb

# Pilot (Astronaut - Google Model Viewer standard)
curl -L -o frontend/public/assets/models/external/pilot.glb \
    https://raw.githubusercontent.com/google/model-viewer/master/packages/shared-assets/models/Astronaut.glb

# Tribe (Soldier - Three.js standard)
curl -L -o frontend/public/assets/models/external/soldier.glb \
    https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb

echo "[*] Assets downloaded."

# --- 2. UPDATE ASSETS CONFIGURATION (Non-destructive) ---
# We update assets.ts to point to these new models AND include the normalization parameters (targetHeight).
# This activates the logic already present in Renderer.ts without modifying Renderer.ts code.

cat > frontend/src/engine/assets.ts <<'TS'
export type AssetStyle = "assets" | "procedural";

export type AssetSpec = {
  url: string;
  scale: number;
  yOffset?: number;
  rotateY?: number;
  tint?: string;
  emissive?: string;
  roughness?: number;
  metalness?: number;
  // Normalization parameters expected by Renderer.ts
  targetHeight?: number;
  heightRange?: [number, number];
  targetExtent?: number;
  extentRange?: [number, number];
};

export type AssetSet = Record<string, AssetSpec>;

// Define base assets with normalization to fix the "way too big" issue
const BASE_ASSETS: AssetSet = {
  // Humans & Humanoids
  settler: { 
    url: "/assets/models/external/settler.glb", 
    scale: 1.0, 
    targetHeight: 1.8, 
    heightRange: [1.5, 2.0] 
  },
  tribe: { 
    url: "/assets/models/external/soldier.glb", 
    scale: 1.0, 
    targetHeight: 1.85, 
    heightRange: [1.6, 2.1] 
  },
  pilot: { 
    url: "/assets/models/external/pilot.glb", 
    scale: 1.0, 
    targetHeight: 1.8, 
    heightRange: [1.6, 2.0] 
  },
  fae: { 
    url: "/assets/models/external/humanoid.glb", 
    scale: 0.6, 
    targetHeight: 1.2, 
    heightRange: [0.8, 1.5],
    tint: "#ffb7b2"
  },
  synth: { 
    url: "/assets/models/external/humanoid.glb", 
    scale: 1.0, 
    targetHeight: 2.0, 
    heightRange: [1.8, 2.2] 
  },
  
  // Animals & Creatures
  fauna: { 
    url: "/assets/models/external/animal.glb", 
    scale: 1.0, 
    targetHeight: 0.6, 
    heightRange: [0.4, 0.9] 
  },
  beast: { 
    url: "/assets/models/external/animal.glb", 
    scale: 1.5, 
    targetHeight: 1.2, 
    heightRange: [0.9, 1.6],
    tint: "#a05050"
  },
  
  // Aliens (Using Robot/Pilot as placeholders with weird tints)
  outsider: { 
    url: "/assets/models/external/humanoid.glb", 
    scale: 1.2, 
    targetHeight: 2.2, 
    heightRange: [2.0, 2.5],
    tint: "#00ff00"
  },
  voidborn: { 
    url: "/assets/models/external/pilot.glb", 
    scale: 1.1, 
    targetHeight: 2.0, 
    heightRange: [1.8, 2.2],
    emissive: "#aa00ff"
  },

  // Dinos (Using Animal scaled up heavily as a "Dino" placeholder for now)
  saurian: { 
    url: "/assets/models/external/animal.glb", 
    scale: 2.5, 
    targetHeight: 3.0, 
    heightRange: [2.5, 4.0],
    tint: "#6f9c62"
  },
  raptor: { 
    url: "/assets/models/external/animal.glb", 
    scale: 1.8, 
    targetHeight: 2.0, 
    heightRange: [1.5, 2.5],
    tint: "#9bbd5a"
  },
  wyrm: { 
    url: "/assets/models/external/animal.glb", 
    scale: 3.0, 
    targetHeight: 1.0, // Low to ground
    heightRange: [0.5, 1.5],
    tint: "#a67cff",
    emissive: "#7b5aff"
  },

  // Environment / Static (Using Primitives for stability and performance)
  habitat: { 
    url: "PRIMITIVE_BOX", 
    scale: 1.0, 
    targetHeight: 4.0, 
    heightRange: [3.0, 6.0],
    tint: "#c2b3a3" 
  },
  obelisk: { 
    url: "PRIMITIVE_CONE", 
    scale: 1.0, 
    targetHeight: 8.0, 
    heightRange: [6.0, 12.0],
    emissive: "#c6a8ff" 
  },
  station: { 
    url: "PRIMITIVE_BOX", 
    scale: 1.0, 
    targetHeight: 6.0, 
    heightRange: [4.0, 10.0],
    metalness: 0.8 
  },
  grove: { 
    url: "PRIMITIVE_CONE", 
    scale: 1.0, 
    targetHeight: 5.0, 
    heightRange: [3.0, 8.0],
    tint: "#2d5a27" 
  },
  cycad: { 
    url: "PRIMITIVE_CONE", 
    scale: 1.0, 
    targetHeight: 3.0, 
    heightRange: [2.0, 5.0],
    tint: "#6b8f4f" 
  },
};

// Apply themes
export const ASSET_SETS: Record<string, AssetSet> = {
  living: { ...BASE_ASSETS },
  fantasy: {
    ...BASE_ASSETS,
    fae: { ...BASE_ASSETS.fae, emissive: "#c9a6ff" },
  },
  dino: {
    ...BASE_ASSETS,
    tribe: { ...BASE_ASSETS.tribe, tint: "#c49a6c" },
  },
  space: {
    ...BASE_ASSETS,
    pilot: { ...BASE_ASSETS.pilot, tint: "#bcd7ff" },
    synth: { ...BASE_ASSETS.synth, emissive: "#2aa5ff" },
  },
};

export const ASSET_KIND_FALLBACK: Record<string, keyof AssetSet> = {
  humanoid: "settler",
  animal: "fauna",
  alien: "outsider",
  machine: "synth",
  building: "habitat",
  tree: "grove",
  dino: "saurian",
};
TS

echo "[OK] assets.ts updated with normalization parameters."
echo "[DONE] Run ./run_stack.sh to restart with fixed models."
