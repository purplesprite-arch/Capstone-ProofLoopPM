# The Agentic RAID

### A lightweight RAID for building AI agents fast on Salesforce Agentforce

RAID here has one job: keep the build moving fast while stakeholders stay
confident. It drops long-term milestone tracking and watches only what affects
**Time-to-Value (TTV)** or a **core metric** (deflection, resolution time, handle
time). If an item moves neither, it doesn't belong on the radar — keep building.

It's a scan, not a status report. **ProofLoop** does the tracking: it detects
build changes, grounds each item in evidence, flags the rare call a human must
make, and logs the decision. RAID says *what to watch and who decides*; ProofLoop
runs it.

---

## How to use it

Glance at it daily; ProofLoop surfaces the one or two items that actually need
you. Anyone can add input, **one named person decides**, and the decision is
logged in a sentence. Only items that break a promise or move a core metric pause
the build — see *Scoring* for what pauses it and *Governance* for who decides.

---

## The Value Overlay — *pre-RAID context*

Start every conversation from value, not problems:

- **Target KPI impact** — the metric this iteration moves (e.g. *+5% deflection*,
  *−30s handle time*).
- **TTV drift** — days until live and generating ROI, and whether that's holding.
- **Wins** — what's already shipped and proven; keeps stakeholders confident and
  risks in proportion.

---

## R — Risks *(Trust, Scope & Data)*

Threats that **haven't happened yet**:

- **Trust & grounding** — hallucination, data leakage, or toxic responses seen in testing.
- **Scope creep** — pressure to make the agent a generalist instead of nailing one high-value task.
- **Adoption** — handoff friction or poor early feedback that threatens uptake.

## A — Assumptions *(Capability & Readiness)*

State each as a **testable hypothesis with a pivot trigger** — decide the response
before it breaks:

- **Data readiness** — objects, fields, and Data Cloud streams are clean enough to reason against.
- **Reasoning boundaries** — the LLM can chain the actions this task needs. *Pivot: if it fails a 5-step chain, break it into smaller guided flows.*
- **Value hypothesis** — a given action will move the KPI. Until evaluated, it's a belief.

## I — Issues *(Live Blockers)*

Happening **right now**:

- **KPI degradation** — active regressions (e.g. *"resolution dropped 4% after yesterday's prompt change"*).
- **Action failures** — broken links between Agentforce and its Flows, Apex, or MuleSoft APIs.
- **Prompt drift / looping** — stuck loops or missed intent needing quick triage.

## D — Dependencies *(Ecosystem)*

What the next capability is **waiting on**:

- **Action enablement** — a team exposing an API or Flow the agent needs.
- **Data ingestion** — knowledge or context needed to ground the next capability.
- **Sign-offs** — compliance, privacy, or governance approvals.

---

## Guardrails & Evidence *(the AI overlay)*

The one surface classic RAID lacks — the model itself. Track it lightly:

- **Eval coverage** — which goals have a passing eval behind them.
- **Evidence confidence** — one signal per claim (source coverage, recency, agreement, repeatability).

---

## Item template — *the few fields that matter*

Keep items to four fields, so they're fast to write and read:

| Field | Captures |
| --- | --- |
| **What** | The risk, assumption, issue, or dependency, in a line. |
| **Owner** | Who's on it. |
| **Needs a human?** | Yes only if it breaks a promise or moves a core metric (see *Scoring*). |
| **Next step** | The recommended move. |

---

## Scoring — *does this need a human?*

One quick test, not a matrix: **does the item break a confirmed promise or move a
core metric?**

- **No** → keep building; ProofLoop advances it automatically.
- **Yes** → it pauses for the decider, with a recommendation.

For a sharper signal, score **severity 1–3** (1 = no KPI/TTV effect · 3 = breaks a
commitment or blocks the KPI) and send any **3 — or a likely 2 — to the decider**.
A commitment-breaking risk always escalates, even if unlikely.

*Example:* v2.4 hands one case to a human at 47s, past the promised 30s (AC-14) —
severity 3, so it pauses for the product owner. That's the "HIGH CONSEQUENCE"
brief ProofLoop raises.

---

## Governance — *consult, then decide*

Many people give input; **one person owns the call**:

- **Decider** — one per item (product owner for promises, delivery lead for build details).
- **Contributors** — anyone who knows, attaching a quick **Support / Concern / Block** + evidence.
- A **Concern from the relevant domain owner** (e.g. compliance on privacy) must be
  addressed in the decision; everything else is advisory.

The loop is short: raise → gather input async → decider picks **Approve / Revise /
Reject** → log it. ProofLoop assembles the input as evidence, prepares the brief,
and records the decision.

---

## Stakeholder views — *one log, role-specific lenses*

Each audience sees only their slice:

| Stakeholder | Sees |
| --- | --- |
| **Executive sponsor** | Value Overlay + high-severity items |
| **Delivery lead** | Issues + Dependencies |
| **Compliance / legal** | Data risks + sign-offs |
| **Product owner (decider)** | Items that need a decision |

---

## How ProofLoop runs it

ProofLoop keeps the log live so no one maintains it by hand. Each row is a real
surface in the prototype:

| Agentic RAID | ProofLoop |
| --- | --- |
| Spotting new issues | **Build-change detection** |
| Grounding claims in evidence | **Evidence map** · 100% traceability |
| What needs a human | **Escalation gate** — only calls that can't be safely inferred |
| Decision + rationale | **Decision memory** |
| Value Overlay | **Delivery pulse** metrics |

**The loop:** detect change → map to goals → run evidence → flag only what needs a
human → recommend → log. Fast by default; a human pauses it only when it matters.

---

## Why it's built this way

- **Fast stakeholder validation** — lead with wins + KPI/TTV, show each audience
  only their slice, and pause the build only for the rare real decision.
- **A feeling of control without overhead** — testable assumptions with pivot
  triggers, one clear decider, and an auditable decision log.
- **White-glove, right-sized** — evidence-grounded, tied to confirmed commitments,
  familiar RAID kept light. ProofLoop does the tracking so the team keeps building.

*Still open: map roles to the client's actual org chart, and capture contributor
input directly in ProofLoop.*
