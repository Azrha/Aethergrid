from engine.model import World
from engine.backend import get_backend


def test_voxel_sync_respects_sea_level():
    backend = get_backend(False)
    world = World(w=4, h=4, d=8, dt=1.0, backend=backend)
    world.terrain_scale = 1.0
    world.sea_level = 0.5
    world.terrain_field[:] = 0.0
    world.water_field[:] = 0.0

    world._sync_voxel_field()

    sea_idx = int(round(world.sea_level * (world.d - 1)))
    # Ground should be solid at z=0, water from z=1..sea_idx.
    assert world.voxel_field[0, 0, 0] == 1
    for z in range(1, sea_idx + 1):
        assert world.voxel_field[z, 0, 0] == 2
