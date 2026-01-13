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

class _AST(Transformer):
    def start(self, items):
        consts = {}
        laws = []
        for it in items:
            if isinstance(it, tuple) and it[0] == "const":
                consts[it[1]] = it[2]
            elif isinstance(it, Law):
                laws.append(it)
        return {"consts": consts, "laws": laws}

    def const_stmt(self, items):
        return ("const", str(items[0]), compile_expr(str(items[1])))

    def law_stmt(self, items):
        return Law(
            name=str(items[0]),
            priority=int(float(str(items[1]))),
            when=compile_expr(str(items[2])),
            actions=items[3] # action_block returns list
        )

    def action_block(self, items):
        # Items is a list of raw_action strings
        actions = []
        for raw in items:
            actions.append(self._parse_action(str(raw)))
        return actions

    def _parse_action(self, raw: str) -> Action:
        raw = raw.strip()
        # Try to parse as assignment
        for op in ["+=", "-=", "*=", "/=", "="]:
            if op in raw:
                parts = raw.split(op, 1)
                lhs = parts[0].strip()
                # Simple check: lhs must be a valid identifier
                if lhs.isidentifier():
                    rhs = parts[1].strip()
                    return Action(kind="assign", name=lhs, op=op, expr=compile_expr(rhs))
        
        # If not assignment, must be a void call (side effect)
        try:
            tree = ast.parse(raw, mode="eval")
        except SyntaxError as e:
            raise ValueError(f"Invalid action syntax '{raw}': {e}")
            
        if isinstance(tree.body, ast.Call):
            call_node = tree.body
            func_name = call_node.func.id
            # Compile args individually
            compiled_args = []
            for arg in call_node.args:
                # We wrap the arg node back into an Expression to compile it
                compiled_args.append(compile_ast_node(arg))
            return Action(kind="call", name=func_name, args=compiled_args)
        
        raise ValueError(f"Action must be assignment or function call: {raw}")

    def raw_action(self, items):
        return str(items[0])
        
    def NAME(self, t): return str(t)

@dataclass
class CompiledProgram:
    consts: Dict[str, Any]
    laws: List[Law]

def compile_program(src: str) -> CompiledProgram:
    tree = _PARSER.parse(src + "\n")
    ast_res = _AST().transform(tree)
    return CompiledProgram(consts=ast_res["consts"], laws=ast_res["laws"])
