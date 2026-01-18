# Optional “Thinking” Character Protocol

## Purpose
Attach one entity to an LLM endpoint so it can:
- speak in-world
- choose actions
- react to the local scene

## Safety model
The model must output actions using a strict schema only:

- `say(text)`
- `move_to(x,y[,z])`
- `wait(ticks)`
- `emote(type)`
- `interact(targetId, verb)`

The simulation enforces:
- bounds checks
- rate limits / cooldowns
- action whitelist

## Inputs to the model (compact)
- current time / weather flags
- entity position + facing
- nearby entities (top N)
- nearby points of interest
- recent events (short list)

## Outputs
- one action per decision interval
- optional short “thought” line (not required)

## Runtime enforcement (current)
- Actions are parsed from strict JSON and validated against the whitelist.
- Cooldowns are enforced per entity (see `server/ollama_service.py`).
- Movement actions clamp to world bounds and respect `MAX_SPEED` (including optional `z`).
- Speech/emote/interact actions become in-world bubbles via the thought queue.
