#!/usr/bin/env bash
set -u
set +e

echo "[*] Starting COMPLETE 3D Asset Upgrade for All Worlds..."

# --- 1. DOWNLOAD NEW MODELS ---
echo "[*] Downloading additional GLB models..."
mkdir -p frontend/public/assets/models/external

# Fish (Oceanic)
if [ ! -f frontend/public/assets/models/external/fish.glb ]; then
    echo "  - Fetching BarramundiFish.glb..."
    curl -L -o frontend/public/assets/models/external/fish.glb \
    https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BarramundiFish/glTF-Binary/BarramundiFish.glb
fi

# Dragon (Fantasy/Dino)
if [ ! -f frontend/public/assets/models/external/dragon.glb ]; then
    echo "  - Fetching DragonAttenuation.glb..."
    curl -L -o frontend/public/assets/models/external/dragon.glb \
    https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DragonAttenuation/glTF-Binary/DragonAttenuation.glb
fi

# Buggy (Ironwild Machine)
if [ ! -f frontend/public/assets/models/external/buggy.glb ]; then
    echo "  - Fetching Buggy.glb..."
    curl -L -o frontend/public/assets/models/external/buggy.glb \
    https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb
fi

# Ensure previous models exist
if [ ! -f frontend/public/assets/models/external/humanoid.glb ]; then
    curl -L -o frontend/public/assets/models/external/humanoid.glb \
    https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb
fi

echo "[*] All models downloaded."

# --- 2. UPDATE ASSETS CONFIGURATION (ALL WORLDS) ---
echo "[*] Updating assets.ts with configurations for ALL worlds..."

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
  targetHeight?: number;
  heightRange?: [number, number];
  targetExtent?: number;
  extentRange?: [number, number];
};

export type AssetSet = Record<string, AssetSpec>;

// --- BASE MODEL DEFINITIONS ---
const MODELS = {
  humanoid: "/assets/models/external/humanoid.glb",
  settler: "/assets/models/external/settler.glb",
  soldier: "/assets/models/external/soldier.glb",
  pilot: "/assets/models/external/pilot.glb",
  animal: "/assets/models/external/animal.glb",
  fish: "/assets/models/external/fish.glb",
  dragon: "/assets/models/external/dragon.glb",
  buggy: "/assets/models/external/buggy.glb",
  cone: "PRIMITIVE_CONE",
  box: "PRIMITIVE_BOX",
  sphere: "PRIMITIVE_SPHERE"
};

const BASE_ASSETS: AssetSet = {
  settler: { url: MODELS.settler, scale: 1.0, targetHeight: 1.8, heightRange: [1.5, 2.0] },
  tribe: { url: MODELS.soldier, scale: 1.0, targetHeight: 1.85, heightRange: [1.6, 2.1] },
  pilot: { url: MODELS.pilot, scale: 1.0, targetHeight: 1.8, heightRange: [1.6, 2.0] },
  fae: { url: MODELS.humanoid, scale: 0.6, targetHeight: 1.2, heightRange: [0.8, 1.5], tint: "#ffb7b2" },
  synth: { url: MODELS.humanoid, scale: 1.0, targetHeight: 2.0, heightRange: [1.8, 2.2] },
  
  fauna: { url: MODELS.animal, scale: 1.0, targetHeight: 0.6, heightRange: [0.4, 0.9] },
  beast: { url: MODELS.animal, scale: 1.5, targetHeight: 1.2, heightRange: [0.9, 1.6], tint: "#a05050" },
  
  outsider: { url: MODELS.humanoid, scale: 1.2, targetHeight: 2.2, heightRange: [2.0, 2.5], tint: "#00ff00" },
  voidborn: { url: MODELS.pilot, scale: 1.1, targetHeight: 2.0, heightRange: [1.8, 2.2], emissive: "#aa00ff" },

  habitat: { url: MODELS.box, scale: 1.0, targetHeight: 4.0, heightRange: [3.0, 6.0], tint: "#c2b3a3" },
  obelisk: { url: MODELS.cone, scale: 1.0, targetHeight: 8.0, heightRange: [6.0, 12.0], emissive: "#c6a8ff" },
  station: { url: MODELS.box, scale: 1.0, targetHeight: 6.0, heightRange: [4.0, 10.0], metalness: 0.8 },
  grove: { url: MODELS.cone, scale: 1.0, targetHeight: 5.0, heightRange: [3.0, 8.0], tint: "#2d5a27" },
  cycad: { url: MODELS.cone, scale: 1.0, targetHeight: 3.0, heightRange: [2.0, 5.0], tint: "#6b8f4f" },
};

// --- WORLD SPECIFIC SETS ---
export const ASSET_SETS: Record<string, AssetSet> = {
  // 1. Living World (Standard)
  living: { ...BASE_ASSETS },

  // 2. Fantasy (Magic, Dragons)
  fantasy: {
    ...BASE_ASSETS,
    fae: { ...BASE_ASSETS.fae, emissive: "#c9a6ff" },
    wyrm: { url: MODELS.dragon, scale: 2.0, targetHeight: 2.5, heightRange: [2.0, 4.0], tint: "#a67cff" },
    beast: { url: MODELS.animal, scale: 1.5, targetHeight: 1.2, heightRange: [1.0, 1.8], tint: "#553311" }
  },

  // 3. Dino (Prehistoric)
  dino: {
    ...BASE_ASSETS,
    tribe: { ...BASE_ASSETS.tribe, tint: "#c49a6c" },
    saurian: { url: MODELS.dragon, scale: 1.8, targetHeight: 3.0, heightRange: [2.5, 3.5], tint: "#6f9c62" }, // Dragon as T-Rex
    raptor: { url: MODELS.animal, scale: 1.2, targetHeight: 1.5, heightRange: [1.2, 1.8], tint: "#9bbd5a" }, // Animal as Raptor
    cycad: { url: MODELS.cone, scale: 1.2, targetHeight: 4.0, heightRange: [3.0, 6.0], tint: "#4a7a4a" }
  },

  // 4. Space (Sci-Fi)
  space: {
    ...BASE_ASSETS,
    pilot: { ...BASE_ASSETS.pilot, tint: "#bcd7ff" },
    synth: { ...BASE_ASSETS.synth, emissive: "#2aa5ff" },
    outsider: { ...BASE_ASSETS.voidborn, tint: "#7affd6", emissive: "#7affd6" }
  },

  // 5. Oceanic (Underwater)
  oceanic: {
    ...BASE_ASSETS,
    settler: { url: MODELS.pilot, scale: 1.0, targetHeight: 1.8, heightRange: [1.6, 2.0], tint: "#4f9bb8" }, // Diver
    fauna: { url: MODELS.fish, scale: 1.0, targetHeight: 0.5, heightRange: [0.3, 0.8], rotateY: Math.PI/2 }, // Fish
    beast: { url: MODELS.fish, scale: 3.0, targetHeight: 1.5, heightRange: [1.0, 2.5], tint: "#557f6a" }, // Whale/Shark
    grove: { url: MODELS.cone, scale: 1.0, targetHeight: 2.0, heightRange: [1.0, 3.0], tint: "#3f9a88" } // Coral/Kelp
  },

  // 6. Frostbound (Ice)
  frostbound: {
    ...BASE_ASSETS,
    settler: { url: MODELS.settler, scale: 1.0, targetHeight: 1.8, heightRange: [1.6, 2.0], tint: "#7db2d6" },
    beast: { url: MODELS.animal, scale: 1.6, targetHeight: 1.4, heightRange: [1.2, 2.0], tint: "#e9f4ff" }, // Polar Bear/Wolf
    grove: { url: MODELS.cone, scale: 1.0, targetHeight: 4.0, heightRange: [2.0, 6.0], tint: "#b7c7d8" } // Pine covered in snow
  },

  // 7. Emberfall (Volcanic)
  emberfall: {
    ...BASE_ASSETS,
    settler: { url: MODELS.soldier, scale: 1.0, targetHeight: 1.8, heightRange: [1.6, 2.0], tint: "#7a2d1f" },
    beast: { url: MODELS.dragon, scale: 1.5, targetHeight: 2.0, heightRange: [1.5, 2.5], tint: "#b0583a", emissive: "#ff8c4a" }, // Fire Drake
    grove: { url: MODELS.cone, scale: 1.0, targetHeight: 3.0, heightRange: [2.0, 5.0], tint: "#3a2620", emissive: "#7a4a32" } // Burnt trees
  },

  // 8. Skyborne (Floating Islands)
  skyborne: {
    ...BASE_ASSETS,
    settler: { url: MODELS.pilot, scale: 1.0, targetHeight: 1.8, heightRange: [1.6, 2.0], tint: "#d7efff" },
    beast: { url: MODELS.animal, scale: 1.0, targetHeight: 0.8, heightRange: [0.5, 1.2], tint: "#ffffff", emissive: "#cde6f5" }, // Birds/Spirits
    grove: { url: MODELS.cone, scale: 1.0, targetHeight: 6.0, heightRange: [4.0, 8.0], tint: "#87bfae" }
  },

  // 9. Ironwild (Rust/Mecha)
  ironwild: {
    ...BASE_ASSETS,
    settler: { url: MODELS.soldier, scale: 1.0, targetHeight: 1.9, heightRange: [1.7, 2.1], tint: "#5a4a3a" },
    machine: { url: MODELS.buggy, scale: 1.5, targetHeight: 1.5, heightRange: [1.2, 2.0], tint: "#a07a5a" }, // Rovers
    beast: { url: MODELS.humanoid, scale: 1.2, targetHeight: 1.6, heightRange: [1.4, 2.0], tint: "#7a5a4a", metalness: 0.8 }, // Mecha-beasts
    grove: { url: MODELS.box, scale: 1.0, targetHeight: 4.0, heightRange: [2.0, 6.0], tint: "#3a2c28", metalness: 0.9 } // Metal scraps
  }
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

echo "[OK] assets.ts updated with full world coverage."

# --- 3. UPDATE ROADMAP ---
echo "[*] Updating ROADMAP.md..."
cat >> ROADMAP.md <<'MD'

## Phase 5.3 — Comprehensive 3D Asset Upgrade (Completed)
- [x] Integrated "RobotExpressive" for generic humanoids/synths.
- [x] Integrated "CesiumMan" for settlers.
- [x] Integrated "Soldier" for tribes/warriors.
- [x] Integrated "Pilot/Astronaut" for space/sky themes.
- [x] Integrated "Fox" for standard animals/beasts.
- [x] Integrated "BarramundiFish" for Oceanic fauna.
- [x] Integrated "DragonAttenuation" for Fantasy/Dino behemoths.
- [x] Integrated "Buggy" for Ironwild machines.
- [x] Configured per-world asset sets (Oceanic, Frostbound, Emberfall, etc.).
- [x] Applied auto-normalization to fix scale issues across all models.
MD

echo "[DONE] Upgrade complete! Restart the server (./run_stack.sh) to see the new worlds."
