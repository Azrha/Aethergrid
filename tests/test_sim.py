import unittest

from engine.backend import get_backend
from engine.compiler import compile_program
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.sim import Simulation


class SimulationTests(unittest.TestCase):
    def test_snapshot_json(self):
        src = "\n".join(
            [
                "law noop priority 1",
                "  when true",
                "  do vx += 0",
                "end",
            ]
        )
        prog = compile_program(src)
        world = seed_world(32, 32, n=5, seed=1, backend=get_backend(False))
        kernel = Kernel(world, prog.consts, prog.laws)
        sim = Simulation(kernel)
        sim.step(steps=2)
        payload = sim.snapshot_json(max_entities=3)
        self.assertIn("\"entities\"", payload)
        self.assertIn("\"consts\"", payload)
        sim.capture_snapshot(max_entities=2)
        history = sim.snapshots_jsonl()
        self.assertTrue(history)


if __name__ == "__main__":
    unittest.main()
