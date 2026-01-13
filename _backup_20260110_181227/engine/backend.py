from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    import cupy as cp
except Exception:
    cp = None


@dataclass(frozen=True)
class Backend:
    name: str
    xp: Any

    def zeros(self, shape, dtype=None):
        return self.xp.zeros(shape, dtype=dtype)

    def roll(self, arr, shift, axis):
        return self.xp.roll(arr, shift, axis)

    def clip(self, arr, lo, hi):
        return self.xp.clip(arr, lo, hi)

    def asnumpy(self, arr):
        if self.xp is np:
            return arr
        return cp.asnumpy(arr)


CPU = Backend(name="cpu", xp=np)
GPU = Backend(name="gpu", xp=cp) if cp is not None else None
_GPU_READY: bool = False
_GPU_ERROR: str | None = None


def _gpu_ready() -> bool:
    global _GPU_READY, GPU, cp, _GPU_ERROR
    if _GPU_READY:
        return True
    if GPU is None or cp is None:
        try:
            import cupy as _cp
        except Exception as exc:
            _GPU_ERROR = str(exc)
            return False
        cp = _cp
        GPU = Backend(name="gpu", xp=cp)
    try:
        _ = cp.zeros((1,), dtype=cp.float32)
        _ = cp.random.RandomState(0).rand(1)
    except Exception as exc:
        _GPU_ERROR = str(exc)
        _GPU_READY = False
        GPU = None
        cp = None
        return False
    _GPU_READY = True
    _GPU_ERROR = None
    return True


def get_backend(use_gpu: bool = False) -> Backend:
    if use_gpu and _gpu_ready():
        return GPU  # type: ignore[return-value]
    return CPU


def gpu_available() -> bool:
    return _gpu_ready()


def gpu_error() -> str | None:
    _gpu_ready()
    return _GPU_ERROR


def disable_gpu() -> None:
    global _GPU_READY, GPU, cp
    _GPU_READY = False
    GPU = None
    cp = None
