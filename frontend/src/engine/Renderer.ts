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

// --- HIGH FIDELITY VOXEL SCHEMATICS ---
// "No Simple Shapes". We build complex models from micro-voxels.
type VoxelDef = { x: number; y: number; z: number; colorOff: number }; // colorOff: offset from base color

const VOXEL_MODELS: Record<string, VoxelDef[]> = {
  // SETTLER: Humanoid (Arms, Legs, Head, Body)
  settler: [
    // Legs
    { x: -0.2, y: 0, z: 0, colorOff: -0.1 },
    { x: 0.2, y: 0, z: 0, colorOff: -0.1 },
    { x: -0.2, y: 0, z: 0.2, colorOff: -0.1 },
    { x: 0.2, y: 0, z: 0.2, colorOff: -0.1 },
    // Torso
    { x: 0, y: 0, z: 0.4, colorOff: 0 },
    { x: 0, y: 0, z: 0.6, colorOff: 0 },
    { x: -0.2, y: 0, z: 0.5, colorOff: 0 },
    { x: 0.2, y: 0, z: 0.5, colorOff: 0 },
    // Arms
    { x: -0.4, y: 0, z: 0.5, colorOff: 0.1 },
    { x: 0.4, y: 0, z: 0.5, colorOff: 0.1 },
    // Head
    { x: 0, y: 0, z: 0.8, colorOff: 0.2 },
    // Hair/Hat
    { x: 0, y: 0, z: 1.0, colorOff: -0.2 },
    { x: 0.2, y: 0, z: 0.9, colorOff: -0.2 },
    { x: -0.2, y: 0, z: 0.9, colorOff: -0.2 },
  ],
  // FAUNA: Quadruped (Body, 4 Legs, Head)
  fauna: [
    // Legs
    { x: -0.3, y: -0.3, z: 0, colorOff: -0.1 },
    { x: 0.3, y: -0.3, z: 0, colorOff: -0.1 },
    { x: -0.3, y: 0.3, z: 0, colorOff: -0.1 },
    { x: 0.3, y: 0.3, z: 0, colorOff: -0.1 },
    // Body
    { x: 0, y: 0, z: 0.3, colorOff: 0 },
    { x: 0, y: 0.2, z: 0.3, colorOff: 0 },
    { x: 0, y: -0.2, z: 0.3, colorOff: 0 },
    { x: 0, y: 0, z: 0.5, colorOff: 0 },
    // Head
    { x: 0, y: 0.4, z: 0.6, colorOff: 0.1 },
    // Tail
    { x: 0, y: -0.4, z: 0.4, colorOff: -0.05 },
  ],
  // GROVE: Complex Tree (Trunk, Layers of Leaves)
  grove: [
    // Trunk
    { x: 0, y: 0, z: 0, colorOff: -0.4 },
    { x: 0, y: 0, z: 0.3, colorOff: -0.4 },
    { x: 0, y: 0, z: 0.6, colorOff: -0.4 },
    // Leaves Layer 1 (Wide)
    { x: 0.4, y: 0, z: 0.8, colorOff: 0.1 },
    { x: -0.4, y: 0, z: 0.8, colorOff: 0.1 },
    { x: 0, y: 0.4, z: 0.8, colorOff: 0.1 },
    { x: 0, y: -0.4, z: 0.8, colorOff: 0.1 },
    // Leaves Layer 2 (Mid)
    { x: 0.3, y: 0.3, z: 1.1, colorOff: 0.2 },
    { x: -0.3, y: -0.3, z: 1.1, colorOff: 0.2 },
    { x: -0.3, y: 0.3, z: 1.1, colorOff: 0.2 },
    { x: 0.3, y: -0.3, z: 1.1, colorOff: 0.2 },
    // Top
    { x: 0, y: 0, z: 1.4, colorOff: 0.3 },
  ],
  // HABITAT: House (Walls, Roof, Door)
  habitat: [
    // Base
    { x: 0, y: 0, z: 0, colorOff: -0.1 },
    { x: 0.4, y: 0, z: 0, colorOff: -0.1 },
    { x: -0.4, y: 0, z: 0, colorOff: -0.1 },
    { x: 0, y: 0.4, z: 0, colorOff: -0.1 },
    { x: 0.4, y: 0.4, z: 0, colorOff: -0.1 },
    { x: -0.4, y: 0.4, z: 0, colorOff: -0.1 },
    { x: 0, y: -0.4, z: 0, colorOff: -0.1 },
    { x: 0.4, y: -0.4, z: 0, colorOff: -0.1 },
    { x: -0.4, y: -0.4, z: 0, colorOff: -0.1 },
    // Walls
    { x: 0.4, y: 0.4, z: 0.4, colorOff: 0 },
    { x: -0.4, y: 0.4, z: 0.4, colorOff: 0 },
    { x: 0.4, y: -0.4, z: 0.4, colorOff: 0 },
    { x: -0.4, y: -0.4, z: 0.4, colorOff: 0 },
    // Roof (Pyramid)
    { x: 0, y: 0, z: 0.8, colorOff: 0.2 },
    { x: 0.2, y: 0, z: 0.6, colorOff: 0.2 },
    { x: -0.2, y: 0, z: 0.6, colorOff: 0.2 },
    { x: 0, y: 0.2, z: 0.6, colorOff: 0.2 },
    { x: 0, y: -0.2, z: 0.6, colorOff: 0.2 },
  ],
  // DEFAULT
  default: [{ x: 0, y: 0, z: 0, colorOff: 0 }],
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

// Basic colors for fallback
const COLOR_MAP: Record<string, number> = {
  red: 0xff4646,
  blue: 0x4678ff,
  green: 0x46ff8c,
  metal: 0xbebed2,
  gray: 0xa0a0a0,
  gold: 0xffd25a,
  human: 0xffb28c,
  animal: 0x78c85a,
  alien: 0x78ffd4,
  building: 0x968ca0,
  tree: 0x50a050,
  dino: 0x5ad28c,
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
      this.terrainMesh.dispose();
      this.terrainMesh = null;
    }

    if (!this.fieldData) return;

    const { grid_w, grid_h, terrain } = this.fieldData;

    // Use BASIC MATERIAL (Unlit)
    // This allows exact color control without lighting artifacts. Max vibrance.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, // Tinted by instanceColor
      vertexColors: true, // REQUIRED for InstancedMesh colors to show!
    });

    const count = grid_w * grid_h;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let idx = 0;

    const centerX = grid_w * 0.5;
    const centerZ = grid_h * 0.5;

    for (let y = 0; y < grid_h; y++) {
      for (let x = 0; x < grid_w; x++) {
        const val = terrain[y][x];
        const height = Math.floor(val * 8);

        // Visual Height calculation
        const topY = height * 0.5;
        const bottomY = -4.0;
        const thickness = Math.max(0.5, topY - bottomY);

        dummy.position.set(
          (x - centerX) * 1.0,
          bottomY + thickness / 2.0,
          (y - centerZ) * 1.0,
        );
        dummy.scale.set(1.0, thickness, 1.0);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);

        // Color Logic (Simple)
        if (val < 0.2)
          color.setHex(0x4678ff); // Water
        else if (val < 0.25)
          color.setHex(0xe6d296); // Sand
        else if (height > 5)
          color.setHex(0x8c8c96); // Stone
        else if (height > 6)
          color.setHex(0xffffff); // Snow
        else color.setHex(0x46ff8c); // Grass

        mesh.setColorAt(idx, color);
        idx++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.terrainMesh = mesh;
    this.isoGroup.add(mesh);
    this.needsRebuild = false;
  }

  render(worldW: number, worldH: number) {
    if (this.needsRebuild && this.fieldData) {
      this.rebuildTerrain();
    }

    const panX = this.orbit.panX;
    const panY = this.orbit.panY;

    this.camera.position.set(200 + panX, 200, 200 + panY);
    this.camera.lookAt(panX, 0, panY);

    // --- HIGH FIDELITY VOXEL RENDERER ---
    // Instancing micro-voxels to build complex shapes.

    // Max instances = Entities * AvgVoxelsPerEntity (e.g., 50 * 20 = 1000) -> Safe 10,000 buffer
    const MAX_INSTANCES = 10000;

    if (!this.entityMesh) {
      // Micro-voxel geometry (Small cube)
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
      });

      this.entityMesh = new THREE.InstancedMesh(
        geometry,
        material,
        MAX_INSTANCES,
      );
      this.entityMesh.castShadow = false;
      this.entityMesh.receiveShadow = false;
      this.entityMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.isoGroup.add(this.entityMesh);
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let idx = 0;

    this.entities.forEach((e) => {
      // Determine Model Type
      let modelKey = "default";
      let baseColorHex = 0xffffff;

      if (e.kind) modelKey = e.kind.toLowerCase();
      // Fallback to color if kind is missing or generic
      if (e.color === "settler") modelKey = "settler";
      if (e.color === "fauna") modelKey = "fauna";
      if (e.color === "grove") modelKey = "grove";
      if (e.color === "habitat") modelKey = "habitat";
      if (e.color === "outsider") modelKey = "settler"; // Re-use humanoid

      const schematic = VOXEL_MODELS[modelKey] || VOXEL_MODELS["default"];
      baseColorHex = getColor(e.kind || e.color);

      // Position in World
      const rx = (e.x - worldW / 2) * 1.0;
      const rz = (e.y - worldH / 2) * 1.0;

      // Animation: Bobbing
      const time = Date.now() * 0.005;
      const bob = Math.sin(time + e.id) * 0.1;
      const ryBase = e.z * 1.5 + 0.5 + bob;

      // Render each sub-voxel of the schematic
      for (const v of schematic) {
        if (idx >= MAX_INSTANCES) break;

        // Sub-voxel transform
        // We scale the schematic by a factor (e.g. 0.6) so the overall entity fits in 1x1 block
        const scale = 0.5;

        dummy.position.set(
          rx + v.x * scale,
          ryBase + v.z * scale, // Z in schematic is Up (Y in ThreeJS)
          rz + v.y * scale, // Y in schematic is Depth (Z in ThreeJS)
        );

        // Micro-voxel size
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        this.entityMesh!.setMatrixAt(idx, dummy.matrix);

        // Color variation
        const c = new THREE.Color(baseColorHex);
        c.offsetHSL(0, 0, v.colorOff); // Lighten/Darken parts
        this.entityMesh!.setColorAt(idx, c);

        idx++;
      }
    });

    // Hide unused instances
    for (let i = idx; i < MAX_INSTANCES; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      this.entityMesh.setMatrixAt(i, dummy.matrix);
    }

    this.entityMesh.instanceMatrix.needsUpdate = true;
    if (this.entityMesh.instanceColor)
      this.entityMesh.instanceColor.needsUpdate = true;

    this.renderer.render(this.scene, this.activeCamera);
  }
}
