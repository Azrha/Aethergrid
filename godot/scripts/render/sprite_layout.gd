class_name SpriteLayout
extends Node

const TILE_W := 48.0
const TILE_H := 24.0
const HEIGHT_SCALE := 0.3
const HEIGHT_STEPS := 4
const PIXEL_SIZE := 0.01

const SPRITE_LAYOUT := {
	"terrain": [
		Rect2(10, 10, 185, 130),
		Rect2(215, 10, 185, 130),
		Rect2(420, 10, 185, 130),
		Rect2(625, 10, 185, 130),
		Rect2(830, 10, 185, 130),
	],
	"vegetation": [
		Rect2(0, 160, 256, 290),
		Rect2(256, 160, 256, 290),
		Rect2(512, 160, 256, 290),
		Rect2(768, 160, 256, 290),
	],
	"buildings": [
		Rect2(0, 450, 341, 300),
		Rect2(341, 450, 341, 300),
		Rect2(682, 450, 342, 300),
	],
	"characters": [
		Rect2(0, 750, 256, 274),
		Rect2(256, 750, 256, 274),
		Rect2(512, 750, 256, 274),
		Rect2(768, 750, 256, 274),
	],
}

const THEME_TILESETS := {
	"living": "res://assets/tileset.png",
	"fantasy": "res://assets/tileset_fantasy.png",
	"dino": "res://assets/tileset_dino.png",
	"space": "res://assets/tileset_space.png",
	"oceanic": "res://assets/tileset_oceanic.png",
	"frostbound": "res://assets/tileset_frostbound.png",
	"emberfall": "res://assets/tileset_emberfall.png",
	"neon": "res://assets/tileset_neon.png",
	"skyborne": "res://assets/tileset_skyborne.png",
	"ironwild": "res://assets/tileset_ironwild.png",
}

const TERRAIN_COLORS := {
	"living": ["#4a9a4a", "#4090b0", "#d0b080", "#808080", "#e0f0f8"],
	"fantasy": ["#9060b0", "#6040a0", "#e090c0", "#606080", "#d0e0f0"],
	"oceanic": ["#409080", "#306080", "#60b0a0", "#506070", "#a0d8e0"],
	"frostbound": ["#b0d0e0", "#7098c0", "#c0d0b0", "#708090", "#f0f8ff"],
	"emberfall": ["#705040", "#a02818", "#604030", "#403030", "#b05030"],
	"dino": ["#609050", "#506040", "#807858", "#404040", "#70a070"],
	"space": ["#405070", "#203050", "#705090", "#505060", "#607090"],
	"neon": ["#ff00ff", "#00ffff", "#ffff00", "#8080a0", "#e0f0ff"],
	"skyborne": ["#f0e8ff", "#a0d0ff", "#f8f0e0", "#b0b8c0", "#f8ffff"],
	"ironwild": ["#8a7060", "#404850", "#605040", "#706050", "#c0c8d0"],
}

static func get_tileset_path(theme: String) -> String:
	var key := _normalize_theme(theme)
	return THEME_TILESETS.get(key, THEME_TILESETS["living"])

static func get_terrain_colors(theme: String) -> Array:
	var key := _normalize_theme(theme)
	return TERRAIN_COLORS.get(key, TERRAIN_COLORS["living"])

static func get_region(category: String, index: int) -> Rect2:
	var list = SPRITE_LAYOUT.get(category, SPRITE_LAYOUT["terrain"])
	return list[index % list.size()]

static func get_entity_sprite(kind: String, entity_id: int = 0) -> Dictionary:
	var k := (kind if kind != null else "").to_lower()
	var hash := int(((entity_id * 2654435761) & 0xffffffff) % 100)

	if k.find("tree") != -1 or k.find("grove") != -1 or k.find("forest") != -1:
		return {"category": "vegetation", "index": hash % 2}
	if k.find("cycad") != -1:
		return {"category": "vegetation", "index": 1}
	if k.find("bush") != -1 or k.find("shrub") != -1:
		return {"category": "vegetation", "index": 2}
	if k.find("flower") != -1 or k.find("plant") != -1:
		return {"category": "vegetation", "index": 3}
	if k.find("building") != -1 or k.find("habitat") != -1 or k.find("house") != -1 or k.find("cabin") != -1:
		return {"category": "buildings", "index": 0}
	if k.find("tower") != -1 or k.find("castle") != -1:
		return {"category": "buildings", "index": 1}
	if k.find("shop") != -1 or k.find("market") != -1:
		return {"category": "buildings", "index": 2}
	if k.find("animal") != -1 or k.find("beast") != -1:
		return {"category": "characters", "index": 2}
	if k.find("alien") != -1 or k.find("outsider") != -1 or k.find("voidborn") != -1:
		return {"category": "characters", "index": 3}
	if k.find("dino") != -1 or k.find("saurian") != -1 or k.find("raptor") != -1:
		return {"category": "characters", "index": 1}
	if k.find("monster") != -1 or k.find("goblin") != -1:
		return {"category": "characters", "index": 3}
	if k.find("knight") != -1 or k.find("soldier") != -1:
		return {"category": "characters", "index": 1}
	return {"category": "characters", "index": 0}

static func adjust_color(hex_color: String, amount: int) -> Color:
	var value := hex_color.strip_edges().lstrip("#")
	if value.length() != 6:
		return Color.WHITE
	var num := int("0x" + value)
	var r := clamp(((num >> 16) & 0xff) + amount, 0, 255)
	var g := clamp(((num >> 8) & 0xff) + amount, 0, 255)
	var b := clamp((num & 0xff) + amount, 0, 255)
	return Color(r / 255.0, g / 255.0, b / 255.0, 1.0)

static func _normalize_theme(theme: String) -> String:
	var key := (theme if theme != null else "living").to_lower().strip_edges()
	key = key.replace(" ", "_")
	if THEME_TILESETS.has(key):
		return key
	return "living"
