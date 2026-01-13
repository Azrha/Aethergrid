import unittest

from engine.backend import get_backend, gpu_available


class BackendTests(unittest.TestCase):
    def test_cpu_backend(self):
        backend = get_backend(False)
        arr = backend.zeros((2, 3), dtype=backend.xp.float32)
        self.assertEqual(arr.shape, (2, 3))
        self.assertEqual(backend.asnumpy(arr).shape, (2, 3))

    def test_gpu_flag_falls_back(self):
        backend = get_backend(True)
        if gpu_available():
            self.assertEqual(backend.name, "gpu")
        else:
            self.assertEqual(backend.name, "cpu")


if __name__ == "__main__":
    unittest.main()
