# ProofLoop — Prototype 2

A mobile-first, clickable prototype of ProofLoop's **morning decision ritual**: a delivery executive opens the app on their phone, spends two minutes setting the day's agentic-build direction, and everything that doesn't need them advances on its own — safely and on the record.

This is a fast "art of the possible" iteration, not a final architecture. It is intentionally dependency-free so it opens by double-clicking a file.

## Run

**Simplest:** double-click `index.html`. It opens over `file://` with no build step and no backend.

**Or serve it** (nicer URL, avoids any browser `file://` quirks):

```bash
python3 -m http.server 4173 --directory prototype-2
```

Then visit `http://localhost:4173`. All data is synthetic; nothing is uploaded and no network calls are made (beyond Google Fonts).

**Best viewed** at phone width first (~390px — use your browser's device toolbar / responsive mode). The layout is mobile-first and adds a desktop sidebar + multi-column briefing at wider widths.

## The 2-minute demo script

1. **Today (the briefing).** Read the state line — *"decisions need you today; others are advancing on their own."* The single highest-impact decision fills the hero slot with its Impact Score, the agent that raised it, a one-line *why*, and a RACI strip.
2. **Decide the hero.** Tap **Approve** (or Request revision / Reject) → confirm → the card clears with a toast and **the next-ranked decision animates into the hero slot.** Clear the queue to reach *"You've set today's direction."*
3. **Route by importance.** On any decision, flip **Decision ⇄ Informative**. Informative items leave the blocking stack, delegate to a named owner, and the "needs you" badge drops live. Flip it back to reinsert it at its ranked position.
4. **Interrogate the score.** Tap any **Impact Score** gauge → see the honest arithmetic (`sub × weight = contribution`) and a plain-language why-sentence in dollars and blocked tasks.
5. **The rollout arc.** Open the rollout decision → **Value Showcase** (before/after KPIs, dollars saved, confidence, go/no-go) → **Pilot planner** (cohorts 5% → 25% → 100%, guardrails, rollback triggers) → approve → find it logged in **Decision Memory**.
6. **Depth, one tap away.** Visit the **Agent** watch floor (8 agents, live status, escalation links) and the **Evidence Map** (goals/requirements tree → evidence source cards). Note the agent **attribution chip** on every decision and finding.

## What it demonstrates

- **Impact Score** — `round(0.35·value + 0.30·unblock + 0.20·reach + 0.15·urgency)`, computed live so the queue re-ranks for real after a decision or a toggle.
- **RACI-lite** — inline R/A/C/I with the Accountable role emphasized, plus reversible decision-vs-informative routing.
- **Agent watch floor** — a standing crew of 8; only agents that *escalate* surface in the briefing, keeping it calm.
- **Rollout arc** — value showcase → pilot plan → go/no-go → decision memory.
- **Show & tell** — an optional gallery (screenshots, graphics, short video) the delivery lead can attach to a decision or the rollout showcase; it only appears once populated (see the escalation brief and the value showcase for examples).

## How it's built

Vanilla HTML/CSS/JS, no framework, no build.

| File | Role |
|---|---|
| `index.html` | App shell, nav (bottom tab bar on mobile / sidebar on desktop), SVG icon sprite, mount points |
| `data.js` | `window.PL` — all synthetic content (workspace, people, 8 agents, decisions, rollout, evidence, memory). Loaded **first**. |
| `render.js` | `window.PLRender.*` — pure `data → HTML string` functions (scores, breakdowns, cards, views) |
| `app.js` | State + delegated event handling + view routing + modals/toast. Loaded **last**. |
| `styles.css` | Mobile-first CSS; design tokens shared with Prototype 1 |

**Note:** scripts load as plain globals in order `data.js → render.js → app.js` (no ES modules) specifically so the prototype works when opened directly over `file://`. Decision toggles and resolutions mutate a clone of the seed data, so the demo re-ranks and records without altering `data.js`.

See [`../docs/ProofLoop Capstone Overview v2.md`](../docs/ProofLoop%20Capstone%20Overview%20v2.md) for the product thesis and evaluation plan, and [`../docs/Agentic RAID.md`](../docs/Agentic%20RAID.md) for the paired RAID artifact.
