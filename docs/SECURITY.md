# Security Notes

## Threat model (dev)
- Treat worldpacks and any external text as untrusted input.
- Avoid executing generated commands without review.
- Keep secrets out of the repo (`.env` not committed).

## Runtime
- The optional “thinking agent” must be gated by configuration.
- Never allow arbitrary code execution through the agent interface.
- Enforce strict output schemas and validate server-side.
