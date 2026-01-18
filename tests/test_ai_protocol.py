from server.ollama_service import OllamaService


def test_parse_action_say_sanitizes():
    service = OllamaService()
    parsed = service._parse_action('{"action":"say","text":"Hello world","extra":123}')
    assert parsed == {"action": "say", "text": "Hello world"}


def test_parse_action_move_to_validates():
    service = OllamaService()
    parsed = service._parse_action('{"action":"move_to","x":"12.5","y":7}')
    assert parsed == {"action": "move_to", "x": 12.5, "y": 7.0}


def test_parse_action_move_to_accepts_z():
    service = OllamaService()
    parsed = service._parse_action('{"action":"move_to","x":3,"y":4,"z":2.5}')
    assert parsed == {"action": "move_to", "x": 3.0, "y": 4.0, "z": 2.5}


def test_parse_action_wait_clamps():
    service = OllamaService()
    parsed = service._parse_action('{"action":"wait","ticks":120}')
    assert parsed == {"action": "wait", "ticks": 60}


def test_parse_action_rejects_unknown():
    service = OllamaService()
    parsed = service._parse_action('{"action":"dance","style":"funk"}')
    assert parsed is None
