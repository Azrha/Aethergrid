class_name WorldState
extends Node

signal fields_updated
signal frame_updated

var fields: Dictionary = {}
var frame: Dictionary = {}

var grid_w := 0
var grid_h := 0
var world_w := 0
var world_h := 0
var step := 1

var heights: Array = []
var terrain_idx: Array = []
var min_val := 0.0
var max_val := 1.0

func update_fields(payload: Dictionary) -> void:
	fields = payload
	grid_w = int(payload.get("grid_w", 0))
	grid_h = int(payload.get("grid_h", 0))
	world_w = int(payload.get("w", grid_w))
	world_h = int(payload.get("h", grid_h))
	step = int(payload.get("step", 1))
	var terrain = payload.get("terrain", [])
	var water = payload.get("water", [])

	min_val = INF
	max_val = -INF
	for y in range(grid_h):
		var row = terrain[y] if y < terrain.size() else []
		for x in range(grid_w):
			var v = 0.0
			if x < row.size():
				v = float(row[x])
			min_val = min(min_val, v)
			max_val = max(max_val, v)
	if min_val == INF:
		min_val = 0.0
		max_val = 1.0
	var range_val := max(max_val - min_val, 0.0001)

	heights = []
	terrain_idx = []
	for y in range(grid_h):
		var h_row: Array = []
		var t_row: Array = []
		var terrain_row = terrain[y] if y < terrain.size() else []
		var water_row = water[y] if y < water.size() else []
		for x in range(grid_w):
			var raw := 0.0
			var water_val := 0.0
			if x < terrain_row.size():
				raw = float(terrain_row[x])
			if x < water_row.size():
				water_val = float(water_row[x])
			var normalized := (raw - min_val) / range_val
			var height := int(floor(normalized * SpriteLayout.HEIGHT_STEPS))
			h_row.append(height)
			t_row.append(_terrain_index(normalized, water_val))
		heights.append(h_row)
		terrain_idx.append(t_row)

	emit_signal("fields_updated")

func update_frame(payload: Dictionary) -> void:
	frame = payload
	emit_signal("frame_updated")

func get_height(gx: int, gy: int) -> int:
	if gy < 0 or gy >= heights.size():
		return 0
	var row = heights[gy]
	if gx < 0 or gx >= row.size():
		return 0
	return int(row[gx])

func get_terrain_idx(gx: int, gy: int) -> int:
	if gy < 0 or gy >= terrain_idx.size():
		return 0
	var row = terrain_idx[gy]
	if gx < 0 or gx >= row.size():
		return 0
	return int(row[gx])

func grid_to_world(gx: float, gy: float, height: float) -> Vector3:
	var half_w = SpriteLayout.TILE_W * SpriteLayout.PIXEL_SIZE * 0.5
	var half_h = SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * 0.5
	var world_x = (gx - gy) * half_w
	var world_z = (gx + gy) * half_h
	var world_y = height * SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * SpriteLayout.HEIGHT_SCALE
	return Vector3(world_x, world_y, world_z)

func _terrain_index(normalized: float, water_val: float) -> int:
	if water_val > 0.35 or normalized < 0.18:
		return 1
	if normalized < 0.3:
		return 2
	if normalized > 0.95:
		return 4
	if normalized > 0.82:
		return 3
	return 0
