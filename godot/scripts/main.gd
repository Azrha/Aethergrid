extends Node3D

@export var base_url := "http://127.0.0.1:8000"

@onready var terrain_renderer: TerrainRenderer = $WorldRoot/Terrain
@onready var wall_renderer: WallRenderer = $WorldRoot/Walls
@onready var entity_renderer: EntityRenderer = $WorldRoot/Entities

@onready var camera_rig: Node3D = $CameraRig
@onready var camera: Camera3D = $CameraRig/Pivot/Camera3D

@onready var preset_dropdown: OptionButton = $UI/Panel/Scroll/VBox/PresetsRow/PresetDropdown
@onready var preset_desc: Label = $UI/Panel/Scroll/VBox/PresetDesc
@onready var seed_spin: SpinBox = $UI/Panel/Scroll/VBox/SeedRow/SeedSpin
@onready var n_spin: SpinBox = $UI/Panel/Scroll/VBox/NRow/NSpin
@onready var backend_option: OptionButton = $UI/Panel/Scroll/VBox/BackendRow/BackendOption
@onready var apply_button: Button = $UI/Panel/Scroll/VBox/ApplyRow/ApplyButton
@onready var run_button: Button = $UI/Panel/Scroll/VBox/RunRow/RunButton
@onready var tick_spin: SpinBox = $UI/Panel/Scroll/VBox/RunRow/TickSpin
@onready var steps_spin: SpinBox = $UI/Panel/Scroll/VBox/RunRow/StepsSpin
@onready var mood_label: Label = $UI/Panel/Scroll/VBox/ThemeRow/MoodLabel
@onready var theme_dropdown: OptionButton = $UI/Panel/Scroll/VBox/ThemeRow/ThemeDropdown
@onready var ollama_status_button: Button = $UI/Panel/Scroll/VBox/OllamaRow/OllamaStatusButton
@onready var ollama_generate_button: Button = $UI/Panel/Scroll/VBox/OllamaRow/OllamaGenerateButton
@onready var thoughts_box: RichTextLabel = $UI/Panel/Scroll/VBox/ThoughtsBox
@onready var debug_label: Label = $UI/Panel/Scroll/VBox/DebugLabel

var api_client: Node
var ws_stream: Node
var world_state: WorldState

var presets: Array = []
var current_preset: Dictionary = {}
var current_theme := "living"

var frame_timer: Timer
var dragging := false
var last_mouse := Vector2.ZERO

const THEMES := [
	"living",
	"fantasy",
	"dino",
	"space",
	"oceanic",
	"frostbound",
	"emberfall",
	"neon",
	"skyborne",
	"ironwild",
]

func _ready() -> void:
	world_state = WorldState.new()
	add_child(world_state)

	api_client = load("res://scripts/net/api_client.gd").new()
	api_client.base_url = base_url
	api_client.get_completed.connect(_on_get_completed)
	api_client.post_completed.connect(_on_post_completed)
	api_client.request_failed.connect(_on_request_failed)
	add_child(api_client)

	ws_stream = load("res://scripts/net/ws_stream.gd").new()
	ws_stream.fields_received.connect(_on_fields_received)
	ws_stream.frame_received.connect(_on_frame_received)
	ws_stream.connected.connect(_on_ws_connected)
	ws_stream.disconnected.connect(_on_ws_disconnected)
	ws_stream.error.connect(_on_ws_error)
	add_child(ws_stream)

	_setup_camera()
	_setup_ui()
	_connect_ws()
	_load_presets()

	frame_timer = Timer.new()
	frame_timer.wait_time = 0.2
	frame_timer.timeout.connect(_poll_frame)
	add_child(frame_timer)
	frame_timer.start()

func _process(_delta: float) -> void:
	_update_debug()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_WHEEL_UP and mouse_event.pressed:
			camera.size = max(2.0, camera.size - 0.7)
		elif mouse_event.button_index == MOUSE_BUTTON_WHEEL_DOWN and mouse_event.pressed:
			camera.size = min(50.0, camera.size + 0.7)
		elif mouse_event.button_index == MOUSE_BUTTON_MIDDLE:
			dragging = mouse_event.pressed
			last_mouse = mouse_event.position
	elif event is InputEventMouseMotion and dragging:
		var motion := event as InputEventMouseMotion
		var delta := motion.position - last_mouse
		last_mouse = motion.position
		var pan_speed := SpriteLayout.TILE_H * SpriteLayout.PIXEL_SIZE * 0.35
		camera_rig.position.x -= delta.x * pan_speed * 0.02
		camera_rig.position.z -= delta.y * pan_speed * 0.02

func _setup_camera() -> void:
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.rotation_degrees = Vector3(-35.264, 45.0, 0.0)
	camera.size = 12.0
	camera.position = Vector3(0.0, 10.0, 10.0)
	camera.look_at(Vector3.ZERO, Vector3.UP)

func _setup_ui() -> void:
	preset_dropdown.item_selected.connect(_on_preset_selected)
	apply_button.pressed.connect(_on_apply_pressed)
	run_button.toggled.connect(_on_run_toggled)
	theme_dropdown.item_selected.connect(_on_theme_selected)
	ollama_status_button.pressed.connect(_on_ollama_status)
	ollama_generate_button.pressed.connect(_on_ollama_generate)

	backend_option.clear()
	backend_option.add_item("cpu")
	backend_option.add_item("gpu")

	theme_dropdown.clear()
	for theme in THEMES:
		theme_dropdown.add_item(theme)
	_set_theme("living")

	seed_spin.min_value = 0
	seed_spin.max_value = 1000000
	n_spin.min_value = 10
	n_spin.max_value = 10000
	n_spin.value = 200
	tick_spin.min_value = 10
	tick_spin.max_value = 200
	tick_spin.value = 33
	steps_spin.min_value = 1
	steps_spin.max_value = 8
	steps_spin.value = 1

	run_button.toggle_mode = true

func _connect_ws() -> void:
	var ws_url := base_url.replace("http://", "ws://").replace("https://", "wss://")
	ws_stream.connect_to_url(ws_url.rstrip("/") + "/ws/stream")

func _load_presets() -> void:
	api_client.get_json("/api/presets")

func _poll_frame() -> void:
	if not ws_stream.active:
		api_client.get_json("/api/frame")

func _on_get_completed(path: String, data: Dictionary) -> void:
	if path == "/api/presets":
		_handle_presets(data)
	elif path.begins_with("/api/preset/"):
		_handle_preset(data)
	elif path == "/api/frame":
		if not data.is_empty():
			_on_frame_received(data)
	elif path == "/api/fields":
		if not data.is_empty():
			_on_fields_received(data)
	elif path == "/api/ollama/status":
		_show_ollama_status(data)
	elif path == "/api/ollama/thoughts":
		_show_thoughts(data)

func _on_post_completed(path: String, data: Dictionary) -> void:
	if path == "/api/apply":
		if data.has("fields"):
			_on_fields_received(data["fields"])
		if data.has("frame"):
			_on_frame_received(data["frame"])
	elif path == "/api/run":
		pass
	elif path == "/api/ollama/generate":
		_show_thoughts(data)

func _on_request_failed(path: String, code: int, message: String) -> void:
	thoughts_box.text = "Request failed (%s): %s" % [path, message]
	if path == "/api/frame":
		return

func _handle_presets(data: Dictionary) -> void:
	var list = data.get("data", [])
	if typeof(list) != TYPE_ARRAY:
		return
	presets = list
	preset_dropdown.clear()
	for item in presets:
		var name := str(item.get("name", "preset"))
		var idx := preset_dropdown.item_count
		preset_dropdown.add_item(name)
		preset_dropdown.set_item_metadata(idx, item.get("id", name))
	if presets.size() > 0:
		preset_dropdown.select(0)
		_on_preset_selected(0)

func _handle_preset(data: Dictionary) -> void:
	current_preset = data
	preset_desc.text = str(data.get("description", ""))
	seed_spin.value = float(data.get("seed", seed_spin.value))
	mood_label.text = "mood: %s" % str(data.get("mood", "living"))
	_set_theme(str(data.get("mood", "living")))

func _on_preset_selected(index: int) -> void:
	var preset_id = preset_dropdown.get_item_metadata(index)
	if preset_id == null:
		return
	api_client.get_json("/api/preset/%s" % preset_id)

func _on_apply_pressed() -> void:
	if current_preset.is_empty():
		return
	var payload := {
		"dsl": current_preset.get("dsl", ""),
		"profiles": current_preset.get("profiles", []),
		"seed": int(seed_spin.value),
		"n": int(n_spin.value),
		"backend": backend_option.get_item_text(backend_option.selected),
	}
	api_client.post_json("/api/apply", payload)

func _on_run_toggled(pressed: bool) -> void:
	var payload := {
		"run": pressed,
		"tick_ms": int(tick_spin.value),
		"steps": int(steps_spin.value),
	}
	api_client.post_json("/api/run", payload)

func _on_theme_selected(index: int) -> void:
	_set_theme(theme_dropdown.get_item_text(index))

func _set_theme(theme: String) -> void:
	current_theme = theme
	mood_label.text = "mood: %s" % theme
	var idx := THEMES.find(theme)
	if idx >= 0:
		theme_dropdown.select(idx)
	terrain_renderer.set_theme(theme)
	wall_renderer.set_theme(theme)
	wall_renderer.build_from_state(world_state)
	entity_renderer.set_theme(theme)

func _on_ollama_status() -> void:
	api_client.get_json("/api/ollama/status")

func _on_ollama_generate() -> void:
	api_client.post_json("/api/ollama/generate", {"max_count": 3})

func _show_ollama_status(data: Dictionary) -> void:
	var available := data.get("available", false)
	var model := data.get("model", "unknown")
	var enabled := data.get("enabled", false)
	thoughts_box.text = "Ollama: %s | model: %s | enabled: %s" % [available, model, enabled]

func _show_thoughts(data: Dictionary) -> void:
	var thoughts = data.get("thoughts", [])
	if typeof(thoughts) != TYPE_ARRAY:
		thoughts_box.text = "No thoughts yet."
		return
	var lines := PackedStringArray()
	for t in thoughts:
		if typeof(t) != TYPE_DICTIONARY:
			continue
		var eid := t.get("entity_id", "?")
		var text := t.get("text", "")
		lines.append("%s: %s" % [eid, text])
	thoughts_box.text = "\n".join(lines)

func _on_fields_received(fields: Dictionary) -> void:
	world_state.update_fields(fields)
	terrain_renderer.build_from_state(world_state)
	wall_renderer.build_from_state(world_state)

func _on_frame_received(frame: Dictionary) -> void:
	world_state.update_frame(frame)
	entity_renderer.update_from_frame(frame, world_state)

func _on_ws_connected() -> void:
	frame_timer.stop()
	api_client.get_json("/api/fields")

func _on_ws_disconnected() -> void:
	frame_timer.start()

func _on_ws_error(err: int) -> void:
	thoughts_box.text = "WebSocket error: %s" % err

func _update_debug() -> void:
	var fps := Engine.get_frames_per_second()
	var t_val := world_state.frame.get("t", 0.0)
	var entities = world_state.frame.get("entities", [])
	var count := entities.size() if typeof(entities) == TYPE_ARRAY else 0
	debug_label.text = "FPS: %d | t: %.2f | entities: %d" % [fps, float(t_val), count]
