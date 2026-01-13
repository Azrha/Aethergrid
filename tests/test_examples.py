import unittest
from pathlib import Path

from engine.compiler import compile_program
from engine.backend import get_backend
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.paradox import static_check


class ExampleLawTests(unittest.TestCase):
    def test_examples_compile_and_tick(self):
        examples = list(Path("examples").glob("*.law"))
        self.assertTrue(examples, "No .law examples found")
        for path in examples:
            prog = compile_program(path.read_text(encoding="utf-8"))
            report = static_check(prog.consts, prog.laws)
            self.assertFalse(report.static_errors, f"{path.name} has static errors")
            world = seed_world(64, 64, n=20, seed=1, backend=get_backend(False))
            kernel = Kernel(world, prog.consts, prog.laws)
            kernel.tick(observer_xy=(32, 32), observer_radius=10)


if __name__ == "__main__":
    unittest.main()
