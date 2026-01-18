/**
 * PixelArtRenderer - 2D Canvas isometric renderer
 * Uses source-over composite with pre-filled rectangles to eliminate sprite transparency
 */

import tilesetDefault from "../assets/tileset.png";
import tilesetFantasy from "../assets/tileset_fantasy.png";
import tilesetOceanic from "../assets/tileset_oceanic.png";
import tilesetFrostbound from "../assets/tileset_frostbound.png";
import tilesetEmberfall from "../assets/tileset_emberfall.png";
import tilesetDino from "../assets/tileset_dino.png";
import tilesetSpace from "../assets/tileset_space.png";
import tilesetNeon from "../assets/tileset_neon.png";
import tilesetSkyborne from "../assets/tileset_skyborne.png";
import tilesetIronwild from "../assets/tileset_ironwild.png";

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

export type FieldPayload = {
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

type SpriteRegion = { x: number; y: number; w: number; h: number };

const THEME_TILESETS: Record<string, string> = {
    living: tilesetDefault,
    fantasy: tilesetFantasy,
    dino: tilesetDino,
    space: tilesetSpace,
    oceanic: tilesetOceanic,
    frostbound: tilesetFrostbound,
    emberfall: tilesetEmberfall,
    neon: tilesetNeon,
    skyborne: tilesetSkyborne,
    ironwild: tilesetIronwild,
};

// Sprite layout for 1024x1024 tilesets
const SPRITE_LAYOUT = {
    terrain: [
        { x: 10, y: 10, w: 185, h: 130 },
        { x: 215, y: 10, w: 185, h: 130 },
        { x: 420, y: 10, w: 185, h: 130 },
        { x: 625, y: 10, w: 185, h: 130 },
        { x: 830, y: 10, w: 185, h: 130 },
    ],
    vegetation: [
        { x: 0, y: 160, w: 256, h: 290 },
        { x: 256, y: 160, w: 256, h: 290 },
        { x: 512, y: 160, w: 256, h: 290 },
        { x: 768, y: 160, w: 256, h: 290 },
    ],
    buildings: [
        { x: 0, y: 450, w: 341, h: 300 },
        { x: 341, y: 450, w: 341, h: 300 },
        { x: 682, y: 450, w: 342, h: 300 },
    ],
    characters: [
        { x: 0, y: 750, w: 256, h: 274 },
        { x: 256, y: 750, w: 256, h: 274 },
        { x: 512, y: 750, w: 256, h: 274 },
        { x: 768, y: 750, w: 256, h: 274 },
    ],
};

// Tile dimensions for seamless isometric grid
const TILE_W = 48;
const TILE_H = 24;
const HEIGHT_SCALE = 0.3;

// Terrain base colors
const TERRAIN_COLORS: Record<string, string[]> = {
    living: ['#4a9a4a', '#4090b0', '#d0b080', '#808080', '#e0f0f8'],
    fantasy: ['#9060b0', '#6040a0', '#e090c0', '#606080', '#d0e0f0'],
    oceanic: ['#409080', '#306080', '#60b0a0', '#506070', '#a0d8e0'],
    frostbound: ['#b0d0e0', '#7098c0', '#c0d0b0', '#708090', '#f0f8ff'],
    emberfall: ['#705040', '#a02818', '#604030', '#403030', '#b05030'],
    dino: ['#609050', '#506040', '#807858', '#404040', '#70a070'],
    space: ['#405070', '#203050', '#705090', '#505060', '#607090'],
    neon: ['#ff00ff', '#00ffff', '#ffff00', '#8080a0', '#e0f0ff'],
    skyborne: ['#f0e8ff', '#a0d0ff', '#f8f0e0', '#b0b8c0', '#f8ffff'],
    ironwild: ['#8a7060', '#404850', '#605040', '#706050', '#c0c8d0'],
};

const THEME_BG: Record<string, string> = {
    living: '#87CEEB',
    fantasy: '#5A2080',
    oceanic: '#0277BD',
    frostbound: '#B3E5FC',
    emberfall: '#4E342E',
    dino: '#558B2F',
    space: '#0D0D1A',
    neon: '#1a0a2e',
    skyborne: '#c8e8ff',
    ironwild: '#4a4035',
};

export class PixelArtRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tilesets: Map<string, HTMLImageElement> = new Map();
    private currentTheme: string = 'living';
    private entities: Entity[] = [];
    private fieldData?: FieldPayload;
    private offsetX = 0;
    private offsetY = 0;
    private zoom = 1.0;
    private baseOffsetX = 0;
    private baseOffsetY = 0;
    private entityScreenPositions: Map<number, { x: number; y: number }> = new Map();

    // OFF-SCREEN CANVAS FOR SEAMLESS TERRAIN (professional game dev technique)
    private terrainCanvas: HTMLCanvasElement | null = null;
    private terrainCtx: CanvasRenderingContext2D | null = null;
    private terrainDirty = true;
    private terrainBaseOriginX = 0;
    private terrainBaseOriginY = 0;
    private terrainBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    private terrainBaseBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    private spriteBounds: Map<string, Record<keyof typeof SPRITE_LAYOUT, SpriteRegion[]>> = new Map();
    private terrainAtlasCache: Map<string, { atlas: HTMLCanvasElement; tiles: SpriteRegion[] }> = new Map();
    private outlinedSpriteCache: Map<string, HTMLCanvasElement> = new Map();
    private useLiveTerrain = true;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        // PIXEL-PERFECT RENDERING SETUP (from research)
        this.ctx.imageSmoothingEnabled = false;
        // @ts-ignore - vendor prefixes for older browsers
        this.ctx.webkitImageSmoothingEnabled = false;
        // @ts-ignore
        this.ctx.mozImageSmoothingEnabled = false;

        // CSS pixelated rendering - prevents browser smoothing
        canvas.style.imageRendering = 'pixelated';
        canvas.style.imageRendering = 'crisp-edges'; // Firefox fallback

        this.preloadTilesets();
    }

    private adjustColor(hex: string, amount: number): string {
        const value = hex.replace("#", "");
        if (value.length !== 6) return hex;
        const num = parseInt(value, 16);
        const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
        const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    private preloadTilesets() {
        for (const [theme, url] of Object.entries(THEME_TILESETS)) {
            const img = new Image();
            img.onload = () => this.tilesets.set(theme, img);
            img.src = url;
        }
    }

    private getSpriteBounds(theme: string, tileset: HTMLImageElement) {
        const cached = this.spriteBounds.get(theme);
        if (cached) return cached;

        const canvas = document.createElement("canvas");
        canvas.width = tileset.width;
        canvas.height = tileset.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            const fallback = {
                terrain: [...SPRITE_LAYOUT.terrain],
                vegetation: [...SPRITE_LAYOUT.vegetation],
                buildings: [...SPRITE_LAYOUT.buildings],
                characters: [...SPRITE_LAYOUT.characters],
            };
            this.spriteBounds.set(theme, fallback);
            return fallback;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tileset, 0, 0);

        const result = {
            terrain: [] as SpriteRegion[],
            vegetation: [] as SpriteRegion[],
            buildings: [] as SpriteRegion[],
            characters: [] as SpriteRegion[],
        };

        (Object.keys(SPRITE_LAYOUT) as Array<keyof typeof SPRITE_LAYOUT>).forEach((category) => {
            const list = SPRITE_LAYOUT[category];
            for (const region of list) {
                if (category === "terrain") {
                    result[category].push({ ...region });
                    continue;
                }
                const data = ctx.getImageData(region.x, region.y, region.w, region.h).data;
                let minX = region.w;
                let minY = region.h;
                let maxX = -1;
                let maxY = -1;
                for (let y = 0; y < region.h; y++) {
                    for (let x = 0; x < region.w; x++) {
                        const idx = (y * region.w + x) * 4 + 3;
                        if (data[idx] > 12) {
                            if (x < minX) minX = x;
                            if (y < minY) minY = y;
                            if (x > maxX) maxX = x;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                if (maxX < 0 || maxY < 0) {
                    result[category].push({ ...region });
                } else {
                    const pad = 2;
                    const bx = Math.max(0, minX - pad);
                    const by = Math.max(0, minY - pad);
                    const bw = Math.min(region.w, maxX - minX + 1 + pad * 2);
                    const bh = Math.min(region.h, maxY - minY + 1 + pad * 2);
                    result[category].push({
                        x: region.x + bx,
                        y: region.y + by,
                        w: bw,
                        h: bh,
                    });
                }
            }
        });

        this.spriteBounds.set(theme, result);
        return result;
    }

    setTheme(theme: string) {
        // Map all preset names to tileset keys
        const themeMap: Record<string, string> = {
            // Living/Nature variants
            'living_world': 'living',
            'living': 'living',
            'ai_village': 'living',

            // Fantasy variants  
            'fantasy_kingdom': 'fantasy',
            'fantasy': 'fantasy',

            // Neon/Cyberpunk (unique tileset)
            'neon_frontier': 'neon',
            'neon': 'neon',

            // Dino/prehistoric
            'time_travel_dino': 'dino',
            'dinosaur_era': 'dino',
            'dino': 'dino',

            // Space/Sci-fi
            'deep_space': 'space',
            'space': 'space',
            'scifi': 'space',

            // Ocean variants
            'oceanic_realm': 'oceanic',
            'oceanic': 'oceanic',

            // Skyborne (unique tileset - floating islands)
            'skyborne_archipelago': 'skyborne',
            'skyborne': 'skyborne',

            // Ice/Frost variants
            'frostbound_frontier': 'frostbound',
            'frostbound': 'frostbound',

            // Fire/Ember variants
            'emberfall_reach': 'emberfall',
            'emberfall': 'emberfall',

            // Ironwild (unique tileset - steampunk)
            'ironwild_expanse': 'ironwild',
            'ironwild': 'ironwild',
        };

        // Normalize theme name (lowercase, replace spaces with underscores)
        const normalized = (theme || '').toLowerCase().replace(/\s+/g, '_');
        const nextTheme = themeMap[normalized] || themeMap[theme] || 'living';
        if (this.currentTheme !== nextTheme) {
            this.currentTheme = nextTheme;
            this.terrainDirty = true;
        }
        console.log(`Theme set: ${theme} -> ${this.currentTheme}`);
    }

    resize(w: number, h: number) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.imageSmoothingEnabled = false;
        this.terrainDirty = true; // Re-render terrain on resize just to be safe
    }

    setEntities(entities: Entity[]) {
        this.entities = entities;
    }

    setFields(f: FieldPayload) {
        this.fieldData = f;
        this.terrainDirty = true; // Re-render terrain on offscreen canvas
    }
    setOffset(x: number, y: number) { this.offsetX = x; this.offsetY = y; }
    setZoom(z: number) {
        const newZoom = Math.max(0.25, Math.min(3, z));
        if (this.zoom !== newZoom) {
            this.zoom = newZoom;
            this.terrainDirty = true; // Re-render terrain on zoom change
        }
    }
    getEntityScreenPositions() {
        return new Map(this.entityScreenPositions);
    }

    private getTileset(): HTMLImageElement | null {
        return this.tilesets.get(this.currentTheme) || this.tilesets.get('living') || null;
    }

    private getSpriteRegion(category: keyof typeof SPRITE_LAYOUT, index: number, tileset: HTMLImageElement): SpriteRegion {
        const theme = this.currentTheme || "living";
        const bounds = this.getSpriteBounds(theme, tileset);
        const list = bounds[category] || SPRITE_LAYOUT[category];
        return list[Math.min(index, list.length - 1)];
    }

    private getOutlinedSprite(tileset: HTMLImageElement, sprite: SpriteRegion, destW: number, destH: number): HTMLCanvasElement {
        const key = `${this.currentTheme}-${sprite.x}-${sprite.y}-${destW}-${destH}`;
        const cached = this.outlinedSpriteCache.get(key);
        if (cached) return cached;

        const mask = document.createElement("canvas");
        mask.width = destW;
        mask.height = destH;
        const maskCtx = mask.getContext("2d");
        if (!maskCtx) return mask;
        maskCtx.imageSmoothingEnabled = false;
        maskCtx.drawImage(tileset, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, destW, destH);

        const outline = document.createElement("canvas");
        outline.width = destW + 2;
        outline.height = destH + 2;
        const outlineCtx = outline.getContext("2d");
        if (!outlineCtx) return outline;
        outlineCtx.imageSmoothingEnabled = false;
        const offsets = [
            [0, 1], [2, 1], [1, 0], [1, 2],
        ];
        for (const [dx, dy] of offsets) {
            outlineCtx.drawImage(mask, dx, dy);
        }
        outlineCtx.globalCompositeOperation = "source-in";
        outlineCtx.fillStyle = "rgba(10, 12, 16, 0.8)";
        outlineCtx.fillRect(0, 0, outline.width, outline.height);
        outlineCtx.globalCompositeOperation = "source-over";
        outlineCtx.drawImage(mask, 1, 1);

        this.outlinedSpriteCache.set(key, outline);
        return outline;
    }

    private getTerrainAtlas(theme: string, tileset: HTMLImageElement, tw: number, th: number) {
        const key = `${theme}-${Math.round(tw)}-${Math.round(th)}`;
        const cached = this.terrainAtlasCache.get(key);
        if (cached) return cached;

        const tiles: SpriteRegion[] = [];
        const tileCount = SPRITE_LAYOUT.terrain.length;
        const cols = tileCount;
        const rows = 1;
        const pad = 6;
        const atlas = document.createElement("canvas");
        atlas.width = cols * (tw + pad * 2);
        atlas.height = rows * (th + pad * 2);
        const ctx = atlas.getContext("2d");
        if (!ctx) {
            return { atlas, tiles };
        }
        ctx.imageSmoothingEnabled = false;

        const halfW = tw / 2;
        const halfH = th / 2;
        const inset = 0;
        for (let i = 0; i < tileCount; i++) {
            const sprite = this.getSpriteRegion("terrain", i, tileset);
            const tileX = i * (tw + pad * 2);
            const tileY = 0;
            const drawX = tileX + pad;
            const drawY = tileY + pad;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(drawX + halfW, drawY + inset);
            ctx.lineTo(drawX + tw - inset, drawY + halfH);
            ctx.lineTo(drawX + halfW, drawY + th - inset);
            ctx.lineTo(drawX + inset, drawY + halfH);
            ctx.closePath();
            ctx.clip();
            const spriteScale = (tw / sprite.w) * 1.08;
            const destW = sprite.w * spriteScale;
            const destH = sprite.h * spriteScale;
            const imgX = drawX + (tw - destW) / 2;
            const imgY = drawY + (th / 2) - destH + th * 0.45;
            ctx.drawImage(tileset, sprite.x, sprite.y, sprite.w, sprite.h, imgX, imgY, destW, destH);
            ctx.restore();

            // Edge bleed: extend nearby pixels into the gutter to hide seams.
            ctx.drawImage(atlas, drawX, drawY, 1, th, drawX - 1, drawY, 1, th);
            ctx.drawImage(atlas, drawX + tw - 1, drawY, 1, th, drawX + tw, drawY, 1, th);
            ctx.drawImage(atlas, drawX, drawY, tw, 1, drawX, drawY - 1, tw, 1);
            ctx.drawImage(atlas, drawX, drawY + th - 1, tw, 1, drawX, drawY + th, tw, 1);

            tiles.push({ x: drawX, y: drawY, w: tw, h: th });
        }

        const payload = { atlas, tiles };
        this.terrainAtlasCache.set(key, payload);
        return payload;
    }

    private gridToScreen(gx: number, gy: number, height: number = 0): { x: number; y: number } {
        const tw = Math.max(1, Math.round(TILE_W * this.zoom));
        const th = Math.max(1, Math.round(TILE_H * this.zoom));
        // Round to integers to avoid subpixel anti-aliasing gaps
        return {
            x: Math.round((gx - gy) * (tw / 2) + this.baseOffsetX),
            y: Math.round((gx + gy) * (th / 2) - height * th * HEIGHT_SCALE + this.baseOffsetY)
        };
    }

    private gridToLocal(gx: number, gy: number, height: number, tw: number, th: number): { x: number; y: number } {
        return {
            x: Math.round((gx - gy) * (tw / 2)),
            y: Math.round((gx + gy) * (th / 2) - height * th * HEIGHT_SCALE),
        };
    }

    private getTerrainIndex(normalized: number, waterVal: number): number {
        if (waterVal > 0.35 || normalized < 0.18) return 1;
        if (normalized < 0.3) return 2;
        if (normalized > 0.95) return 4;
        if (normalized > 0.82) return 3;
        return 0;
    }

    private drawTerrainLive(
        tiles: Array<{ gx: number; gy: number; height: number; terrainIdx: number; depth: number }>,
        tw: number,
        th: number
    ) {
        const ctx = this.ctx;
        const tileset = this.getTileset();
        if (!tileset?.complete) return;
        const atlas = this.getTerrainAtlas(this.currentTheme, tileset, tw, th);
        const overlap = 1;
        for (const tile of tiles) {
            const pos = this.gridToScreen(tile.gx, tile.gy, tile.height);
            const region = atlas.tiles[tile.terrainIdx] || atlas.tiles[0];
            const drawX = Math.round(pos.x - tw / 2) - overlap;
            const drawY = Math.round(pos.y - th / 2) - overlap;
            ctx.drawImage(
                atlas.atlas,
                region.x - overlap, region.y - overlap,
                region.w + overlap * 2, region.h + overlap * 2,
                drawX, drawY,
                tw + overlap * 2, th + overlap * 2
            );
        }
    }

    private hashEntityId(id: number): number {
        return ((id * 2654435761) >>> 0) % 100;
    }

    private getEntitySprite(kind: string, entityId: number = 0): { category: keyof typeof SPRITE_LAYOUT; index: number } {
        const k = (kind || '').toLowerCase();
        const hash = this.hashEntityId(entityId);

        if (k.includes('tree') || k.includes('grove') || k.includes('forest')) return { category: 'vegetation', index: hash % 2 };
        if (k.includes('cycad')) return { category: 'vegetation', index: 1 };
        if (k.includes('bush') || k.includes('shrub')) return { category: 'vegetation', index: 2 };
        if (k.includes('flower') || k.includes('plant')) return { category: 'vegetation', index: 3 };
        if (k.includes('building') || k.includes('habitat') || k.includes('house') || k.includes('cabin')) return { category: 'buildings', index: 0 };
        if (k.includes('tower') || k.includes('castle')) return { category: 'buildings', index: 1 };
        if (k.includes('shop') || k.includes('market')) return { category: 'buildings', index: 2 };
        if (k.includes('animal') || k.includes('beast')) return { category: 'characters', index: 2 };
        if (k.includes('alien') || k.includes('outsider') || k.includes('voidborn')) return { category: 'characters', index: 3 };
        if (k.includes('dino') || k.includes('saurian') || k.includes('raptor')) return { category: 'characters', index: 1 };
        if (k.includes('monster') || k.includes('goblin')) return { category: 'characters', index: 3 };
        if (k.includes('knight') || k.includes('soldier')) return { category: 'characters', index: 1 };
        return { category: 'characters', index: 0 };
    }

    // PROFESSIONAL GAME DEV TECHNIQUE: Pre-render terrain using ACTUAL TILESET SPRITES
    // The tileset contains proper isometric diamond tiles designed to tile seamlessly
    private prerenderTerrain(
        tiles: Array<{ gx: number; gy: number; height: number; terrainIdx: number }>,
        colors: string[],
        tw: number,
        th: number,
        grid_w: number,
        grid_h: number
    ) {
        const tileset = this.getTileset();
        if (!tileset?.complete) return;

        if (tiles.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const localTiles: Array<{ tile: { gx: number; gy: number; height: number; terrainIdx: number }; pos: { x: number; y: number } }> = [];
        for (const tile of tiles) {
            const pos = this.gridToLocal(tile.gx, tile.gy, tile.height, tw, th);
            localTiles.push({ tile, pos });
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }
        const padding = Math.ceil(Math.max(tw, th) * 3);
        const originX = Math.floor(minX - padding);
        const originY = Math.floor(minY - padding);
        const canvasW = Math.ceil(maxX - minX + padding * 2);
        const canvasH = Math.ceil(maxY - minY + padding * 2);

        // Create or resize offscreen canvas
        if (!this.terrainCanvas || this.terrainCanvas.width !== canvasW || this.terrainCanvas.height !== canvasH) {
            this.terrainCanvas = document.createElement('canvas');
            this.terrainCanvas.width = canvasW;
            this.terrainCanvas.height = canvasH;
            const ctx = this.terrainCanvas.getContext('2d', { alpha: true });
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                this.terrainCtx = ctx;
            }
        }

        const ctx = this.terrainCtx;
        if (!ctx) return;

        // Clear offscreen canvas
        ctx.clearRect(0, 0, canvasW, canvasH);
        this.terrainBaseOriginX = originX;
        this.terrainBaseOriginY = originY;
        this.terrainBaseBounds = { minX, minY, maxX, maxY };
        this.terrainBounds = { minX, minY, maxX, maxY };

        // Paint terrain sprite atlas directly into the cached canvas to avoid seams.
        const terrainAtlas = this.getTerrainAtlas(this.currentTheme, tileset, tw, th);
        const overlap = 1;
        for (const entry of localTiles) {
            const { tile, pos } = entry;
            const drawX = Math.round(pos.x - originX - tw / 2) - overlap;
            const drawY = Math.round(pos.y - originY - th / 2) - overlap;
            const region = terrainAtlas.tiles[tile.terrainIdx] || terrainAtlas.tiles[0];
            const sx = Math.max(0, region.x - overlap);
            const sy = Math.max(0, region.y - overlap);
            const sw = region.w + overlap * 2;
            const sh = region.h + overlap * 2;
            const dw = tw + overlap * 2;
            const dh = th + overlap * 2;
            ctx.drawImage(
                terrainAtlas.atlas,
                sx, sy, sw, sh,
                drawX, drawY, dw, dh
            );
        }

        console.log(`[TerrainPrerender] Rendered ${tiles.length} base tiles`);
    }

    render(worldW: number = 96, worldH: number = 96) {
        const ctx = this.ctx;
        const colors = TERRAIN_COLORS[this.currentTheme] || TERRAIN_COLORS.living;
        const tileset = this.getTileset();

        // Fill canvas with a gentle sky gradient to reduce flatness.
        const baseBg = THEME_BG[this.currentTheme] || THEME_BG.living;
        const sky = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        sky.addColorStop(0, this.adjustColor(baseBg, 22));
        sky.addColorStop(0.55, baseBg);
        sky.addColorStop(1, this.adjustColor(baseBg, -18));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.fieldData) {
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for world data...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        if (!tileset?.complete) {
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading tileset...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        const { grid_w, grid_h, terrain, water } = this.fieldData;

        const tw = Math.max(1, Math.round(TILE_W * this.zoom));
        const th = Math.max(1, Math.round(TILE_H * this.zoom));
        const centerX = Math.floor(grid_w / 2);
        const centerY = Math.floor(grid_h / 2);
        this.baseOffsetX = this.canvas.width / 2 - (centerX - centerY) * (tw / 2) + this.offsetX;
        this.baseOffsetY = this.canvas.height / 2 - (centerX + centerY) * (th / 2) + this.offsetY;
        this.baseOffsetY += Math.round(th * grid_h * 0.12);

        // Find terrain range
        let minVal = Infinity, maxVal = -Infinity;
        for (let y = 0; y < grid_h; y++) {
            for (let x = 0; x < grid_w; x++) {
                const v = terrain[y]?.[x] ?? 0;
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
        }
        const range = maxVal - minVal || 1;

        // Pre-compute tiles + heights
        type TileData = { depth: number; terrainIdx: number; height: number; gx: number; gy: number; seed: number; detail: boolean };
        const tiles: TileData[] = [];
        const heights: number[][] = [];
        const heightSteps = 4;
        const center = { x: centerX, y: centerY };

        for (let y = 0; y < grid_h; y++) {
            heights[y] = [];
            for (let x = 0; x < grid_w; x++) {
                const rawVal = terrain[y]?.[x] ?? 0;
                const waterVal = water[y]?.[x] ?? 0;
                const normalized = (rawVal - minVal) / range;
                const height = Math.floor(normalized * heightSteps);
                const terrainIdx = this.getTerrainIndex(normalized, waterVal);
                const depth = x + y + height * 0.01;
                heights[y][x] = height;
                const seed = (x * 73856093 ^ y * 19349663) >>> 0;
                const detail = true;
                tiles.push({ depth, terrainIdx, height, gx: x, gy: y, seed, detail });
            }
        }

        tiles.sort((a, b) => a.depth - b.depth);

        // CENTERING
        {
            const anchor = this.gridToScreen(center.x, center.y, heights[center.y]?.[center.x] ?? 0);
            const adjustX = Math.round(this.canvas.width / 2 - anchor.x);
            const adjustY = Math.round(this.canvas.height * 0.58 - anchor.y);
            this.baseOffsetX += adjustX;
            this.baseOffsetY += adjustY;
        }

        // TERRAIN PASS (live draw for consistent alignment)
        const terrainBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.drawTerrainLive(tiles, tw, th);
        for (const tile of tiles) {
            const pos = this.gridToScreen(tile.gx, tile.gy, tile.height);
            terrainBounds.minX = Math.min(terrainBounds.minX, pos.x - tw / 2);
            terrainBounds.maxX = Math.max(terrainBounds.maxX, pos.x + tw / 2);
            terrainBounds.minY = Math.min(terrainBounds.minY, pos.y - th / 2);
            terrainBounds.maxY = Math.max(terrainBounds.maxY, pos.y + th / 2);
        }

        // Terrain sprite overlay now baked in prerender to avoid seams.

        // Height walls for depth cues
        const wallScale = th * HEIGHT_SCALE;
        ctx.save();
        ctx.globalAlpha = 0.45;
        for (const tile of tiles) {
            const { gx, gy, height, terrainIdx } = tile;
            const pos = this.gridToScreen(gx, gy, height);
            const rightHeight = heights[gy]?.[gx + 1] ?? height;
            const downHeight = heights[gy + 1]?.[gx] ?? height;
            if (height <= rightHeight + 1 && height <= downHeight + 1) continue;

            const baseColor = colors[terrainIdx] || colors[0];
            const shadeRight = this.adjustColor(baseColor, -26);
            const shadeDown = this.adjustColor(baseColor, -38);
            const right = { x: pos.x + tw / 2, y: pos.y };
            const bottom = { x: pos.x, y: pos.y + th / 2 };
            if (height > rightHeight) {
                const drop = (height - rightHeight) * wallScale;
                ctx.fillStyle = shadeRight;
                ctx.beginPath();
                ctx.moveTo(right.x, right.y);
                ctx.lineTo(bottom.x, bottom.y);
                ctx.lineTo(bottom.x, bottom.y + drop);
                ctx.lineTo(right.x, right.y + drop);
                ctx.closePath();
                ctx.fill();
            }
            if (height > downHeight) {
                const drop = (height - downHeight) * wallScale;
                ctx.fillStyle = shadeDown;
                ctx.beginPath();
                ctx.moveTo(bottom.x, bottom.y);
                ctx.lineTo(pos.x - tw / 2, pos.y);
                ctx.lineTo(pos.x - tw / 2, pos.y + drop);
                ctx.lineTo(bottom.x, bottom.y + drop);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();

        // Tile edge outlines for FFT-style readability
        ctx.save();
        ctx.lineWidth = Math.max(1, Math.round(this.zoom));
        ctx.strokeStyle = "rgba(12, 14, 20, 0.28)";
        for (const tile of tiles) {
            const { gx, gy, height } = tile;
            const pos = this.gridToScreen(gx, gy, height);
            const rightHeight = heights[gy]?.[gx + 1] ?? height;
            const downHeight = heights[gy + 1]?.[gx] ?? height;
            const rightTerrain = this.getTerrainIndex(
                ((terrain[gy]?.[gx + 1] ?? 0) - minVal) / range,
                water[gy]?.[gx + 1] ?? 0
            );
            const downTerrain = this.getTerrainIndex(
                ((terrain[gy + 1]?.[gx] ?? 0) - minVal) / range,
                water[gy + 1]?.[gx] ?? 0
            );
            const right = { x: pos.x + tw / 2, y: pos.y };
            const bottom = { x: pos.x, y: pos.y + th / 2 };
            const left = { x: pos.x - tw / 2, y: pos.y };
            if (height > rightHeight || rightTerrain !== tile.terrainIdx) {
                ctx.beginPath();
                ctx.moveTo(right.x, right.y);
                ctx.lineTo(bottom.x, bottom.y);
                ctx.stroke();
            }
            if (height > downHeight || downTerrain !== tile.terrainIdx) {
                ctx.beginPath();
                ctx.moveTo(bottom.x, bottom.y);
                ctx.lineTo(left.x, left.y);
                ctx.stroke();
            }
        }
        ctx.restore();

        // Subtle top-edge highlight for crisp isometric faces
        ctx.save();
        ctx.lineWidth = Math.max(1, Math.round(this.zoom));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        for (const tile of tiles) {
            const pos = this.gridToScreen(tile.gx, tile.gy, tile.height);
            const top = { x: pos.x, y: pos.y - th / 2 };
            const right = { x: pos.x + tw / 2, y: pos.y };
            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(right.x, right.y);
            ctx.stroke();
        }
        ctx.restore();

        // Directional light wash for more depth/clean contrast.
        ctx.save();
        const light = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        light.addColorStop(0, "rgba(255,255,255,0.08)");
        light.addColorStop(0.45, "rgba(255,255,255,0)");
        light.addColorStop(1, "rgba(0,0,0,0.18)");
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();

        const time = performance.now() / 1000;
        // AMBIENT VFX: Subtle water shimmer and fertility glow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let y = 0; y < grid_h; y += 2) {
            for (let x = 0; x < grid_w; x += 2) {
                const waterVal = water[y]?.[x] ?? 0;
                const fertVal = this.fieldData.fertility?.[y]?.[x] ?? 0;
                if (waterVal < 0.4 && fertVal < 0.6) continue;
                const shimmer = 0.5 + 0.5 * Math.sin(time * 2.0 + x * 0.7 + y * 0.3);
                if (shimmer < 0.65) continue;
                const height = Math.floor(((terrain[y]?.[x] ?? 0) - minVal) / range * heightSteps);
                const pos = this.gridToScreen(x, y, height);
                if (waterVal >= 0.4) {
                    ctx.globalAlpha = 0.08 + shimmer * 0.06;
                    ctx.fillStyle = '#9fe7ff';
                } else {
                    ctx.globalAlpha = 0.06 + shimmer * 0.05;
                    ctx.fillStyle = '#b2f2c8';
                }
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 4 * this.zoom, 6 * this.zoom, 2.5 * this.zoom, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // Wind streak VFX disabled to avoid ghost line artifacts in dense scenes.

        // ENTITIES: Properly spaced, depth-sorted, animated
        const entityData: Array<{ depth: number; fn: () => void }> = [];
        this.entityScreenPositions.clear();
        const margin = 220 * this.zoom;
        const terrainEntities: Entity[] = [];
        const objectEntities: Entity[] = [];
        for (const entity of this.entities) {
            const kind = (entity.kind || '').toLowerCase();
            const color = (entity.color || '').toLowerCase();
            const isObject =
                kind.includes('tree') ||
                kind.includes('grove') ||
                kind.includes('forest') ||
                kind.includes('cycad') ||
                kind.includes('bush') ||
                kind.includes('shrub') ||
                kind.includes('flower') ||
                kind.includes('plant') ||
                kind.includes('building') ||
                kind.includes('habitat') ||
                kind.includes('house') ||
                kind.includes('cabin') ||
                kind.includes('tower') ||
                kind.includes('castle') ||
                kind.includes('shop') ||
                kind.includes('market') ||
                color.includes('grove') ||
                color.includes('habitat');
            if (isObject) {
                objectEntities.push(entity);
            } else {
                terrainEntities.push(entity);
            }
        }

        const maxObjects = Math.min(40, Math.round(this.entities.length * 0.18));
        const filteredObjects: Entity[] = [];
        for (const entity of objectEntities) {
            if (filteredObjects.length >= maxObjects) break;
            const hash = this.hashEntityId(entity.id);
            if (hash % 4 === 0) filteredObjects.push(entity);
        }

        const allEntities = terrainEntities.concat(filteredObjects);
        const fauna: Entity[] = [];
        const settlers: Entity[] = [];
        const outsiders: Entity[] = [];
        const otherActors: Entity[] = [];
        for (const entity of terrainEntities) {
            const tag = `${entity.kind || ""} ${entity.color || ""}`.toLowerCase();
            if (tag.includes("fauna") || tag.includes("animal") || tag.includes("beast")) fauna.push(entity);
            else if (tag.includes("settler") || tag.includes("human") || tag.includes("villager") || tag.includes("humanoid")) settlers.push(entity);
            else if (tag.includes("outsider") || tag.includes("alien")) outsiders.push(entity);
            else otherActors.push(entity);
        }

        const renderEntities: Entity[] = [];
        const pickByHash = (list: Entity[], count: number, seed: number) => {
            if (list.length === 0 || count <= 0) return;
            const sorted = list.slice().sort((a, b) => {
                const ha = (this.hashEntityId(a.id + seed) % 1000);
                const hb = (this.hashEntityId(b.id + seed) % 1000);
                return ha - hb;
            });
            for (let i = 0; i < Math.min(count, sorted.length); i++) {
                renderEntities.push(sorted[i]);
            }
        };

        pickByHash(filteredObjects, 24, 13);
        pickByHash(settlers, 40, 3);
        pickByHash(fauna, 40, 5);
        pickByHash(outsiders, 12, 7);
        pickByHash(otherActors, 12, 11);

        const maxRender = 140;
        if (renderEntities.length > maxRender) {
            renderEntities.length = maxRender;
        }

        const actorCellCounts = new Map<string, number>();
        const objectCellCounts = new Map<string, number>();
        const maxActorsPerCell = 5;
        const maxObjectsPerCell = 3;
        for (let i = 0; i < renderEntities.length; i++) {
            const entity = renderEntities[i];
            // Spread entities across the map
            const gx = (entity.x / worldW) * grid_w;
            const gy = (entity.y / worldH) * grid_h;

            const tx = Math.floor(Math.min(grid_w - 1, Math.max(0, gx)));
            const ty = Math.floor(Math.min(grid_h - 1, Math.max(0, gy)));
            const rawVal = terrain[ty]?.[tx] ?? 0;
            const normalized = (rawVal - minVal) / range;
            const terrainHeight = Math.floor(normalized * heightSteps);
            const { category, index } = this.getEntitySprite(entity.kind || 'villager', entity.id);
            const cellKey = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
            if (category === 'vegetation' || category === 'buildings') {
                const count = objectCellCounts.get(cellKey) || 0;
                if (count >= maxObjectsPerCell) {
                    continue;
                }
                objectCellCounts.set(cellKey, count + 1);
            } else {
                const count = actorCellCounts.get(cellKey) || 0;
                if (count >= maxActorsPerCell) {
                    continue;
                }
                actorCellCounts.set(cellKey, count + 1);
            }
            const sprite = this.getSpriteRegion(category, index, tileset);
            const pos = this.gridToScreen(gx, gy, terrainHeight);
            const depth = gx + gy + terrainHeight * 0.01 + 0.5;
            if (
                pos.x < -margin ||
                pos.x > this.canvas.width + margin ||
                pos.y < -margin ||
                pos.y > this.canvas.height + margin
            ) {
                continue;
            }
            if (
                pos.x < terrainBounds.minX - margin ||
                pos.x > terrainBounds.maxX + margin ||
                pos.y < terrainBounds.minY - margin ||
                pos.y > terrainBounds.maxY + margin
            ) {
                continue;
            }

            const isStaticCategory = category === 'vegetation' || category === 'buildings';
            if (isStaticCategory && this.entities.length > 200) {
                const density = Math.min(1, (this.entities.length - 160) / 280);
                const keepChance = 0.55 - density * 0.25;
                if (this.hashEntityId(entity.id) / 100 > keepChance) {
                    continue;
                }
            }

            // Scale entities to avoid tile crowding while keeping silhouettes readable
            let scale = (tw / sprite.w) * 1.32;
            if (category === 'vegetation') scale *= 1.7;
            if (category === 'buildings') scale *= 2.0;
            if (category === 'characters') scale *= 1.55;

            entityData.push({
                depth,
                fn: () => {
                    const speed = Math.hypot(entity.vx, entity.vy);
                    const moving = speed > 0.04;
                    const phase = time * (moving ? 8.0 : 2.0) + entity.id * 0.7;
                    const bob = Math.round(Math.sin(phase) * (moving ? 3.6 : 1.8) * this.zoom);
                    const sway = Math.round(Math.cos(phase) * (moving ? 2.8 : 1.3) * this.zoom);
                    const step = moving ? (Math.sin(phase * 0.9) > 0 ? 1 : -1) : 0;
                    const facing = entity.vx + entity.vy;
                    const flip = facing < 0 ? -1 : 1;
                    const shadowBoost = category === "buildings" ? 1.25 : category === "vegetation" ? 1.12 : 1.0;
                    const shadowW = Math.max(5, sprite.w * scale * 0.28 * shadowBoost);
                    const shadowH = Math.max(3, sprite.h * scale * 0.07 * shadowBoost);

                    const destW = Math.round(sprite.w * scale);
                    const destH = Math.round(sprite.h * scale);
                    this.entityScreenPositions.set(entity.id, { x: pos.x, y: pos.y - destH + 2 * this.zoom });

                    ctx.save();
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = "#000";
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y + 6 * this.zoom, shadowW, shadowH, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // Contact occlusion to ground the sprite on the tile
                    ctx.save();
                    ctx.globalAlpha = 0.18;
                    ctx.fillStyle = "#000";
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y + 2 * this.zoom);
                    ctx.lineTo(pos.x + tw * 0.2, pos.y + th * 0.12);
                    ctx.lineTo(pos.x, pos.y + th * 0.22);
                    ctx.lineTo(pos.x - tw * 0.2, pos.y + th * 0.12);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();

                    ctx.save();
                    const spriteX = Math.round(pos.x + step * this.zoom);
                    const spriteY = Math.round(pos.y - destH + 2 * this.zoom + bob);
                    ctx.translate(spriteX, spriteY);
                    ctx.scale(flip, 1);
                    if (category === 'buildings') {
                        const glow = 0.92 + 0.08 * Math.sin(phase * 1.1);
                        ctx.globalAlpha = glow;
                    }
                    const drawX = Math.round(-destW / 2 + sway * 0.3);
                    const drawY = Math.round(0);
                    const outlined = this.getOutlinedSprite(tileset, sprite, destW, destH);
                    if (category === 'characters') {
                        ctx.drawImage(outlined, drawX - 1, drawY - 1, destW + 2, destH + 2);
                    } else {
                        const outlineAlpha = category === "buildings" ? 0.55 : 0.45;
                        ctx.save();
                        ctx.globalAlpha = outlineAlpha;
                        ctx.drawImage(outlined, drawX - 1, drawY - 1, destW + 2, destH + 2);
                        ctx.restore();
                        ctx.drawImage(
                            tileset,
                            sprite.x, sprite.y, sprite.w, sprite.h,
                            drawX,
                            drawY,
                            destW, destH
                        );
                    }
                    ctx.restore();
                }
            });
        }

        entityData.sort((a, b) => a.depth - b.depth);
        for (const e of entityData) e.fn();

        // Badge
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = 'bold 12px sans-serif';
        const txt = `🎨 ${this.currentTheme.toUpperCase()}`;
        const badgeW = ctx.measureText(txt).width + 14;
        ctx.beginPath();
        ctx.roundRect(this.canvas.width - badgeW - 8, 4, badgeW, 22, 4);
        ctx.fill();
        ctx.fillStyle = '#4CAF50';
        ctx.textAlign = 'right';
        ctx.fillText(txt, this.canvas.width - 14, 19);
    }
}
