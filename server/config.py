"""Environment config loader for Aethergrid services."""
from __future__ import annotations

from pathlib import Path
import os


def load_env() -> None:
    env_path = os.environ.get("AETHER_ENV_PATH")
    if env_path:
        env_file = Path(env_path)
    else:
        env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def env_bool(key: str, default: bool = False) -> bool:
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


load_env()

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OLLAMA_THOUGHTS_ENABLED = env_bool("OLLAMA_THOUGHTS_ENABLED", True)
OLLAMA_ACTIONS_ENABLED = env_bool("OLLAMA_ACTIONS_ENABLED", True)
OLLAMA_CONVO_ENABLED = env_bool("OLLAMA_CONVO_ENABLED", False)
OLLAMA_TIMEOUT = env_float("OLLAMA_TIMEOUT", 6.0)
OLLAMA_ROLE_MODELS = os.environ.get(
    "OLLAMA_ROLE_MODELS",
    "humanoid=gemma3:4b,animal=qwen2.5:3b,alien=deepseek-r1:1.5b,default=qwen2.5:3b",
)

BRAIN_ENABLED = env_bool("BRAIN_ENABLED", True)
BRAIN_MEMORY_LIMIT = env_int("BRAIN_MEMORY_LIMIT", 80)
BRAIN_SUMMARY_INTERVAL = env_int("BRAIN_SUMMARY_INTERVAL", 120)
BRAIN_OBSERVE_INTERVAL = env_int("BRAIN_OBSERVE_INTERVAL", 6)
BRAIN_NEAR_RADIUS = env_float("BRAIN_NEAR_RADIUS", 4.0)
BRAIN_AUTO_THOUGHTS = env_bool("BRAIN_AUTO_THOUGHTS", False)
BRAIN_AUTO_ACTIONS = env_bool("BRAIN_AUTO_ACTIONS", False)
BRAIN_AUTO_CONVO = env_bool("BRAIN_AUTO_CONVO", False)
BRAIN_TICK_MS = env_int("BRAIN_TICK_MS", 1200)
