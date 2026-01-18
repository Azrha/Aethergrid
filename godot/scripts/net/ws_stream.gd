extends Node

signal fields_received(fields: Dictionary)
signal frame_received(frame: Dictionary)
signal connected
signal disconnected
signal error(err: int)

var peer := WebSocketPeer.new()
var active := false
var has_connected := false

func connect_to_url(url: String) -> void:
	var err := peer.connect_to_url(url)
	if err != OK:
		emit_signal("error", err)
		return
	active = true
	has_connected = false
	set_process(true)

func close() -> void:
	if peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
		peer.close()
	active = false
	set_process(false)

func _process(_delta: float) -> void:
	if not active:
		return
	peer.poll()
	var state := peer.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not has_connected:
			has_connected = true
			emit_signal("connected")
		while peer.get_available_packet_count() > 0:
			var text := peer.get_packet().get_string_from_utf8()
			var json := JSON.new()
			if json.parse(text) != OK:
				continue
			var data = json.data
			if typeof(data) == TYPE_DICTIONARY and data.has("type") and data["type"] == "fields":
				if data.has("data") and typeof(data["data"]) == TYPE_DICTIONARY:
					emit_signal("fields_received", data["data"])
			else:
				if typeof(data) == TYPE_DICTIONARY:
					emit_signal("frame_received", data)
	elif state == WebSocketPeer.STATE_CLOSED or state == WebSocketPeer.STATE_CLOSING:
		if active:
			active = false
			emit_signal("disconnected")	
			set_process(false)
