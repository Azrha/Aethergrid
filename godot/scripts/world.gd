extends Node3D

# Fresh, local-only Godot prototype (no backend).
# Purpose: prove a clean isometric pixel-art diorama first, then reintroduce features.

const TILESET_PATH := "res://assets/tileset.png"

const MAP_W := 12
const MAP_H := 12
const HEIGHT_STEPS := 4
const HEIGHT_SCALE := 0.3

const TERRAIN_LAYOUT := [
	Rect2(10, 10, 185, 130),
	Rect2(215, 10, 185, 130),
	Rect2(420, 10, 185, 130),
	Rect2(625, 10, 185, 130),
	Rect2(830, 10, 185, 130),
]

const VEGETATION_LAYOUT := [
	Rect2(0, 160, 256, 290),
	Rect2(256, 160, 256, 290),
	Rect2(512, 160, 256, 290),
	Rect2(768, 160, 256, 290),
]

const BUILDING_LAYOUT := [
	Rect2(0, 450, 341, 300),
	Rect2(341, 450, 341, 300),
	Rect2(682, 450, 342, 300),
]

const CHARACTER_LAYOUT := [
	Rect2(0, 750, 256, 274),
	Rect2(256, 750, 256, 274),
	Rect2(512, 750, 256, 274),
	Rect2(768, 750, 256, 274),
]

@onready var ground_root: Node3D = $World/Ground
@onready var entity_root: Node3D = $World/Entities
@onready var camera: Camera3D = $Camera

var tileset_texture: Texture2D
var tile_pixel_size := 0.006

var terrain_map := []
var entities := []

func _ready() -> void:
	tileset_texture = load(TILESET_PATH)
	_build_world_data()
	_build_terrain()
	_spawn_entities()
	_update_camera()
	_start_motion()

func _build_world_data() -> void:
	terrain_map.clear()
	for y in range(MAP_H):
		var row := []
		for x in range(MAP_W):
			var height = 0
			if (x > 3 and x < 8 and y > 3 and y < 8):
				height = 1
			if (x == 6 and y == 6):
				height = 2
			row.append(height)
		terrain_map.append(row)

	entities = [
		{"kind": "villager", "x": 4.0, "y": 4.0, "sprite": CHARACTER_LAYOUT[0]},
		{"kind": "villager", "x": 7.0, "y": 7.0, "sprite": CHARACTER_LAYOUT[1]},
		{"kind": "habitat", "x": 3.0, "y": 8.0, "sprite": BUILDING_LAYOUT[0]},
		{"kind": "grove", "x": 8.0, "y": 3.0, "sprite": VEGETATION_LAYOUT[0]},
		{"kind": "fauna", "x": 9.0, "y": 6.0, "sprite": CHARACTER_LAYOUT[2]},
	]

func _build_terrain() -> void:
	for child in ground_root.get_children():
		child.queue_free()
	if tileset_texture == null:
		return

	var tile_rect = TERRAIN_LAYOUT[0]
	tile_pixel_size = 1.0 / float(tile_rect.size.x)

	var offset_x = (float(MAP_W) - 1.0) * 0.5
	var offset_z = (float(MAP_H) - 1.0) * 0.5

	for y in range(MAP_H):
		for x in range(MAP_W):
			var height = int(terrain_map[y][x])
			var terrain_idx = 0
			if height >= 2:
				terrain_idx = 3
			elif height == 1:
				terrain_idx = 2
			var tile = Sprite3D.new()
			tile.texture = tileset_texture
			tile.region_enabled = true
			tile.region_rect = TERRAIN_LAYOUT[terrain_idx]
			tile.billboard = BaseMaterial3D.BILLBOARD_DISABLED
			tile.pixel_size = tile_pixel_size
			tile.rotation_degrees = Vector3(-90, 0, 0)
			tile.position = Vector3(float(x) - offset_x, float(height) * HEIGHT_SCALE, float(y) - offset_z)
			ground_root.add_child(tile)

func _spawn_entities() -> void:
	for child in entity_root.get_children():
		child.queue_free()
	if tileset_texture == null:
		return
	var offset_x = (float(MAP_W) - 1.0) * 0.5
	var offset_z = (float(MAP_H) - 1.0) * 0.5

	for entry in entities:
		var sprite = Sprite3D.new()
		sprite.texture = tileset_texture
		sprite.region_enabled = true
		sprite.region_rect = entry["sprite"]
		sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		sprite.pixel_size = tile_pixel_size
		sprite.position = Vector3(entry["x"] - offset_x, _terrain_height(entry["x"], entry["y"]) + 0.25, entry["y"] - offset_z)
		entity_root.add_child(sprite)
		entry["node"] = sprite

func _start_motion() -> void:
	var timer = Timer.new()
	timer.wait_time = 0.35
	timer.autostart = true
	timer.timeout.connect(_tick_agents)
	add_child(timer)

func _tick_agents() -> void:
	for entry in entities:
		if entry["kind"] != "villager":
			continue
		var dx = randf_range(-0.5, 0.5)
		var dy = randf_range(-0.5, 0.5)
		entry["x"] = clamp(entry["x"] + dx, 1.0, float(MAP_W - 2))
		entry["y"] = clamp(entry["y"] + dy, 1.0, float(MAP_H - 2))
		var node: Sprite3D = entry["node"]
		var offset_x = (float(MAP_W) - 1.0) * 0.5
		var offset_z = (float(MAP_H) - 1.0) * 0.5
		node.position = Vector3(entry["x"] - offset_x, _terrain_height(entry["x"], entry["y"]) + 0.25, entry["y"] - offset_z)

func _terrain_height(x: float, y: float) -> float:
	var ix = clamp(int(round(x)), 0, MAP_W - 1)
	var iy = clamp(int(round(y)), 0, MAP_H - 1)
	var height = int(terrain_map[iy][ix])
	return float(height) * HEIGHT_SCALE

func _update_camera() -> void:
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.rotation_degrees = Vector3(-35.264, 45, 0)
	camera.size = 12.0
	camera.position = Vector3(0, 10, 10)
	camera.look_at(Vector3(0, 0, 0), Vector3.UP)
