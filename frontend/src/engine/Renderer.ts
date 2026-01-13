import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ASSET_SETS, AssetSpec, AssetStyle } from "./assets";
import spriteUrl from "../assets/sprites.png";

export type Entity = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  energy?: number;
  wealth?: number;
  hardness?: number;
  kind?: string;
};

// --- ULTRA-DETAILED VOXEL SCHEMATICS ---
// Highly detailed micro-voxel models for living creatures
type VoxelDef = { x: number; y: number; z: number; colorOff: number };

const VOXEL_MODELS: Record<string, VoxelDef[]> = {
  // SETTLER: Detailed Humanoid - 28 voxels
  settler: [
    // Feet
    { x: -0.15, y: 0, z: 0, colorOff: -0.2 },
    { x: 0.15, y: 0, z: 0, colorOff: -0.2 },
    // Legs (calves + thighs)
    { x: -0.12, y: 0, z: 0.12, colorOff: -0.1 },
    { x: 0.12, y: 0, z: 0.12, colorOff: -0.1 },
    { x: -0.1, y: 0, z: 0.25, colorOff: 0 },
    { x: 0.1, y: 0, z: 0.25, colorOff: 0 },
    // Pelvis + Torso
    { x: 0, y: 0, z: 0.35, colorOff: 0.05 },
    { x: 0, y: 0, z: 0.45, colorOff: 0.1 },
    { x: -0.12, y: 0, z: 0.45, colorOff: 0.08 },
    { x: 0.12, y: 0, z: 0.45, colorOff: 0.08 },
    { x: 0, y: 0, z: 0.55, colorOff: 0.12 },
    { x: -0.15, y: 0, z: 0.55, colorOff: 0.1 },
    { x: 0.15, y: 0, z: 0.55, colorOff: 0.1 },
    // Shoulders + Arms
    { x: -0.22, y: 0, z: 0.6, colorOff: 0.15 },
    { x: 0.22, y: 0, z: 0.6, colorOff: 0.15 },
    { x: -0.32, y: 0, z: 0.52, colorOff: 0.2 },
    { x: 0.32, y: 0, z: 0.52, colorOff: 0.2 },
    { x: -0.38, y: 0, z: 0.4, colorOff: 0.25 },
    { x: 0.38, y: 0, z: 0.4, colorOff: 0.25 },
    // Neck + Head
    { x: 0, y: 0, z: 0.68, colorOff: 0.22 },
    { x: 0, y: 0, z: 0.8, colorOff: 0.25 },
    { x: -0.08, y: 0, z: 0.8, colorOff: 0.23 },
    { x: 0.08, y: 0, z: 0.8, colorOff: 0.23 },
    { x: 0, y: -0.08, z: 0.8, colorOff: 0.23 },
    { x: 0, y: 0.08, z: 0.8, colorOff: 0.23 },
    // Hair
    { x: 0, y: 0, z: 0.92, colorOff: -0.3 },
    { x: -0.1, y: 0, z: 0.9, colorOff: -0.28 },
    { x: 0.1, y: 0, z: 0.9, colorOff: -0.28 },
  ],

  // FAUNA: Quadruped Animal - 26 voxels
  fauna: [
    // Hooves
    { x: -0.25, y: -0.25, z: 0, colorOff: -0.2 },
    { x: 0.25, y: -0.25, z: 0, colorOff: -0.2 },
    { x: -0.25, y: 0.25, z: 0, colorOff: -0.2 },
    { x: 0.25, y: 0.25, z: 0, colorOff: -0.2 },
    // Lower Legs
    { x: -0.22, y: -0.22, z: 0.1, colorOff: -0.1 },
    { x: 0.22, y: -0.22, z: 0.1, colorOff: -0.1 },
    { x: -0.22, y: 0.22, z: 0.1, colorOff: -0.1 },
    { x: 0.22, y: 0.22, z: 0.1, colorOff: -0.1 },
    // Upper Legs
    { x: -0.18, y: -0.18, z: 0.2, colorOff: 0 },
    { x: 0.18, y: -0.18, z: 0.2, colorOff: 0 },
    { x: -0.18, y: 0.18, z: 0.2, colorOff: 0 },
    { x: 0.18, y: 0.18, z: 0.2, colorOff: 0 },
    // Body
    { x: 0, y: -0.2, z: 0.3, colorOff: 0.05 },
    { x: 0, y: -0.3, z: 0.35, colorOff: 0.05 },
    { x: 0, y: 0, z: 0.35, colorOff: 0.1 },
    { x: 0.1, y: 0, z: 0.38, colorOff: 0.08 },
    { x: -0.1, y: 0, z: 0.38, colorOff: 0.08 },
    { x: 0, y: 0.2, z: 0.35, colorOff: 0.1 },
    { x: 0, y: 0.35, z: 0.4, colorOff: 0.12 },
    // Neck + Head
    { x: 0, y: 0.45, z: 0.5, colorOff: 0.15 },
    { x: 0, y: 0.55, z: 0.55, colorOff: 0.18 },
    { x: 0, y: 0.62, z: 0.52, colorOff: 0.2 },
    // Ears
    { x: -0.08, y: 0.58, z: 0.62, colorOff: 0.15 },
    { x: 0.08, y: 0.58, z: 0.62, colorOff: 0.15 },
    // Tail
    { x: 0, y: -0.4, z: 0.35, colorOff: -0.1 },
    { x: 0, y: -0.5, z: 0.3, colorOff: -0.15 },
  ],

  // GROVE: Lush Tree - 33 voxels
  grove: [
    // Roots
    { x: 0.15, y: 0.15, z: 0, colorOff: -0.5 },
    { x: -0.15, y: -0.15, z: 0, colorOff: -0.5 },
    { x: 0.15, y: -0.15, z: 0, colorOff: -0.5 },
    { x: -0.15, y: 0.15, z: 0, colorOff: -0.5 },
    // Trunk
    { x: 0, y: 0, z: 0.1, colorOff: -0.45 },
    { x: 0, y: 0, z: 0.25, colorOff: -0.4 },
    { x: 0, y: 0, z: 0.4, colorOff: -0.4 },
    { x: 0, y: 0, z: 0.55, colorOff: -0.35 },
    { x: 0.15, y: 0, z: 0.5, colorOff: -0.38 },
    { x: -0.15, y: 0, z: 0.55, colorOff: -0.38 },
    // Leaves Layer 1 (Wide)
    { x: 0.4, y: 0, z: 0.65, colorOff: 0.05 },
    { x: -0.4, y: 0, z: 0.65, colorOff: 0.05 },
    { x: 0, y: 0.4, z: 0.65, colorOff: 0.05 },
    { x: 0, y: -0.4, z: 0.65, colorOff: 0.05 },
    { x: 0.3, y: 0.3, z: 0.65, colorOff: 0.08 },
    { x: -0.3, y: 0.3, z: 0.65, colorOff: 0.08 },
    { x: 0.3, y: -0.3, z: 0.65, colorOff: 0.08 },
    { x: -0.3, y: -0.3, z: 0.65, colorOff: 0.08 },
    // Leaves Layer 2 (Mid)
    { x: 0.35, y: 0, z: 0.8, colorOff: 0.12 },
    { x: -0.35, y: 0, z: 0.8, colorOff: 0.12 },
    { x: 0, y: 0.35, z: 0.8, colorOff: 0.12 },
    { x: 0, y: -0.35, z: 0.8, colorOff: 0.12 },
    { x: 0.25, y: 0.25, z: 0.82, colorOff: 0.15 },
    { x: -0.25, y: 0.25, z: 0.82, colorOff: 0.15 },
    { x: 0.25, y: -0.25, z: 0.82, colorOff: 0.15 },
    { x: -0.25, y: -0.25, z: 0.82, colorOff: 0.15 },
    // Leaves Layer 3 (Upper)
    { x: 0.25, y: 0, z: 0.95, colorOff: 0.2 },
    { x: -0.25, y: 0, z: 0.95, colorOff: 0.2 },
    { x: 0, y: 0.25, z: 0.95, colorOff: 0.2 },
    { x: 0, y: -0.25, z: 0.95, colorOff: 0.2 },
    // Top crown
    { x: 0, y: 0, z: 1.08, colorOff: 0.25 },
    { x: 0.1, y: 0, z: 1.05, colorOff: 0.23 },
    { x: -0.1, y: 0, z: 1.05, colorOff: 0.23 },
  ],

  // HABITAT: House - 38 voxels
  habitat: [
    // Foundation
    { x: -0.35, y: -0.35, z: 0, colorOff: -0.2 },
    { x: 0.35, y: -0.35, z: 0, colorOff: -0.2 },
    { x: -0.35, y: 0.35, z: 0, colorOff: -0.2 },
    { x: 0.35, y: 0.35, z: 0, colorOff: -0.2 },
    { x: 0, y: -0.35, z: 0, colorOff: -0.2 },
    { x: 0, y: 0.35, z: 0, colorOff: -0.2 },
    { x: -0.35, y: 0, z: 0, colorOff: -0.2 },
    { x: 0.35, y: 0, z: 0, colorOff: -0.2 },
    { x: 0, y: 0, z: 0, colorOff: -0.2 },
    // Walls (corners)
    { x: -0.35, y: -0.35, z: 0.15, colorOff: 0 },
    { x: 0.35, y: -0.35, z: 0.15, colorOff: 0 },
    { x: -0.35, y: 0.35, z: 0.15, colorOff: 0 },
    { x: 0.35, y: 0.35, z: 0.15, colorOff: 0 },
    { x: -0.35, y: -0.35, z: 0.3, colorOff: 0.02 },
    { x: 0.35, y: -0.35, z: 0.3, colorOff: 0.02 },
    { x: -0.35, y: 0.35, z: 0.3, colorOff: 0.02 },
    { x: 0.35, y: 0.35, z: 0.3, colorOff: 0.02 },
    { x: -0.35, y: -0.35, z: 0.45, colorOff: 0.05 },
    { x: 0.35, y: -0.35, z: 0.45, colorOff: 0.05 },
    { x: -0.35, y: 0.35, z: 0.45, colorOff: 0.05 },
    { x: 0.35, y: 0.35, z: 0.45, colorOff: 0.05 },
    // Windows + Door
    { x: 0, y: -0.35, z: 0.3, colorOff: -0.15 },
    { x: 0, y: 0.35, z: 0.3, colorOff: -0.15 },
    { x: -0.35, y: 0, z: 0.15, colorOff: -0.25 },
    { x: -0.35, y: 0, z: 0.3, colorOff: -0.25 },
    // Roof
    { x: -0.4, y: -0.4, z: 0.55, colorOff: 0.15 },
    { x: 0.4, y: -0.4, z: 0.55, colorOff: 0.15 },
    { x: -0.4, y: 0.4, z: 0.55, colorOff: 0.15 },
    { x: 0.4, y: 0.4, z: 0.55, colorOff: 0.15 },
    { x: 0, y: -0.4, z: 0.55, colorOff: 0.15 },
    { x: 0, y: 0.4, z: 0.55, colorOff: 0.15 },
    { x: -0.4, y: 0, z: 0.55, colorOff: 0.15 },
    { x: 0.4, y: 0, z: 0.55, colorOff: 0.15 },
    { x: -0.25, y: -0.25, z: 0.68, colorOff: 0.2 },
    { x: 0.25, y: -0.25, z: 0.68, colorOff: 0.2 },
    { x: -0.25, y: 0.25, z: 0.68, colorOff: 0.2 },
    { x: 0.25, y: 0.25, z: 0.68, colorOff: 0.2 },
    { x: 0, y: 0, z: 0.8, colorOff: 0.25 },
  ],

  // DEFAULT
  default: [
    { x: 0, y: 0, z: 0, colorOff: 0 },
    { x: 0, y: 0, z: 0.2, colorOff: 0.1 },
  ],

  // HUMANOID: Same as settler
  humanoid: [
    { x: -0.15, y: 0, z: 0, colorOff: -0.2 },
    { x: 0.15, y: 0, z: 0, colorOff: -0.2 },
    { x: -0.12, y: 0, z: 0.12, colorOff: -0.1 },
    { x: 0.12, y: 0, z: 0.12, colorOff: -0.1 },
    { x: -0.1, y: 0, z: 0.25, colorOff: 0 },
    { x: 0.1, y: 0, z: 0.25, colorOff: 0 },
    { x: 0, y: 0, z: 0.35, colorOff: 0.05 },
    { x: 0, y: 0, z: 0.45, colorOff: 0.1 },
    { x: -0.12, y: 0, z: 0.45, colorOff: 0.08 },
    { x: 0.12, y: 0, z: 0.45, colorOff: 0.08 },
    { x: 0, y: 0, z: 0.55, colorOff: 0.12 },
    { x: -0.15, y: 0, z: 0.55, colorOff: 0.1 },
    { x: 0.15, y: 0, z: 0.55, colorOff: 0.1 },
    { x: -0.22, y: 0, z: 0.6, colorOff: 0.15 },
    { x: 0.22, y: 0, z: 0.6, colorOff: 0.15 },
    { x: -0.32, y: 0, z: 0.52, colorOff: 0.2 },
    { x: 0.32, y: 0, z: 0.52, colorOff: 0.2 },
    { x: -0.38, y: 0, z: 0.4, colorOff: 0.25 },
    { x: 0.38, y: 0, z: 0.4, colorOff: 0.25 },
    { x: 0, y: 0, z: 0.68, colorOff: 0.22 },
    { x: 0, y: 0, z: 0.8, colorOff: 0.25 },
    { x: -0.08, y: 0, z: 0.8, colorOff: 0.23 },
    { x: 0.08, y: 0, z: 0.8, colorOff: 0.23 },
    { x: 0, y: 0, z: 0.92, colorOff: -0.3 },
    { x: -0.1, y: 0, z: 0.9, colorOff: -0.28 },
    { x: 0.1, y: 0, z: 0.9, colorOff: -0.28 },
  ],
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

type RenderMode = "2d" | "3d" | "isometric";

const ISO_ANGLE_X = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
const TILE_SIZE = 12; // Visual size unit per world unit

// VIBRANT pixel-art color palette matching reference images
const COLOR_MAP: Record<string, number> = {
  // Basic colors - saturated
  red: 0xff4466,
  blue: 0x5588ff,
  green: 0x55dd77,
  metal: 0xc8d0e0,
  gray: 0x8899aa,
  gold: 0xffcc33,
  // Entity base colors
  human: 0xffbb99,    // Warm peach skin
  animal: 0x66cc55,   // Bright green
  alien: 0x88ffdd,    // Cyan/teal
  building: 0xaa8899, // Dusty purple
  tree: 0x44aa44,     // Forest green
  dino: 0x55cc88,     // Teal green
  // Entity kinds - VIBRANT matching reference images
  settler: 0xffbb99,   // Warm peach (humanoid skin)
  fauna: 0x66dd55,     // Bright lime green
  grove: 0x338833,     // Deep forest green
  habitat: 0xddaa55,   // Warm wood/brown
  outsider: 0xcc2244,  // Vivid crimson
  humanoid: 0xffcc99,  // Slightly warmer peach
  creature: 0xaacc66,  // Yellow-green
  machine: 0x99aacc,   // Steel blue
  // Special entity types
  tree: 0x33aa55,      // Lush green
  grass: 0x55cc44,     // Bright grass
  water: 0x4488ee,     // Ocean blue
  sand: 0xeecc66,      // Beach sand
  stone: 0x778899,     // Blue-grey stone
  snow: 0xeeeeff,      // Ice white
};

const getColor = (str: string) => {
  const k = (str || "").trim().toLowerCase();
  return COLOR_MAP[k] ?? 0xffffff;
};

// --- PROCEDURAL ATLAS GENERATOR ---
// Generates a 4x4 atlas (16 textures) of 16x16 pixels each
// 0: Grass, 1: Dirt, 2: Stone, 3: Water, 4: Wood, 5: Leaves, 6: Sand, 7: Snow
// 8-15: Entity Placeholders
const GENERATE_ATLAS = (): THREE.DataTexture => {
  const size = 64; // 4 * 16
  const tile = 16;
  const data = new Uint8Array(size * size * 4);

  const setPixel = (
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number = 255,
  ) => {
    const idx = (y * size + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  };

  // Draw Tile
  const drawTile = (
    idx: number,
    baseColor: [number, number, number],
    variance: number,
    style: "noise" | "bricks" | "waves" = "noise",
  ) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const startX = col * tile;
    const startY = row * tile; // Top-down

    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        let mod = 0;
        if (style === "noise") {
          mod = (Math.random() - 0.5) * variance;
        } else if (style === "bricks") {
          const bx = x % 8;
          const by = y % 4;
          if (bx === 0 || by === 0)
            mod = -40; // mortar
          else mod = (Math.random() - 0.5) * 10;
        } else if (style === "waves") {
          if ((x + y) % 4 === 0)
            mod = 30; // highlight
          else mod = -10;
        }

        const r = Math.min(255, Math.max(0, baseColor[0] + mod));
        const g = Math.min(255, Math.max(0, baseColor[1] + mod));
        const b = Math.min(255, Math.max(0, baseColor[2] + mod));
        setPixel(startX + x, startY + y, r, g, b, 255);
      }
    }
  };

  // 0: Grass (Green with noise)
  drawTile(0, [80, 160, 60], 30, "noise");
  // 1: Dirt (Brown)
  drawTile(1, [120, 90, 60], 40, "noise");
  // 2: Stone (Grey Bricks)
  drawTile(2, [140, 140, 150], 30, "bricks");
  // 3: Water (Blue Waves)
  drawTile(3, [60, 120, 220], 30, "waves");
  // 4: Wood (Dark Brown)
  drawTile(4, [90, 60, 30], 20, "noise");
  // 5: Leaves (Dark Green)
  drawTile(5, [40, 100, 40], 40, "noise");
  // 6: Sand (Beige)
  drawTile(6, [220, 210, 150], 20, "noise");
  // 7: Snow (White)
  drawTile(7, [230, 230, 245], 10, "noise");
  // 8: Humanoid (Peach)
  drawTile(8, [255, 200, 180], 0, "noise");
  // 9: Empty/Other
  drawTile(9, [100, 100, 100], 50, "noise");
  drawTile(10, [200, 100, 100], 50, "noise");
  drawTile(11, [100, 200, 100], 50, "noise");
  drawTile(12, [100, 100, 200], 50, "noise");

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
};

// Shader for Pixel-Perfect Terrain Instancing
// Supports index-based texture lookup from an atlas
const TERRAIN_VERT = `
  precision highp float;
  attribute float tileIndex;
  varying vec2 vUv;
  varying float vIndex;
  
  void main() {
    vUv = uv;
    vIndex = tileIndex;
    vec3 pos = position;
    vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * instancePos;
  }
`;

const TERRAIN_FRAG = `
  precision highp float;
  uniform sampler2D map;
  // Atlas is 4x4 explicitly
  varying vec2 vUv;
  varying float vIndex;

  void main() {
    float validIndex = abs(vIndex); 
    float cols = 4.0;
    float row = floor(validIndex / cols);
    float col = mod(validIndex, cols);
    
    // Invert Y? row 0 is Top visually in my code, but texture memory...?
    // Using standard mapping for now.
    // If textures look upside down, we invert y inside the tile.
    
    float y = (cols - 1.0) - row; 
    
    vec2 scale = vec2(1.0 / cols);
    vec2 offset = vec2(col, y) * scale;
    vec2 finalUv = vUv * scale + offset;
    
    vec4 texColor = texture2D(map, finalUv);
    if (texColor.a < 0.5) discard;
    
    gl_FragColor = texColor;
  }
`;

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private debugCamera: THREE.PerspectiveCamera;
  private activeCamera: THREE.Camera;
  private mode: RenderMode = "isometric";

  // Simulation State
  private entities: Entity[] = [];
  private w = 1;
  private h = 1;
  private fieldData?: FieldPayload;
  private needsRebuild = true;

  // Assets
  private atlas: THREE.Texture | null = null;
  private assetStyle: AssetStyle = "assets";

  // Scene Graph
  private isoGroup = new THREE.Group();
  private terrainMesh: THREE.InstancedMesh | null = null;
  private entityMesh: THREE.InstancedMesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private orbit = { zoom: 1.0, panX: 0, panY: 0 };
  private pointer = { down: false, x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Crisp pixels
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; // Enable Shadows for depth!

    this.scene = new THREE.Scene();
    // Use a deep rich blue/purple instead of near-black to match "Game" aesthetic
    this.scene.background = new THREE.Color(0x2a2a35);

    // --- LIGHTING (CRITICAL FOR VISIBILITY) ---
    // Vibrant, high-key lighting for "Toy/Diorama" look
    // NUCLEAR OPACITY BOOST: Overpowering any material darkness
    const ambient = new THREE.AmbientLight(0xffffff, 3.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 5.0);
    sun.position.set(50, 150, 50); // Higher angle for better spread
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;

    const d = 50;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;

    // Soft shadows
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // ISO CAMERA SETUP
    // Zoomed IN for Small Chunk Diorama feel
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
    this.orbit.zoom = 5.0; // Start zoomed in
    this.setupIsoCamera();

    this.debugCamera = new THREE.PerspectiveCamera(60, 1, 1, 1000);
    this.debugCamera.position.set(100, 100, 100);
    this.debugCamera.lookAt(0, 0, 0);

    this.activeCamera = this.camera;
    this.scene.add(this.isoGroup);

    // DEBUG: Grid and Axes
    // const grid = new THREE.GridHelper(200, 50, 0x444444, 0x222222);
    // this.isoGroup.add(grid);
    // const axes = new THREE.AxesHelper(20);
    // this.isoGroup.add(axes);

    // Generate Procedural Atlas
    this.atlas = GENERATE_ATLAS();
    this.needsRebuild = true;

    this.bindControls(canvas);
  }

  private setupIsoCamera() {
    const dist = 200;
    this.camera.position.set(dist, dist, dist);
    this.camera.lookAt(0, 0, 0);
  }

  private bindControls(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (e) => {
      this.pointer.down = true;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });
    window.addEventListener("pointerup", () => {
      this.pointer.down = false;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.pointer.down) {
        const dx = e.clientX - this.pointer.x;
        const dy = e.clientY - this.pointer.y;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;

        const scale = 2.0 / this.orbit.zoom;
        this.orbit.panX -= dx * scale;
        this.orbit.panY += dy * scale;
      }
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY) * 0.1;
        this.orbit.zoom = Math.max(0.1, Math.min(10, this.orbit.zoom + delta));
      },
      { passive: false },
    );
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewSize = 100;
    const zoomSize = viewSize / this.orbit.zoom;

    this.camera.left = -zoomSize * aspect;
    this.camera.right = zoomSize * aspect;
    this.camera.top = zoomSize;
    this.camera.bottom = -zoomSize;
    this.camera.updateProjectionMatrix();

    if (this.debugCamera) {
      this.debugCamera.aspect = aspect;
      this.debugCamera.updateProjectionMatrix();
    }
  }

  setMode(mode: RenderMode) {
    this.mode = mode;
    this.activeCamera = mode === "3d" ? this.debugCamera : this.camera;
  }

  setEntities(entities: Entity[]) {
    this.entities = entities;
  }

  setFields(f: FieldPayload) {
    console.log("Renderer: Received Field Data", f);
    this.fieldData = f;
    this.needsRebuild = true;
    this.rebuildTerrain(); // Force immediate rebuild
  }

  setTheme(t: string) { }
  setAssetStyle(s: AssetStyle) {
    this.assetStyle = s;
  }
  preloadAssets() {
    return Promise.resolve();
  }
  pick(x: number, y: number, rect: DOMRect) {
    return null;
  }

  private rebuildTerrain() {
    if (this.terrainMesh) {
      this.isoGroup.remove(this.terrainMesh);
      // Dispose geometry and material separately (Mesh has no direct dispose)
      this.terrainMesh.geometry?.dispose();
      (this.terrainMesh.material as THREE.Material)?.dispose();
      this.terrainMesh = null;
    }

    if (!this.fieldData) return;

    const { grid_w, grid_h, terrain } = this.fieldData;

    // Create arrays to hold all vertices, colors, and indices
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    const centerX = grid_w * 0.5;
    const centerZ = grid_h * 0.5;

    // Box template vertices (cube)
    const boxVerts = [
      // Front
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
      // Back
      [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5],
      // Top
      [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5],
      // Bottom
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
      // Right
      [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5],
      // Left
      [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
    ];
    const boxIndices = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
    ];

    // Debug: Check terrain value distribution
    let minVal = Infinity, maxVal = -Infinity;
    for (let y = 0; y < grid_h; y++) {
      for (let x = 0; x < grid_w; x++) {
        const v = terrain[y][x];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    console.log(`Terrain values: min=${minVal.toFixed(3)}, max=${maxVal.toFixed(3)}`);

    // Normalize terrain values to 0-1 range
    const range = maxVal - minVal || 1;

    for (let y = 0; y < grid_h; y++) {
      for (let x = 0; x < grid_w; x++) {
        const rawVal = terrain[y][x];
        // Normalize to 0-1 range
        const val = (rawVal - minVal) / range;
        const height = Math.floor(val * 8);

        // Position and scale
        const px = (x - centerX) * 1.0;
        const topY = height * 0.5;
        const bottomY = -4.0;
        const thickness = Math.max(0.5, topY - bottomY);
        const py = bottomY + thickness / 2.0;
        const pz = (y - centerZ) * 1.0;
        const scaleY = thickness;

        // Determine color based on terrain value and height
        // Using VIBRANT pixel-art colors matching reference images
        let r: number, g: number, b: number;
        if (val < 0.2) {
          // Deep Water - rich cobalt blue
          r = 0.15; g = 0.35; b = 0.85;
        } else if (val < 0.35) {
          // Shallow Water / Teal - cyan turquoise
          r = 0.2; g = 0.65; b = 0.85;
        } else if (val < 0.42) {
          // Sand/Beach - warm golden yellow
          r = 0.95; g = 0.82; b = 0.45;
        } else if (height > 6) {
          // Snow peaks - pure white with slight blue tint
          r = 0.98; g = 0.98; b = 1.0;
        } else if (height > 4) {
          // Stone/Mountain - purple-grey like reference images
          r = 0.55; g = 0.45; b = 0.6;
        } else {
          // Grass - VIBRANT saturated green with subtle variation
          const grassVar = (Math.sin(x * 1.2) * 0.08) + (Math.cos(y * 1.2) * 0.08);
          const grassShade = Math.random() * 0.1; // Subtle random variation
          r = 0.25 + grassVar;
          g = 0.75 + grassVar + grassShade;
          b = 0.3 + grassVar;
        }

        // Add vertices for this box
        for (const [vx, vy, vz] of boxVerts) {
          positions.push(px + vx, py + vy * scaleY, pz + vz);
          colors.push(r, g, b);
        }

        // Add indices (offset by current vertex count)
        for (const i of boxIndices) {
          indices.push(vertexOffset + i);
        }
        vertexOffset += 24; // 24 vertices per box
      }
    }

    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Use MeshLambertMaterial with vertexColors enabled
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true, // USE vertex colors from geometry
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.terrainMesh = mesh as any;
    this.isoGroup.add(mesh);
    this.needsRebuild = false;

    console.log("Renderer: Terrain rebuilt with", grid_w * grid_h, "blocks using MERGED GEOMETRY with vertex colors");
  }

  render(worldW: number, worldH: number) {
    if (this.needsRebuild && this.fieldData) {
      this.rebuildTerrain();
    }

    const panX = this.orbit.panX;
    const panY = this.orbit.panY;

    this.camera.position.set(200 + panX, 200, 200 + panY);
    this.camera.lookAt(panX, 0, panY);

    // --- ENTITY RENDERER using Merged Geometry ---
    if (this.entityMesh) {
      this.isoGroup.remove(this.entityMesh);
      this.entityMesh.geometry?.dispose();
      (this.entityMesh.material as THREE.Material)?.dispose();
      this.entityMesh = null;
    }

    if (this.entities.length > 0) {
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      let vertexOffset = 0;

      const boxVerts = [
        [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
        [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5],
        [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5],
        [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
        [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5],
        [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
      ];
      const boxIndices = [
        0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
      ];

      const time = Date.now() * 0.005;

      this.entities.forEach((e, entityIdx) => {
        let modelKey = "default";
        const kindLower = (e.kind || "").toLowerCase();
        const colorLower = (e.color || "").toLowerCase();

        if (VOXEL_MODELS[kindLower]) modelKey = kindLower;
        else if (VOXEL_MODELS[colorLower]) modelKey = colorLower;
        if (colorLower === "human" || colorLower === "red") modelKey = "settler";
        if (colorLower === "animal" || colorLower === "green") modelKey = "fauna";
        if (colorLower === "tree" || colorLower === "dino") modelKey = "grove";
        if (colorLower === "building" || colorLower === "gray") modelKey = "habitat";

        const schematic = VOXEL_MODELS[modelKey] || VOXEL_MODELS["default"];
        const baseColorHex = getColor(kindLower) !== 0xffffff ? getColor(kindLower) : getColor(colorLower);
        const baseColor = new THREE.Color(baseColorHex);

        // Use field dimensions (grid_w, grid_h) for entity centering, not frame dimensions
        // This ensures entities align with the terrain
        const gridW = this.fieldData?.grid_w ?? worldW;
        const gridH = this.fieldData?.grid_h ?? worldH;
        const rx = (e.x - (gridW / 2)) * 1.0;
        const rz = (e.y - (gridH / 2)) * 1.0;
        const bob = Math.sin(time + e.id) * 0.1;
        const ryBase = (e.z * 1.5) + 0.5 + bob;

        for (const v of schematic) {
          const scale = 0.5;
          const px = rx + (v.x * scale);
          const py = ryBase + (v.z * scale);
          const pz = rz + (v.y * scale);

          const voxelColor = baseColor.clone();
          voxelColor.offsetHSL(0, 0, v.colorOff);

          for (const [vx, vy, vz] of boxVerts) {
            positions.push(px + vx * scale, py + vy * scale, pz + vz * scale);
            colors.push(voxelColor.r, voxelColor.g, voxelColor.b);
          }

          for (const i of boxIndices) {
            indices.push(vertexOffset + i);
          }
          vertexOffset += 24;
        }
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const material = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.entityMesh = mesh as any;
      this.isoGroup.add(mesh);
    }

    this.renderer.render(this.scene, this.activeCamera);
  }
}

