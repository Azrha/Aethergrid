import unittest

from engine.backend import get_backend
from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.paradox import static_check


class ActionCallTests(unittest.TestCase):
    def test_boid_calls(self):
        src = "\n".join(
            [
                "const W = 64",
                "const H = 64",
                "law flock priority 1",
                "  when true",
                "  do wander(0.02)",
                "  do cohere(10, 0.05, true)",
                "  do align(10, 0.05, true)",
                "  do separate(6, 0.08, true)",
                "  do z += 0.1",
                "end",
            ]
        )
        prog = compile_program(src)
        rep = static_check(prog.consts, prog.laws)
        self.assertFalse(rep.static_errors)
        world = seed_world(64, 64, n=20, seed=2, backend=get_backend(False))
        kernel = Kernel(world, prog.consts, prog.laws)
        kernel.tick(observer_xy=(32, 32), observer_radius=10)

    def test_food_cycle(self):
        src = "\n".join(
            [
                "law food priority 1",
                "  when true",
                "  do emit_food(0.2)",
                "  do consume_food(0.1, 1.1)",
                "  do metabolize(0.01)",
                "  do wind(0.2)",
                "  do gust(0.2)",
                "  do emit_water(0.2)",
                "  do consume_water(0.1, 0.4)",
                "  do emit_road(0.1)",
                "  do follow_road(0.05)",
                "  do emit_settlement(0.1)",
                "  do emit_home(0.1)",
                "  do emit_farm(0.1)",
                "  do emit_market(0.1)",
                "  do seek_home(0.05)",
                "  do seek_farm(0.05)",
                "  do seek_market(0.05)",
                "  do trade(0.03)",
                "end",
            ]
        )
        prog = compile_program(src)
        rep = static_check(prog.consts, prog.laws)
        self.assertFalse(rep.static_errors)
        world = seed_world(32, 32, n=5, seed=3, backend=get_backend(False))
        kernel = Kernel(world, prog.consts, prog.laws)
        kernel.tick(observer_xy=(16, 16), observer_radius=10)


if __name__ == "__main__":
    unittest.main()
