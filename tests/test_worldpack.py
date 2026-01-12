import unittest
from pathlib import Path

from engine.worldpack import load_worldpack_json, worldpack_to_dsl


class WorldPackTests(unittest.TestCase):
    def test_load_and_dsl(self):
        for path in Path("examples/worldpacks").glob("*.json"):
            pack = load_worldpack_json(path.read_text(encoding="utf-8"))
            dsl = worldpack_to_dsl(pack)
            self.assertIn("const W", dsl)
            self.assertIn("law", dsl)


if __name__ == "__main__":
    unittest.main()
