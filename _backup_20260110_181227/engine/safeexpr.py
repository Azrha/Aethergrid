from __future__ import annotations
from dataclasses import dataclass
import ast
import math
import random
from typing import Any, Dict, Mapping, Optional

@dataclass(frozen=True)
class CompiledExpr:
    src: str
    code: Any # code object

SAFE_FUNCS = {
    "min", "max", "abs", "round", "clamp", "lerp",
    "sin", "cos", "tan", "sqrt", "log", "exp",
    "rand", "randint"
}

_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare,
    ast.Name, ast.Load, ast.Constant, ast.Call,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
    ast.UAdd, ast.USub, ast.Not, ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
)

def clamp(x, lo, hi):
    return lo if x < lo else hi if x > hi else x

def lerp(a, b, t):
    return a + (b - a) * t

def rand():
    return random.random()

def randint(a, b):
    return random.randint(int(a), int(b))

_SAFE_IMPL: Dict[str, Any] = {
    "min": min, "max": max, "abs": abs, "round": round,
    "clamp": clamp, "lerp": lerp,
    "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "sqrt": math.sqrt, "log": math.log, "exp": math.exp,
    "rand": rand, "randint": randint,
    "true": True, "false": False, "True": True, "False": False
}

def _validate(node: ast.AST) -> None:
    for n in ast.walk(node):
        if not isinstance(n, _ALLOWED_NODES):
            raise ValueError(f"Unsafe node: {type(n).__name__}")
        if isinstance(n, ast.Call):
            if not isinstance(n.func, ast.Name):
                raise ValueError("Only direct function calls allowed")
            if n.func.id not in SAFE_FUNCS:
                raise ValueError(f"Function forbidden: {n.func.id}")

def compile_ast_node(node: ast.AST, src_hint: str = "") -> CompiledExpr:
    _validate(node)
    # Wrap in Expression if needed, though usually we get an Expression from parse
    if not isinstance(node, ast.Expression):
        node = ast.Expression(body=node)
    ast.fix_missing_locations(node)
    code = compile(node, "<dsl>", "eval")
    return CompiledExpr(src=src_hint, code=code)

def compile_expr(src: str) -> CompiledExpr:
    s = (src or "").strip()
    if not s: s = "False"
    try:
        node = ast.parse(s, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Syntax error in '{s}': {e}")
    return compile_ast_node(node, s)

def eval_expr(compiled: CompiledExpr, env: Optional[Mapping[str, Any]] = None) -> Any:
    scope = dict(_SAFE_IMPL)
    if env: scope.update(env)
    return eval(compiled.code, {"__builtins__": {}}, scope)
