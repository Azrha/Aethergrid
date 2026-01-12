from __future__ import annotations

from dataclasses import dataclass
import ast
import math
import random
from typing import Any, Dict, Mapping


@dataclass(frozen=True)
class CompiledExpr:
    src: str
    code: Any  # compiled python code object


# Whitelisted functions allowed inside expressions (ast.Call)
SAFE_FUNCS = {
    "min", "max", "abs", "round",
    "clamp", "lerp",
    "sin", "cos", "tan", "sqrt", "log", "exp",
    "rand", "randint",
}

_ALLOWED_NODES = (
    ast.Expression,
    ast.BinOp, ast.UnaryOp,
    ast.BoolOp, ast.Compare,
    ast.Name, ast.Load,
    ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
    ast.UAdd, ast.USub, ast.Not,
    ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Call,
)


def clamp(x, lo, hi):
    return lo if x < lo else hi if x > hi else x


def lerp(a, b, t):
    return a + (b - a) * t


def rand():
    return random.random()


_SAFE_IMPL: Dict[str, Any] = {
    # math-ish
    "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "sqrt": math.sqrt, "log": math.log, "exp": math.exp,
    # basics
    "min": min, "max": max, "abs": abs, "round": round,
    # helpers
    "clamp": clamp, "lerp": lerp,
    # randomness
    "rand": rand,
    "randint": random.randint,
    # literals
    "true": True, "false": False,
    "True": True, "False": False,
}


def _validate_ast(node: ast.AST) -> None:
    for n in ast.walk(node):
        if not isinstance(n, _ALLOWED_NODES):
            raise ValueError(f"Unsafe/unsupported expression node: {type(n).__name__}")

        if isinstance(n, ast.Name):
            # allow any variable names; actual lookup happens via env
            # but block dunder/builtins-like names
            if n.id.startswith("__"):
                raise ValueError("Unsafe name")

        if isinstance(n, ast.Call):
            if not isinstance(n.func, ast.Name):
                raise ValueError("Unsafe/unsupported expression node: Call")
            fname = n.func.id
            if fname not in SAFE_FUNCS:
                raise ValueError(f"Function not allowed: {fname}")


def compile_expr(src: str) -> CompiledExpr:
    s = (src or "").strip()
    if not s:
        return CompiledExpr(src="", code=compile("0", "<expr>", "eval"))

    try:
        tree = ast.parse(s, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Invalid expression syntax: {e}") from e

    _validate_ast(tree)
    code = compile(tree, "<expr>", "eval")
    return CompiledExpr(src=s, code=code)


def eval_expr(compiled: CompiledExpr, env: Mapping[str, Any] | None = None) -> Any:
    scope: Dict[str, Any] = dict(_SAFE_IMPL)
    if env:
        scope.update(dict(env))
    return eval(compiled.code, {"__builtins__": {}}, scope)
