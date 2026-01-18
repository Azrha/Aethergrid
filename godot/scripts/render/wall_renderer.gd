class_name WallRenderer
extends Node3D

var current_theme := "living"
var material_cache := {}

func set_theme(theme: String) -> void:
	current_theme = theme
	material_cache.clear()

func clear() -> void:
	for child in get_children():
		child.queue_free()

func build_from_state(state: WorldState) -> void:
	clear()
	if state.grid_w == 0 or state.grid_h == 0:
		return

	var colors: Array = SpriteLayout.get_terrain_colors(current_theme)
	var half_w = SpriteLayout.TILE_W * SpriteLayout.PIXEL_SIZE * 0.5
	var half_h = SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * 0.5
	var edge_len = sqrt(half_w * half_w + half_h * half_h)
	var wall_step = SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * SpriteLayout.HEIGHT_SCALE

	for y in range(state.grid_h):
		for x in range(state.grid_w):
			var height := state.get_height(x, y)
			var terrain_idx := state.get_terrain_idx(x, y)
			var base_color := colors[terrain_idx % colors.size()]

			if x + 1 < state.grid_w:
				var right_height := state.get_height(x + 1, y)
				if height > right_height:
					var drop := float(height - right_height) * wall_step
					var pos := state.grid_to_world(float(x), float(y), float(height))
					var neighbor := state.grid_to_world(float(x + 1), float(y), float(right_height))
					var normal := (neighbor - pos)
					normal.y = 0.0
					normal = normal.normalized()
					var center := Vector3((pos.x + neighbor.x) * 0.5, pos.y - drop * 0.5, (pos.z + neighbor.z) * 0.5)
					center += normal * 0.001
					_add_wall(center, normal, edge_len, drop, SpriteLayout.adjust_color(base_color, -26))

			if y + 1 < state.grid_h:
				var down_height := state.get_height(x, y + 1)
				if height > down_height:
					var drop_down := float(height - down_height) * wall_step
					var pos_down := state.grid_to_world(float(x), float(y), float(height))
					var neighbor_down := state.grid_to_world(float(x), float(y + 1), float(down_height))
					var normal_down := (neighbor_down - pos_down)
					normal_down.y = 0.0
					normal_down = normal_down.normalized()
					var center_down := Vector3((pos_down.x + neighbor_down.x) * 0.5, pos_down.y - drop_down * 0.5, (pos_down.z + neighbor_down.z) * 0.5)
					center_down += normal_down * 0.001
					_add_wall(center_down, normal_down, edge_len, drop_down, SpriteLayout.adjust_color(base_color, -38))

func _add_wall(center: Vector3, normal: Vector3, width: float, height: float, color: Color) -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(width, height)
	var wall := MeshInstance3D.new()
	wall.mesh = quad
	wall.material_override = _get_material(color)
	var basis := Basis().looking_at(-normal, Vector3.UP)
	wall.basis = basis
	wall.position = center
	add_child(wall)

func _get_material(color: Color) -> StandardMaterial3D:
	var key := "%s" % color.to_html(false)
	if material_cache.has(key):
		return material_cache[key]
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	material_cache[key] = mat
	return mat
