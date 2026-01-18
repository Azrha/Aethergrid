from server.sim_service import SimulationService


def test_scale_profiles_hits_target_count():
    service = SimulationService()
    profiles = [
        {"name": "A", "count": 10},
        {"name": "B", "count": 20},
        {"name": "C", "count": 30},
    ]
    scaled = service._scale_profiles(profiles, 15)
    assert scaled is not None
    total = sum(int(p.get("count", 0)) for p in scaled)
    assert total == 15
