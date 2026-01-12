from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Any

import re
from lark import Lark, Transformer

from .laws import Law, Action
from .safeexpr import compile_expr

GRAMMAR_PATH = __file__.replace("compiler.py", "grammar.lark")


def _load_grammar() -> str:
    with open(GRAMMAR_PATH, "r", encoding="utf-8") as f:
        return f.read()


_PARSER = Lark(
    _load_grammar(),
    parser="lalr",
    lexer="contextual",
    maybe_placeholders=False,
    propagate_positions=True,
)


def _split_args(text: str) -> List[str]:
    args = []
    buf = []
    depth = 0
    in_str = None
    esc = False
    for ch in text:
        if esc:
            buf.append(ch)
            esc = False
            continue
        if ch == "\\":
            buf.append(ch)
            esc = True
            continue
        if in_str:
            buf.append(ch)
            if ch == in_str:
                in_str = None
            continue
        if ch in ("'", "\""):
            in_str = ch
            buf.append(ch)
            continue
        if ch == "(":
            depth += 1
            buf.append(ch)
            continue
        if ch == ")":
            depth = max(0, depth - 1)
            buf.append(ch)
            continue
        if ch == "," and depth == 0:
            arg = "".join(buf).strip()
            if arg:
                args.append(arg)
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        args.append(tail)
    return args


def _parse_action_line(text: str) -> Action:
    s = text.strip()
    match = re.match(r"^\s*([A-Za-z_]\w*)\s*(\+=|-=|\*=|/=|=)\s*(.+)$", s)
    if match:
        name, op, expr_src = match.groups()
        return Action(kind="assign", name=name, op=op, expr=compile_expr(expr_src.strip()))
    if "(" in s and s.endswith(")"):
        name, arg_text = s.split("(", 1)
        name = name.strip()
        arg_text = arg_text[:-1].strip()
        args = []
        if arg_text:
            args = [compile_expr(a) for a in _split_args(arg_text)]
        return Action(kind="call", name=name, args=args)
    raise ValueError(f"Invalid action line: {text}")


class _AST(Transformer):
    def stmt(self, items):
        for it in items:
            if it is not None:
                return it
        return None

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

    def const_stmt(self, items):
        name = str(items[0])
        expr_src = str(items[1]).strip()
        return ("const", name, compile_expr(expr_src))

    def law_stmt(self, items):
        cleaned = [it for it in items if it is not None]
        name = str(cleaned[0])
        prio = int(float(str(cleaned[1])))
        when_src = str(cleaned[2]).strip()
        actions = [it for it in cleaned[3:] if isinstance(it, Action)]
        return Law(name=name, priority=prio, when=compile_expr(when_src), actions=actions)

    def action_list(self, items):
        return items

    def action_line(self, items):
        text = None
        for it in items:
            if isinstance(it, str):
                text = it
                break
        if text is None:
            return None
        return _parse_action_line(text)

    def expr(self, items):
        return str(items[0])

    def NAME(self, t): return str(t)
    def NUMBER(self, t): return str(t)
    def _NL(self, _): return None


@dataclass
class CompiledProgram:
    consts: Dict[str, Any]
    laws: List[Law]


def compile_program(src: str) -> CompiledProgram:
    tree = _PARSER.parse(src + "\n")
    ast = _AST().transform(tree)
    return CompiledProgram(consts=ast["consts"], laws=ast["laws"])
