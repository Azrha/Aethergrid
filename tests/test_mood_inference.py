from server.sim_service import SimulationService


def test_infer_mood_keywords():
    service = SimulationService()
    assert service._infer_mood("Space Station") == "space"
    assert service._infer_mood("Fantasy Realm") == "fantasy"
    assert service._infer_mood("Dino Age") == "dino"
    assert service._infer_mood("Oceanic Realm") == "oceanic"
    assert service._infer_mood("Frostbound Frontier") == "frostbound"
    assert service._infer_mood("Emberfall Reach") == "emberfall"
    assert service._infer_mood("Skyborne Archipelago") == "skyborne"
    assert service._infer_mood("Ironwild Expanse") == "ironwild"
    assert service._infer_mood("Living World") == "living"
