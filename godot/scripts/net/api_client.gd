extends Node

signal get_completed(path: String, data: Dictionary)
signal post_completed(path: String, data: Dictionary)
signal request_failed(path: String, code: int, message: String)

@export var base_url := "http://127.0.0.1:8000"

func get_json(path: String) -> void:
	_request(HTTPRequest.METHOD_GET, path, {})

func post_json(path: String, payload: Dictionary) -> void:
	_request(HTTPRequest.METHOD_POST, path, payload)

func _request(method: int, path: String, payload: Dictionary) -> void:
	var url := base_url.rstrip("/") + path
	var headers := PackedStringArray(["Content-Type: application/json"])
	var body := ""
	if method == HTTPRequest.METHOD_POST:
		body = JSON.stringify(payload)
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_request_completed.bind(path, method, http))
	var err := http.request(url, headers, method, body)
	if err != OK:
		emit_signal("request_failed", path, 0, "Request error: %s" % err)
		http.queue_free()

func _on_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, path: String, method: int, http: HTTPRequest) -> void:
	var text := body.get_string_from_utf8()
	if response_code == 204 or text.is_empty():
		text = "{}"
	var json := JSON.new()
	var data: Dictionary = {}
	var parse_result := json.parse(text)
	if parse_result == OK and typeof(json.data) == TYPE_DICTIONARY:
		data = json.data
	elif parse_result == OK:
		data = {"data": json.data}
	else:
		data = {"raw": text}

	if response_code >= 200 and response_code < 300:
		if method == HTTPRequest.METHOD_GET:
			emit_signal("get_completed", path, data)
		else:
			emit_signal("post_completed", path, data)
	else:
		emit_signal("request_failed", path, response_code, text)

	http.queue_free()
