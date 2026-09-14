# ProofLoop — Capstone

The decision-intelligence layer that lets a delivery org improve AI agents at AI speed
without spending more of its scarcest resource: qualified human judgment.

## What's here

| Path | What it is |
|---|---|
| [`docs/ProofLoop Capstone Overview v2.md`](docs/ProofLoop%20Capstone%20Overview%20v2.md) | Product thesis, MVP spec, and evaluation plan (the master doc) |
| [`docs/Agentic RAID.md`](docs/Agentic%20RAID.md) | The paired RAID artifact — what to watch and who decides |
| [`prototype-1/`](prototype-1/) | First interactive prototype: the full decision loop (detect → map → evidence → escalate → recommend → record) |
| [`prototype-2/`](prototype-2/) | Current build — the mobile-first "morning decision ritual" |

## Run a prototype

Both are dependency-free vanilla HTML/CSS/JS — no build, no backend.

- **Simplest:** double-click the prototype's `index.html` (opens over `file://`).
- **Or serve it:** `python3 -m http.server 4173 --directory prototype-2` then visit http://localhost:4173

See each prototype's own `README.md` for its click-through script. All data is synthetic.
