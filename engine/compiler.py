from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Any
import ast
from lark import Lark, Transformer
from .laws import Law, Action
from .safeexpr import compile_expr, compile_ast_node

GRAMMAR_PATH = __file__.replace("compiler.py", "grammar.lark")

def _load_grammar() -> str:
    with open(GRAMMAR_PATH, "r", encoding="utf-8") as f:
        return f.read()

_PARSER = Lark(_load_grammar(), parser="lalr", propagate_positions=True)


def _split_actions(raw: str) -> List[str]:
    actions = []
    buf = []
    depth = 0
    for ch in raw:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == ";" and depth == 0:
            part = "".join(buf).strip()
            if part:
                actions.append(part)
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        actions.append(tail)
    return actions


def _normalize_action(raw: str) -> str:
    out = []
    depth = 0
    for ch in raw:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == ";" and depth > 0:
            out.append(",")
        else:
            out.append(ch)
    return "".join(out)


class _AST(Transformer):
    def start(self, items):
        consts = {}
        laws = []
        for it in items:
            if it is None:
                continue
            if isinstance(it, tuple) and it[0] == "const":
                consts[it[1]] = it[2]
            elif isinstance(it, Law):
                laws.append(it)
        return {"consts": consts, "laws": laws}

    def stmt(self, items):
        if not items:
            return None
        return items[0]

    def const_stmt(self, items):
        name = str(items[0])
        expr_src = str(items[1])
        return ("const", name, compile_expr(expr_src))

    def law_stmt(self, items):
        name = str(items[0])
        prio = int(float(str(items[1])))
        when_src = str(items[2])
        actions = items[3]
        return Law(name=name, priority=prio, when=compile_expr(when_src), actions=actions)

    def action_block(self, items):
        actions: List[Action] = []
        for raw in items:
            for action_src in _split_actions(str(raw)):
                actions.append(self._parse_action(_normalize_action(action_src)))
        return actions

    def action_line(self, items):
        return str(items[0])

    def _parse_action(self, raw: str) -> Action:
        raw = raw.strip()
        for op in ["+=", "-=", "*=", "/=", "="]:
            if op in raw:
                parts = raw.split(op, 1)
                lhs = parts[0].strip()
                if lhs.isidentifier():
                    rhs = parts[1].strip()
                    return Action(kind="assign", name=lhs, op=op, expr=compile_expr(rhs))

        try:
            tree = ast.parse(raw, mode="eval")
        except SyntaxError as exc:
            raise ValueError(f"Invalid action syntax '{raw}': {exc}")

        if isinstance(tree.body, ast.Call):
            call_node = tree.body
            func_name = call_node.func.id
            compiled_args = []
            for arg in call_node.args:
                compiled_args.append(compile_ast_node(arg))
            return Action(kind="call", name=func_name, args=compiled_args)

        raise ValueError(f"Action must be assignment or function call: {raw}")

    def NAME(self, t): return str(t)

@dataclass
class CompiledProgram:
    consts: Dict[str, Any]
    laws: List[Law]

def compile_program(src: str) -> CompiledProgram:
    tree = _PARSER.parse(src + "\n")
    ast_res = _AST().transform(tree)
    return CompiledProgram(consts=ast_res["consts"], laws=ast_res["laws"])
