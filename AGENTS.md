# AGENTS.md — Collaboration Contract (Aethergrid)

This repo is designed to be friendly to *any* coding assistant / agentic IDE.

## Non-negotiable rules

1) **Do not break public APIs without approval**
- If a component consumes an API, keep it stable.
- If a breaking change is unavoidable, add a compatibility layer.

2) **Assets are exports**
- The runtime must not require any specific sprite editor.
- Only commit exported atlases + metadata + credits.

3) **Idempotent automation**
- Any “apply changes” script must be safe to run multiple times.
- Prefer additive/reversible changes.

4) **Licensing discipline**
- No assets may be added without a compatible license.
- Every external asset source goes into `docs/CREDITS.md`.

## Preferred workflow
- Work on a branch.
- Small commits.
- Add/update docs with the code changes.
