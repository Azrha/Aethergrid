class_name EntityRenderer
extends Node3D

var current_theme := "living"
var tileset_texture: Texture2D
var entity_nodes := {}
var max_entities := 180

func set_theme(theme: String) -> void:
	current_theme = theme
	tileset_texture = load(SpriteLayout.get_tileset_path(theme))
	for node in entity_nodes.values():
		if node is Sprite3D:
			node.texture = tileset_texture

func clear() -> void:
	for node in entity_nodes.values():
		if is_instance_valid(node):
			node.queue_free()
	entity_nodes.clear()

func update_from_frame(frame: Dictionary, state: WorldState) -> void:
	if frame.is_empty() or state.grid_w == 0 or state.grid_h == 0:
		return
	if tileset_texture == null:
		set_theme(current_theme)

	var entities = frame.get("entities", [])
	if typeof(entities) != TYPE_ARRAY:
		return

	var world_w := float(frame.get("w", state.world_w))
	var world_h := float(frame.get("h", state.world_h))
	var grid_w := float(state.grid_w)
	var grid_h := float(state.grid_h)

	var keep := {}
	var count := 0
	for entry in entities:
		if count >= max_entities:
			break
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var entity_id := int(entry.get("id", -1))
		if entity_id < 0:
			continue
		keep[entity_id] = true
		var node: Sprite3D
		if entity_nodes.has(entity_id):
			node = entity_nodes[entity_id]
		else:
			node = _create_entity_sprite()
			entity_nodes[entity_id] = node

		var kind := str(entry.get("kind", ""))
		var sprite_info := SpriteLayout.get_entity_sprite(kind, entity_id)
		var category := sprite_info.get("category", "characters")
		var index := int(sprite_info.get("index", 0))
		var region := SpriteLayout.get_region(category, index)
		_apply_sprite_region(node, region, category)

		var gx := 0.0
		var gy := 0.0
		if world_w > 0.0 and world_h > 0.0:
			gx = (float(entry.get("x", 0.0)) / world_w) * grid_w
			gy = (float(entry.get("y", 0.0)) / world_h) * grid_h
		var ix := clamp(int(floor(gx)), 0, state.grid_w - 1)
		var iy := clamp(int(floor(gy)), 0, state.grid_h - 1)
		var base_height := float(state.get_height(ix, iy))
		var z_val := float(entry.get("z", 0.0))
		var height := base_height + z_val
		var pos := state.grid_to_world(gx, gy, height)
		pos.y += SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * 0.65
		pos.y += (gx + gy) * 0.0001
		node.position = pos
		count += 1

	for id_key in entity_nodes.keys():
		if not keep.has(id_key):
			var old_node = entity_nodes[id_key]
			if is_instance_valid(old_node):
				old_node.queue_free()
			entity_nodes.erase(id_key)

func _create_entity_sprite() -> Sprite3D:
	var sprite := Sprite3D.new()
	sprite.texture = tileset_texture
	sprite.region_enabled = true
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.pixel_size = SpriteLayout.PIXEL_SIZE
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.centered = true
	add_child(sprite)
	return sprite

func _apply_sprite_region(sprite: Sprite3D, region: Rect2, category: String) -> void:
	sprite.region_rect = region
	var scale := (SpriteLayout.TILE_W / region.size.x) * 1.32
	if category == "vegetation":
		scale *= 1.7
	elif category == "buildings":
		scale *= 2.0
	elif category == "characters":
		scale *= 1.55
	sprite.scale = Vector3(scale, scale, 1.0)
