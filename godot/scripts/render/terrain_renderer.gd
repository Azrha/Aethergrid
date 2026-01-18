class_name TerrainRenderer
extends Node3D

const CHUNK_SIZE := 16

var current_theme := "living"
var tileset_texture: Texture2D
var chunks := {}

func set_theme(theme: String) -> void:
	current_theme = theme
	tileset_texture = load(SpriteLayout.get_tileset_path(theme))
	for chunk in chunks.values():
		for child in chunk.get_children():
			if child is Sprite3D:
				child.texture = tileset_texture

func clear() -> void:
	for chunk in chunks.values():
		chunk.queue_free()
	chunks.clear()

func build_from_state(state: WorldState) -> void:
	clear()
	if state.grid_w == 0 or state.grid_h == 0:
		return
	if tileset_texture == null:
		set_theme(current_theme)

	for y in range(state.grid_h):
		for x in range(state.grid_w):
			var chunk_key := Vector2i(x / CHUNK_SIZE, y / CHUNK_SIZE)
			var chunk := _get_chunk(chunk_key)
			var terrain_idx := state.get_terrain_idx(x, y)
			var region := SpriteLayout.get_region("terrain", terrain_idx)
			var tile := Sprite3D.new()
			_configure_tile(tile, region)
			var height := state.get_height(x, y)
			tile.position = state.grid_to_world(float(x), float(y), float(height))
			chunk.add_child(tile)

func _get_chunk(key: Vector2i) -> Node3D:
	if chunks.has(key):
		return chunks[key]
	var node := Node3D.new()
	node.name = "Chunk_%d_%d" % [key.x, key.y]
	add_child(node)
	chunks[key] = node
	return node

func _configure_tile(tile: Sprite3D, region: Rect2) -> void:
	tile.texture = tileset_texture
	tile.region_enabled = true
	tile.region_rect = region
	tile.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	tile.pixel_size = SpriteLayout.PIXEL_SIZE
	tile.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	tile.centered = true
	tile.rotation_degrees = Vector3(-90.0, 0.0, 0.0)
	var scale_x := SpriteLayout.TILE_W / region.size.x
	var scale_y := SpriteLayout.TILE_H / region.size.y
	tile.scale = Vector3(scale_x, scale_y, 1.0)
