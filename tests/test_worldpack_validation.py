from engine.worldpack import validate_worldpack


def test_worldpack_validation_flags_bad_profiles():
    data = {
        "name": "",
        "seed": "not-int",
        "profiles": [{"count": -2, "color": 5}],
        "consts": [],
        "laws": {},
    }
    errors = validate_worldpack(data)
    assert "name must be a non-empty string" in errors
    assert "seed must be an integer" in errors
    assert "profiles[0].count must be >= 0" in errors
    assert "profiles[0].color must be a string" in errors
    assert "consts must be an object" in errors
    assert "laws must be a list" in errors
