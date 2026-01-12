from __future__ import annotations
from dataclasses import dataclass
from typing import List
from .safeexpr import CompiledExpr

@dataclass
class Action:
    kind: str  # "assign" or "call"
    name: str
    op: str = ""
    expr: CompiledExpr | None = None
    args: List[CompiledExpr] | None = None

@dataclass
class Law:
    name: str
    priority: int
    when: CompiledExpr
    actions: List[Action]
