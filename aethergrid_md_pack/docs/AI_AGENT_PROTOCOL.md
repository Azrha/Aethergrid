# Optional “Thinking” Character Protocol

## Purpose
Attach one entity to an LLM endpoint so it can:
- speak in-world
- choose actions
- react to the local scene

## Safety model
The model must output actions using a strict schema only:

- `say(text)`
- `move_to(x,y)`
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
- one action per tick (or per decision interval)
- optional short “thought” line (not required)
