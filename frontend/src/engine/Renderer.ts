import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_SETS, AssetSpec, AssetStyle, ASSET_KIND_FALLBACK } from "./assets";
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

type CachedAsset = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
};

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

  // ALIEN: Tall, big-headed silhouette - 30 voxels
  alien: [
    // Feet + legs
    { x: -0.12, y: 0, z: 0, colorOff: -0.15 },
    { x: 0.12, y: 0, z: 0, colorOff: -0.15 },
    { x: -0.1, y: 0, z: 0.14, colorOff: -0.08 },
    { x: 0.1, y: 0, z: 0.14, colorOff: -0.08 },
    { x: 0, y: 0, z: 0.28, colorOff: 0.0 },
    // Torso
    { x: 0, y: 0, z: 0.42, colorOff: 0.08 },
    { x: -0.12, y: 0, z: 0.44, colorOff: 0.05 },
    { x: 0.12, y: 0, z: 0.44, colorOff: 0.05 },
    { x: 0, y: 0, z: 0.56, colorOff: 0.1 },
    // Arms
    { x: -0.28, y: 0, z: 0.5, colorOff: 0.12 },
    { x: 0.28, y: 0, z: 0.5, colorOff: 0.12 },
    { x: -0.36, y: 0, z: 0.38, colorOff: 0.18 },
    { x: 0.36, y: 0, z: 0.38, colorOff: 0.18 },
    // Head (large)
    { x: 0, y: 0, z: 0.7, colorOff: 0.2 },
    { x: -0.14, y: 0, z: 0.7, colorOff: 0.2 },
    { x: 0.14, y: 0, z: 0.7, colorOff: 0.2 },
    { x: 0, y: -0.12, z: 0.7, colorOff: 0.2 },
    { x: 0, y: 0.12, z: 0.7, colorOff: 0.2 },
    { x: 0, y: 0, z: 0.82, colorOff: 0.25 },
    // Antennae
    { x: -0.08, y: 0, z: 0.94, colorOff: 0.3 },
    { x: 0.08, y: 0, z: 0.94, colorOff: 0.3 },
  ],

  // MACHINE: Stocky rover/mech - 28 voxels
  machine: [
    // Treads
    { x: -0.3, y: -0.2, z: 0.0, colorOff: -0.2 },
    { x: -0.3, y: 0.2, z: 0.0, colorOff: -0.2 },
    { x: 0.3, y: -0.2, z: 0.0, colorOff: -0.2 },
    { x: 0.3, y: 0.2, z: 0.0, colorOff: -0.2 },
    // Chassis
    { x: 0, y: 0, z: 0.15, colorOff: -0.05 },
    { x: -0.2, y: 0, z: 0.2, colorOff: -0.02 },
    { x: 0.2, y: 0, z: 0.2, colorOff: -0.02 },
    { x: 0, y: -0.2, z: 0.2, colorOff: -0.02 },
    { x: 0, y: 0.2, z: 0.2, colorOff: -0.02 },
    { x: 0, y: 0, z: 0.32, colorOff: 0.05 },
    // Core + head
    { x: 0, y: 0, z: 0.45, colorOff: 0.08 },
    { x: 0, y: 0, z: 0.6, colorOff: 0.12 },
    { x: -0.12, y: 0, z: 0.6, colorOff: 0.1 },
    { x: 0.12, y: 0, z: 0.6, colorOff: 0.1 },
    // Antenna / sensor
    { x: 0, y: 0, z: 0.78, colorOff: 0.18 },
    { x: 0.08, y: 0, z: 0.75, colorOff: 0.15 },
  ],

  // DINO: Heavy-bodied saurian - 34 voxels
  dino: [
    // Hind legs
    { x: -0.2, y: -0.12, z: 0, colorOff: -0.2 },
    { x: 0.2, y: -0.12, z: 0, colorOff: -0.2 },
    { x: -0.18, y: -0.1, z: 0.16, colorOff: -0.1 },
    { x: 0.18, y: -0.1, z: 0.16, colorOff: -0.1 },
    // Body
    { x: 0, y: -0.05, z: 0.3, colorOff: 0.05 },
    { x: 0, y: -0.08, z: 0.42, colorOff: 0.08 },
    { x: 0, y: -0.12, z: 0.52, colorOff: 0.1 },
    { x: 0.12, y: -0.08, z: 0.45, colorOff: 0.08 },
    { x: -0.12, y: -0.08, z: 0.45, colorOff: 0.08 },
    // Neck + head
    { x: 0, y: 0.12, z: 0.55, colorOff: 0.12 },
    { x: 0, y: 0.26, z: 0.6, colorOff: 0.15 },
    { x: 0, y: 0.36, z: 0.62, colorOff: 0.18 },
    // Tail
    { x: 0, y: -0.32, z: 0.4, colorOff: -0.05 },
    { x: 0, y: -0.44, z: 0.35, colorOff: -0.1 },
    { x: 0, y: -0.56, z: 0.3, colorOff: -0.12 },
    // Forelegs
    { x: -0.18, y: 0.2, z: 0.15, colorOff: -0.1 },
    { x: 0.18, y: 0.2, z: 0.15, colorOff: -0.1 },
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

const VOXEL_SCALES: Record<string, number> = {
  settler: 1.0,
  humanoid: 1.0,
  fauna: 1.0,
  grove: 1.4,
  habitat: 1.6,
  dino: 1.4,
  alien: 1.2,
  machine: 1.1,
  default: 1.1,
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
  // Special entity types (terrain)
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
  private terrainStats: { min: number; max: number; range: number } | null = null;
  private voxelHeights: number[][] | null = null;

  // Assets
  private atlas: THREE.Texture | null = null;
  private assetStyle: AssetStyle = "assets";
  private assetTheme = "living";
  private assetLoader = new GLTFLoader();
  private assetCache = new Map<string, CachedAsset>();
  private assetGroup = new THREE.Group();
  private assetInstances = new Map<number, THREE.Object3D>();
  private assetMixers = new Map<number, THREE.AnimationMixer>();
  private assetClock = new THREE.Clock();
  private maxAssetEntities = 140;
  private spriteTexture: THREE.Texture | null = null;
  private spriteMaterials = new Map<string, THREE.SpriteMaterial>();
  private spriteGroup = new THREE.Group();
  private spriteInstances = new Map<number, THREE.Sprite>();

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
    this.scene.add(this.assetGroup);
    this.scene.add(this.spriteGroup);

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
    const terrain = f.terrain || [];
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const row of terrain) {
      for (const v of row) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const range = maxVal - minVal || 1;
    this.terrainStats = { min: minVal, max: maxVal, range };
    this.voxelHeights = this.buildVoxelHeights(f);
    this.rebuildTerrain(); // Force immediate rebuild
  }

  setTheme(t: string) {
    this.assetTheme = t || "living";
    if (this.assetStyle === "assets") {
      void this.preloadAssets();
    }
  }
  setAssetStyle(s: AssetStyle) {
    this.assetStyle = s;
    if (this.assetStyle === "sprites") {
      this.clearAssetInstances();
      this.preloadSprites();
      this.clearSpriteInstances();
    } else if (this.assetStyle !== "assets") {
      this.clearAssetInstances();
      this.clearSpriteInstances();
    } else {
      void this.preloadAssets();
      this.clearSpriteInstances();
    }
  }
  preloadAssets() {
    const set = ASSET_SETS[this.assetTheme] || ASSET_SETS.living;
    const urls = new Set<string>();
    for (const spec of Object.values(set)) {
      urls.add(spec.url);
    }
    const loaders = Array.from(urls).map((url) => this.loadAsset(url));
    return Promise.all(loaders).then(() => undefined);
  }
  pick(x: number, y: number, rect: DOMRect) {
    return null;
  }

  getEntityScreenPositions(entities: Entity[], rect: DOMRect) {
    const positions = new Map<number, { x: number; y: number }>();
    const camera = this.activeCamera;
    if (!camera) return positions;
    const worldW = this.w || 1;
    const worldH = this.h || 1;
    const stats = this.terrainStats;

    for (const entity of entities) {
      const rx = entity.x - worldW / 2;
      const rz = entity.y - worldH / 2;
      let terrainHeight = 0;
      if (this.voxelHeights) {
        const gridW = this.voxelHeights[0]?.length || 0;
        const gridH = this.voxelHeights.length || 0;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
          terrainHeight = this.voxelHeights[gy][gx];
        }
      } else if (this.fieldData?.terrain && stats) {
        const gridW = this.fieldData.grid_w;
        const gridH = this.fieldData.grid_h;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < this.fieldData.terrain.length && gx >= 0 && gx < (this.fieldData.terrain[gy]?.length || 0)) {
          const rawVal = this.fieldData.terrain[gy][gx];
          const normalizedVal = (rawVal - stats.min) / stats.range;
          terrainHeight = Math.floor(normalizedVal * 8) * 0.5;
        }
      }
      const ry = terrainHeight + 0.8 + (entity.z || 0) * 0.5;
      const vector = new THREE.Vector3(rx, ry, rz);
      vector.project(camera);
      if (vector.z < -1 || vector.z > 1) continue;
      const x = (vector.x + 1) / 2 * rect.width;
      const y = (-vector.y + 1) / 2 * rect.height;
      positions.set(entity.id, { x, y });
    }

    return positions;
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

    const { grid_w, grid_h, terrain, w: worldW, h: worldH, voxels, voxel_step } = this.fieldData;

    // Scale factor: terrain grid may be smaller than world coords
    // Entities use world coords (0-worldW), terrain uses grid coords (0-grid_w)
    const scaleX = (worldW || 96) / grid_w;
    const scaleZ = (worldH || 96) / grid_h;
    const voxelSize = 0.5;
    const voxelsEnabled = Boolean(voxels && voxel_step && voxels.length);

    // Create arrays to hold all vertices, colors, and indices
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    // Center based on WORLD coordinates (so entities align properly)
    const centerX = (worldW || 96) * 0.5;
    const centerZ = (worldH || 96) * 0.5;

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
        const heightLevels = Math.max(0, Math.floor(val * 8));

        // Position and scale - scale terrain blocks to match world coordinates
        const px = (x * scaleX - centerX);
        const pz = (y * scaleZ - centerZ);
        // Determine color based on terrain value and height
        // FFT-STYLE: Saturated darks → pastel mediums → unsaturated lights
        let baseR: number, baseG: number, baseB: number;

        // Check water field for this tile
        const waterVal = this.fieldData?.water?.[y]?.[x] ?? 0;
        const isWater = waterVal > 0.3 || val < 0.25;

        if (isWater && val < 0.2) {
          // Deep Water - rich sapphire blue (FFT ocean)
          baseR = 0.12; baseG = 0.28; baseB = 0.72;
        } else if (isWater || val < 0.32) {
          // Shallow Water / River - turquoise (FFT rivers)
          baseR = 0.18; baseG = 0.55; baseB = 0.78;
        } else if (val < 0.40) {
          // Sand/Beach - warm golden (FFT desert tiles)
          baseR = 0.92; baseG = 0.78; baseB = 0.42;
        } else if (heightLevels > 6) {
          // Snow peaks - pink-white (FFT mountain tops)
          baseR = 0.96; baseG = 0.94; baseB = 0.98;
        } else if (heightLevels > 4) {
          // Stone/Mountain - lavender grey (FFT cliffs)
          baseR = 0.58; baseG = 0.52; baseB = 0.68;
        } else if (heightLevels > 2) {
          // Highland grass - darker forest green
          baseR = 0.22; baseG = 0.58; baseB = 0.28;
        } else {
          // Grass - VIBRANT saturated green (FFT plains)
          // Checkerboard pattern for tile variation
          const tileVar = ((x + y) % 2 === 0) ? 0.05 : -0.03;
          baseR = 0.28 + tileVar;
          baseG = 0.72 + tileVar;
          baseB = 0.32 + tileVar;
        }

        const faces = [
          { start: 0, count: 4, shade: 1.0 },
          { start: 4, count: 4, shade: 0.85 },
          { start: 8, count: 4, shade: 1.15 },
          { start: 12, count: 4, shade: 0.7 },
          { start: 16, count: 4, shade: 0.95 },
          { start: 20, count: 4, shade: 0.80 },
        ];

        const addVoxel = (level: number, rBase: number, gBase: number, bBase: number, shadeBias: number) => {
          const py = (level * voxelSize) + voxelSize * 0.5;
          for (const face of faces) {
            for (let i = face.start; i < face.start + face.count; i++) {
              const [vx, vy, vz] = boxVerts[i];
              positions.push(px + vx * scaleX, py + vy * voxelSize, pz + vz * scaleZ);
              const shade = Math.min(1.2, Math.max(0.4, face.shade + shadeBias));
              colors.push(
                Math.min(1.0, rBase * shade),
                Math.min(1.0, gBase * shade),
                Math.min(1.0, bBase * shade),
              );
            }
          }
          for (const i of boxIndices) {
            indices.push(vertexOffset + i);
          }
          vertexOffset += 24;
        };

        if (voxelsEnabled) {
          const vZ = voxels?.length || 0;
          const vY = voxels?.[0]?.length || 0;
          const vX = voxels?.[0]?.[0]?.length || 0;
          const zStep = voxel_step?.z || 1;
          const gx = Math.floor((x / Math.max(1, grid_w)) * vX);
          const gy = Math.floor((y / Math.max(1, grid_h)) * vY);
          if (gx >= 0 && gx < vX && gy >= 0 && gy < vY) {
            for (let z = 0; z < vZ; z++) {
              const cell = voxels?.[z]?.[gy]?.[gx] ?? 0;
              if (!cell) continue;
              const isWaterVoxel = cell === 2;
              const shadeBias = isWaterVoxel ? 0.04 : -0.03 * (vZ - z);
              const base = isWaterVoxel ? [0.18, 0.55, 0.78] : [baseR, baseG, baseB];
              const occluded =
                (voxels?.[z]?.[gy]?.[gx] ?? 0) &&
                (voxels?.[z + 1]?.[gy]?.[gx] ?? 0) &&
                (voxels?.[z - 1]?.[gy]?.[gx] ?? 0) &&
                (voxels?.[z]?.[gy + 1]?.[gx] ?? 0) &&
                (voxels?.[z]?.[gy - 1]?.[gx] ?? 0) &&
                (voxels?.[z]?.[gy]?.[gx + 1] ?? 0) &&
                (voxels?.[z]?.[gy]?.[gx - 1] ?? 0);
              if (occluded) continue;
              addVoxel(z * zStep, base[0], base[1], base[2], shadeBias);
            }
          }
        } else {
          for (let level = 0; level <= heightLevels; level++) {
            const depthShade = -0.03 * (heightLevels - level);
            addVoxel(level, baseR, baseG, baseB, depthShade);
          }

          if (waterVal > 0.15) {
            const waterLayers = Math.min(4, Math.max(1, Math.floor(waterVal * 2)));
            for (let wLevel = 1; wLevel <= waterLayers; wLevel++) {
              const level = heightLevels + wLevel;
              addVoxel(level, 0.18, 0.55, 0.78, 0.05);
            }
          }
        }
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
    this.w = worldW;
    this.h = worldH;
    if (this.needsRebuild && this.fieldData) {
      this.rebuildTerrain();
    }

    const panX = this.orbit.panX;
    const panY = this.orbit.panY;

    this.camera.position.set(200 + panX, 200, 200 + panY);
    this.camera.lookAt(panX, 0, panY);

    // Asset-based entities
    if (this.assetStyle === "assets") {
      this.updateAssetEntities(worldW, worldH);
      const delta = this.assetClock.getDelta();
      for (const mixer of this.assetMixers.values()) {
        mixer.update(delta);
      }
    } else if (this.assetStyle === "sprites") {
      this.updateSpriteEntities(worldW, worldH);
      this.clearAssetInstances();
    } else {
      this.clearAssetInstances();
    }

    // --- ENTITY RENDERER using Merged Geometry ---
    if (this.entityMesh) {
      this.isoGroup.remove(this.entityMesh);
      this.entityMesh.geometry?.dispose();
      (this.entityMesh.material as THREE.Material)?.dispose();
      this.entityMesh = null;
    }

    if (this.entities.length > 0 && this.assetStyle !== "assets" && this.assetStyle !== "sprites") {
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
        if (colorLower === "tree") modelKey = "grove";
        if (colorLower === "dino" || colorLower === "saurian" || colorLower === "raptor") modelKey = "dino";
        if (colorLower === "alien" || colorLower === "outsider" || colorLower === "voidborn") modelKey = "alien";
        if (colorLower === "machine" || colorLower === "synth" || colorLower === "metal") modelKey = "machine";
        if (colorLower === "building" || colorLower === "gray" || colorLower === "habitat") modelKey = "habitat";

        const schematic = VOXEL_MODELS[modelKey] || VOXEL_MODELS["default"];
        const baseColorHex = getColor(kindLower) !== 0xffffff ? getColor(kindLower) : getColor(colorLower);
        const baseColor = new THREE.Color(baseColorHex);

        // Position centering - USE WORLD COORDINATES (not grid coords)
        // Entity x/y are in world space (0-worldW, 0-worldH)
        const rx = (e.x - (worldW / 2));
        const rz = (e.y - (worldH / 2));

        // Sample terrain height at entity position to place entity ON the terrain
        let terrainHeight = 0;
        if (this.voxelHeights) {
          const gridW = this.voxelHeights[0]?.length || 0;
          const gridH = this.voxelHeights.length || 0;
          const wScale = gridW / worldW;
          const hScale = gridH / worldH;
          const gx = Math.floor(e.x * wScale);
          const gy = Math.floor(e.y * hScale);
          if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
            terrainHeight = this.voxelHeights[gy][gx];
          }
        } else if (this.fieldData?.terrain && this.terrainStats) {
          const gridW = this.fieldData.grid_w;
          const gridH = this.fieldData.grid_h;
          const wScale = gridW / worldW;
          const hScale = gridH / worldH;
          const gx = Math.floor(e.x * wScale);
          const gy = Math.floor(e.y * hScale);
          if (gy >= 0 && gy < this.fieldData.terrain.length && gx >= 0 && gx < (this.fieldData.terrain[gy]?.length || 0)) {
            const rawVal = this.fieldData.terrain[gy][gx];
            const normalizedVal = (rawVal - this.terrainStats.min) / this.terrainStats.range;
            terrainHeight = Math.floor(normalizedVal * 8) * 0.5;  // Match rebuildTerrain height calc
          }
        }

        // Animation & Facing Logic
        const isStatic = modelKey === "grove" || modelKey === "habitat" || modelKey === "tree" || modelKey === "building";
        const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        const isMoving = speed > 0.1;

        // Place entity ON the terrain surface
        let ryBase = terrainHeight + 0.5 + (e.z || 0) * 0.5;
        let rotation = 0;
        let wobble = 0;
        let scaleY = 1.0;

        if (!isStatic) {
          // Facing
          if (isMoving) {
            rotation = -Math.atan2(e.vy, e.vx) - Math.PI / 2;
          }

          // Movement Animation (Hop & Wobble)
          if (isMoving) {
            const walkCycle = time * 15.0; // Faster cycle for walking
            const hop = Math.abs(Math.sin(walkCycle)) * 0.2;
            ryBase += hop;
            wobble = Math.sin(walkCycle) * 0.1;
          } else {
            // Idle Breathing
            const breathe = Math.sin(time * 2.0) * 0.05;
            scaleY = 1.0 + breathe;
            ryBase += breathe * 0.2; // Slight vertical bob with breath
          }
        }

        for (const v of schematic) {
          const baseScale = 1.7;
          const scale = baseScale * (VOXEL_SCALES[modelKey] || VOXEL_SCALES.default);

          // Apply model rotation
          const vx = v.x;
          const vy = v.y; // In schematic, y is usually up? No, z is usually up in 3D, but schematic might be y-up
          // Schematic is [x, y, z] offsets. Assume y is UP in schematic?
          // Let's check `seed_world` or prev rendering.
          // Prev rendering: px = rx + v.x*scale, py = ryBase + v.z*scale, pz = rz + v.y*scale
          // So v.z is UP height in schematic? Or v.y? 
          // Line 805: py = ryBase + (v.z * scale). So Z is UP in schematic.
          // Line 806: pz = rz + (v.y * scale). So Y is DEPTH in schematic.

          // We need to rotate X and Y (depth) around the center.
          const xRaw = v.x * scale;
          const depthRaw = v.y * scale;
          const heightRaw = v.z * scale * scaleY;

          // Rotation
          const cosR = Math.cos(rotation);
          const sinR = Math.sin(rotation);

          const xRotated = xRaw * cosR - depthRaw * sinR;
          const dRotated = xRaw * sinR + depthRaw * cosR;

          // Apply wobble to height and x (roll)
          const hWobble = heightRaw + (xRotated * wobble);

          const px = rx + xRotated;
          const py = ryBase + hWobble;
          const pz = rz + dRotated;

          const voxelColor = baseColor.clone();
          voxelColor.offsetHSL(0, 0, v.colorOff);

          for (const [bx, by, bz] of boxVerts) {
            positions.push(px + bx * scale, py + by * scale, pz + bz * scale);
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

  private preloadSprites() {
    if (this.spriteTexture) return;
    const loader = new THREE.TextureLoader();
    this.spriteTexture = loader.load(spriteUrl);
    this.spriteTexture.magFilter = THREE.NearestFilter;
    this.spriteTexture.minFilter = THREE.NearestFilter;
    this.spriteTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.spriteTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  private spriteFrameFor(entity: Entity) {
    const kind = (entity.kind || "").toLowerCase();
    const color = (entity.color || "").toLowerCase();
    const key = kind || color || "default";
    const map: Record<string, number> = {
      settler: 1,
      humanoid: 1,
      fauna: 2,
      animal: 2,
      outsider: 3,
      alien: 3,
      grove: 4,
      tree: 4,
      habitat: 5,
      building: 5,
      dino: 6,
      machine: 7,
      creature: 8,
      default: 0,
    };
    return map[key] ?? 0;
  }

  private getSpriteMaterial(entity: Entity) {
    const frame = this.spriteFrameFor(entity);
    const key = String(frame);
    const cached = this.spriteMaterials.get(key);
    if (cached) return cached;
    if (!this.spriteTexture) {
      this.preloadSprites();
    }
    const tex = (this.spriteTexture as THREE.Texture).clone();
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const grid = 16;
    const col = frame % grid;
    const row = Math.floor(frame / grid);
    tex.repeat.set(1 / grid, 1 / grid);
    tex.offset.set(col / grid, 1 - (row + 1) / grid);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.2,
    });
    this.spriteMaterials.set(key, mat);
    return mat;
  }

  private updateSpriteEntities(worldW: number, worldH: number) {
    if (!this.fieldData) return;
    const stats = this.terrainStats;
    const used = new Set<number>();
    for (const entity of this.entities) {
      const material = this.getSpriteMaterial(entity);
      let sprite = this.spriteInstances.get(entity.id);
      if (!sprite) {
        sprite = new THREE.Sprite(material);
        this.spriteGroup.add(sprite);
        this.spriteInstances.set(entity.id, sprite);
      } else if (sprite.material !== material) {
        sprite.material = material;
      }
      used.add(entity.id);

      const rx = entity.x - (worldW / 2);
      const rz = entity.y - (worldH / 2);
      let terrainHeight = 0;
      if (this.voxelHeights) {
        const gridW = this.voxelHeights[0]?.length || 0;
        const gridH = this.voxelHeights.length || 0;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
          terrainHeight = this.voxelHeights[gy][gx];
        }
      } else if (this.fieldData?.terrain && stats) {
        const gridW = this.fieldData.grid_w;
        const gridH = this.fieldData.grid_h;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < this.fieldData.terrain.length && gx >= 0 && gx < (this.fieldData.terrain[gy]?.length || 0)) {
          const rawVal = this.fieldData.terrain[gy][gx];
          const normalizedVal = (rawVal - stats.min) / stats.range;
          terrainHeight = Math.floor(normalizedVal * 8) * 0.5;
        }
      }
      const y = terrainHeight + 0.6 + (entity.z || 0) * 0.5;
      sprite.position.set(rx, y, rz);
      const size = Math.max(0.8, (entity.size || 2.0) * 0.28);
      sprite.scale.set(size, size, size);
    }

    for (const [id, sprite] of this.spriteInstances.entries()) {
      if (!used.has(id)) {
        this.spriteGroup.remove(sprite);
        this.spriteInstances.delete(id);
      }
    }
  }

  private updateAssetEntities(worldW: number, worldH: number) {
    if (!this.fieldData) return;
    const stats = this.terrainStats;
    const maxCount = Math.min(this.maxAssetEntities, this.entities.length);
    const used = new Set<number>();
    const now = performance.now() * 0.001;
    const staticKinds = new Set(["habitat", "obelisk", "station", "grove", "cycad", "tree"]);
    for (let i = 0; i < maxCount; i++) {
      const entity = this.entities[i];
      const spec = this.resolveAssetSpec(entity);
      if (!spec) continue;
      const cached = this.assetCache.get(spec.url);
      if (!cached) continue;
      let obj = this.assetInstances.get(entity.id);
      if (!obj) {
        obj = cloneSkeleton(cached.scene) as THREE.Object3D;
        this.applyAssetMaterial(obj, spec);
        this.normalizeAsset(obj, spec, entity.id);
        this.assetGroup.add(obj);
        this.assetInstances.set(entity.id, obj);
        obj.userData.baseRotY = obj.rotation.y;
        if (cached.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(obj);
          mixer.clipAction(cached.animations[0]).play();
          this.assetMixers.set(entity.id, mixer);
        }
      }
      used.add(entity.id);

      const rx = entity.x - (worldW / 2);
      const rz = entity.y - (worldH / 2);
      let terrainHeight = 0;
      if (this.voxelHeights) {
        const gridW = this.voxelHeights[0]?.length || 0;
        const gridH = this.voxelHeights.length || 0;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
          terrainHeight = this.voxelHeights[gy][gx];
        }
      } else if (this.fieldData?.terrain && stats) {
        const gridW = this.fieldData.grid_w;
        const gridH = this.fieldData.grid_h;
        const wScale = gridW / worldW;
        const hScale = gridH / worldH;
        const gx = Math.floor(entity.x * wScale);
        const gy = Math.floor(entity.y * hScale);
        if (gy >= 0 && gy < this.fieldData.terrain.length && gx >= 0 && gx < (this.fieldData.terrain[gy]?.length || 0)) {
          const rawVal = this.fieldData.terrain[gy][gx];
          const normalizedVal = (rawVal - stats.min) / stats.range;
          terrainHeight = Math.floor(normalizedVal * 8) * 0.5;
        }
      }
      const y = terrainHeight + (spec.yOffset || 0) + (entity.z || 0) * 0.5;
      const idlePhase = now + (entity.id % 11) * 0.6;
      const hasAnimation = this.assetMixers.has(entity.id);
      const isStatic = staticKinds.has((entity.kind || "").toLowerCase()) || staticKinds.has((entity.color || "").toLowerCase());
      const idleBob = !hasAnimation && !isStatic ? Math.sin(idlePhase * 2.0) * 0.08 : 0;
      const idleSway = !hasAnimation && isStatic ? Math.sin(idlePhase * 1.2) * 0.03 : 0;
      obj.position.set(rx, y + idleBob, rz);
      const speed = Math.hypot(entity.vx, entity.vy);
      if (speed > 0.02) {
        obj.rotation.y = -Math.atan2(entity.vy, entity.vx) + Math.PI / 2;
      } else {
        obj.rotation.y = (obj.userData.baseRotY || 0) + idleSway;
      }
    }
    for (const [id, obj] of this.assetInstances.entries()) {
      if (!used.has(id)) {
        this.assetGroup.remove(obj);
        this.assetInstances.delete(id);
        this.assetMixers.delete(id);
      }
    }
  }
  private clearAssetInstances() {
    for (const obj of this.assetInstances.values()) {
      this.assetGroup.remove(obj);
    }
    this.assetInstances.clear();
    this.assetMixers.clear();
  }

  private clearSpriteInstances() {
    for (const sprite of this.spriteInstances.values()) {
      this.spriteGroup.remove(sprite);
    }
    this.spriteInstances.clear();
  }

  private buildVoxelHeights(field: FieldPayload): number[][] | null {
    if (!field.voxels || !field.voxel_step) return null;
    const vox = field.voxels;
    const zLen = vox.length;
    const yLen = vox[0]?.length || 0;
    const xLen = vox[0]?.[0]?.length || 0;
    if (!zLen || !yLen || !xLen) return null;
    const heights: number[][] = [];
    const voxelSize = 0.5;
    for (let y = 0; y < yLen; y++) {
      heights[y] = [];
      for (let x = 0; x < xLen; x++) {
        let top = 0;
        for (let z = zLen - 1; z >= 0; z--) {
          const val = vox[z]?.[y]?.[x] ?? 0;
          if (val === 1) {
            top = z + 1;
            break;
          }
        }
        heights[y][x] = top * voxelSize * (field.voxel_step?.z || 1);
      }
    }
    return heights;
  }

  private async loadAsset(url: string): Promise<void> {
    if (this.assetCache.has(url)) return;
    if (url.startsWith("PRIMITIVE_")) {
      const primitive = this.createPrimitive(url);
      this.assetCache.set(url, { scene: primitive, animations: [] });
      return;
    }
    const gltf = await this.assetLoader.loadAsync(url);
    this.assetCache.set(url, { scene: gltf.scene, animations: gltf.animations || [] });
  }

  private createPrimitive(url: string): THREE.Object3D {
    let geom: THREE.BufferGeometry;
    if (url === "PRIMITIVE_CONE") {
      geom = new THREE.ConeGeometry(0.6, 1.2, 6);
    } else if (url === "PRIMITIVE_SPHERE") {
      geom = new THREE.SphereGeometry(0.6, 12, 10);
    } else {
      geom = new THREE.BoxGeometry(1, 1, 1);
    }
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  private resolveAssetSpec(entity: Entity): AssetSpec | null {
    const set = ASSET_SETS[this.assetTheme] || ASSET_SETS.living;
    const kind = (entity.kind || "").toLowerCase();
    const color = (entity.color || "").toLowerCase();
    if (set[kind]) return set[kind];
    if (set[color]) return set[color];
    const fallbackKey = ASSET_KIND_FALLBACK[kind] || ASSET_KIND_FALLBACK[color];
    if (fallbackKey && set[fallbackKey]) return set[fallbackKey];
    return null;
  }

  private applyAssetMaterial(obj: THREE.Object3D, spec: AssetSpec) {
    obj.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const material = (mesh.material as THREE.MeshStandardMaterial);
      if (spec.tint) {
        material.color = new THREE.Color(spec.tint);
      }
      if (spec.emissive) {
        material.emissive = new THREE.Color(spec.emissive);
        material.emissiveIntensity = 0.6;
      }
      if (spec.roughness !== undefined) material.roughness = spec.roughness;
      if (spec.metalness !== undefined) material.metalness = spec.metalness;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  private normalizeAsset(obj: THREE.Object3D, spec: AssetSpec, seed: number) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y || 1;
    const extent = Math.max(size.x, size.z) || 1;
    const baseScale = spec.scale || 1.0;
    let targetHeight = spec.targetHeight;
    if (spec.heightRange) {
      const t = this.seededRandom(seed);
      targetHeight = spec.heightRange[0] + (spec.heightRange[1] - spec.heightRange[0]) * t;
    }
    if (targetHeight) {
      const scale = (targetHeight / height) * baseScale;
      obj.scale.setScalar(scale);
    } else if (spec.targetExtent || spec.extentRange) {
      let targetExtent = spec.targetExtent || extent;
      if (spec.extentRange) {
        const t = this.seededRandom(seed);
        targetExtent = spec.extentRange[0] + (spec.extentRange[1] - spec.extentRange[0]) * t;
      }
      const scale = (targetExtent / extent) * baseScale;
      obj.scale.setScalar(scale);
    } else {
      obj.scale.setScalar(baseScale);
    }
    if (spec.rotateY) {
      obj.rotation.y = spec.rotateY;
    }
  }

  private seededRandom(seed: number) {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }
}
