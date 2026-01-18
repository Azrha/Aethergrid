from engine.kernel import Kernel
from engine.model import World
from engine.backend import get_backend
from engine.safeexpr import compile_expr


def test_kernel_resizes_voxel_field_on_depth_change():
    backend = get_backend(False)
    world = World(w=8, h=8, d=4, dt=1.0, backend=backend)
    kernel = Kernel(world, {"D": compile_expr("8")}, [])
    assert kernel.world.d == 8
    assert kernel.world.voxel_field.shape[0] == 8
