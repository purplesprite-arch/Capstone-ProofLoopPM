# ProofLoop — Capstone Overview (v2)

**Prepared for:** Andrew Aasen
**Course:** AI Product Management Bootcamp, AI Product Academy / Maven
**Prepared:** September 7, 2026
**Supersedes:** *AI Product Management Capstone: Use-Case Landscape and Recommendation* (Sept 2, 2026) — the original landscape doc chose the direction; this version specifies the product now that Prototype 2 exists. The landscape and the alternatives it weighed are preserved in the Appendix.

---

## Executive summary

The capstone is **ProofLoop**: the decision-intelligence layer that lets a delivery organization improve AI agents at AI speed *without* spending more of its scarcest resource — qualified human judgment.

The original thesis holds. AI has moved the bottleneck in delivery from *production* to *judgment*: teams can generate a hundred agent behaviors before a client or executive can review five. Left alone, that gap becomes **judgment debt** — the team optimizes against its own proxy for quality, ambiguous requirements stay hidden, and feedback arrives late as rework. ProofLoop's job is to spend scarce judgment on the calls that reduce the most uncertainty, and to turn each call into durable evaluation evidence.

What v2 sharpens is the *moment of judgment* itself. The first draft imagined an annotation queue a client SME works through. Discovery pointed somewhere higher-leverage: the person whose scarcity actually gates the build is the **accountable executive** — the Chief Delivery Officer who owns the client relationship and the ship decision. ProofLoop v2 is built for that person's **morning: two minutes on a phone, before the day's agentic build compounds in the wrong direction.**

> **Core product promise (unchanged):** Given dozens of open questions and only a few minutes of a decision-maker's attention, surface the one call that will change today's build the most — and make it a single, confident tap.

The prototype (`../prototype-2/`) is a clickable, dependency-free demonstration of that ritual end to end.

---

## 1. The thesis: two clocks, and the debt between them

Applying a single Agile cadence to AI delivery breaks because AI delivery runs on two clocks at different speeds:

- **Governance clock** — scope, budget, risk, security, architecture, stakeholder alignment. Runs weekly or per sprint.
- **Evidence clock** — build, sample, judge, update, regression-test. Can run in *hours*.

When the evidence clock outruns the governance clock, the team keeps shipping behavioral variants faster than anyone confirms which are *right*. That surplus of unreviewed behavior is judgment debt. It is not solved by producing more feedback — no tool manufactures reviewer availability. It is solved by **allocating scarce judgment intelligently and converting it into evaluation infrastructure.**

ProofLoop's market position is unchanged and still the sharpest available:

> **The client-collaboration layer that feeds your evaluation platform** — not a generic annotation console, and not a chatbot. It decides *what deserves a human*, routes it to the *right* human, and turns the answer into an eval.

---

## 2. What changed in v2 (and why)

| v1 framing | v2 framing | Why it's stronger |
|---|---|---|
| Client SME works an annotation queue of A/B output pairs | **Executive decider runs a 2-minute morning briefing on mobile** | The scarcest, most build-gating attention isn't the SME's — it's the accountable leader's. Winning their two minutes is the whole product. |
| "Select the 5 most informative cases" (uncertainty heuristics) | **Composite Impact Score ranks the queue by production value** | Executives don't optimize for information gain; they optimize for ROI on *today's* build. The score makes "what matters most right now" explicit and defensible. |
| "One named person decides" (governance prose) | **RACI-lite on every item + a Decision ⇄ Informative toggle** | Turns the governance principle into a live control: the decider can demote anything to "keep me informed," delegating accountability and shrinking the blocking queue in real time. |
| ProofLoop "does the tracking" (single system) | **A crew of 8 monitoring agents (a watch floor)** | Names the autonomous work explicitly and keeps the briefing calm: agents run continuously; only the ones that *escalate* surface to the human. |
| "Ship/no-ship evidence summary" | **Value Showcase (go/no-go) → Pilot Rollout planner** | Extends the loop past a single decision into a real rollout arc — before/after KPIs, a go/no-go gate, then staged cohorts with guardrails and rollback. |

Everything else — judgment debt, the two clocks, confirmed-vs-inferred preference, requirement-to-evidence traceability, evaluation as both the product's output and its test — carries forward intact.

---

## 3. Users, buyer, and the job to be done

**Primary decider (new center of gravity):** the accountable delivery executive — a Chief Delivery Officer or engagement lead who owns the client outcome and the ship decision. In the prototype this is *Maya Okonkwo, Chief Delivery Officer*.

**Supporting users:** AI delivery lead / PM, implementation consultant, client SME, evaluation/quality lead. These are the Responsible, Consulted, and Informed roles around each decision.

**Buyer:** a consulting, systems-integration, or internal AI-delivery organization that wants to accelerate agent delivery without losing client control or traceable acceptance.

**Job to be done:**

> When my team produces agent behavior faster than anyone can review it, protect today's build: tell me the single decision that most changes the outcome, give me the evidence to make it in one tap, and let everything that doesn't need me advance on its own — safely and on the record.

**Desired outcome:** more high-impact decisions resolved per minute of decider attention, with better completeness, traceability, and reuse of the judgments captured.

---

## 4. The product: a morning decision ritual

The prototype opens on **Today** — the briefing. The flow:

1. **State of the day.** A one-line greeting: *"2 decisions need you today. 6 are advancing on their own."* No dashboard sprawl.
2. **The hero decision.** The single highest-Impact-Score call fills the screen: title, the agent that raised it, an Impact Score gauge, a one-line *why it's #1* in plain business language, a RACI strip with the Accountable role emphasized, and a quick-decide bar.
3. **Decide in one tap.** Approve / Request revision / Reject → a lightweight confirm → the card clears with a toast, and **the next-ranked decision animates into the hero slot.** If the exec answers only one thing, it was the right one.
4. **Cleared + FYI.** Once the blocking queue is empty: *"You've set today's direction."* Below sits the muted group of items advancing autonomously — visible, but not demanding.
5. **Route by importance, live.** Any item's **Decision ⇄ Informative** toggle moves it in or out of the blocking stack and updates the "needs you" count immediately — delegating accountability to a named owner. This is the clearest expression of the RACI-lite model.

Depth is always one tap away, never always-on: the score breakdown, the full brief with recommendation and evidence trace, the agent watch floor, the evidence map, and decision memory.

---

## 5. The Impact Score (feature-level ROI ranking)

The queue is ranked by a transparent composite so "what matters most today" is a number the decider can trust and interrogate.

| Factor | Weight | Meaning |
|---|---:|---|
| Production value | 0.35 | KPI / dollar impact in production |
| Unblocks today | 0.30 | How much it clears today's critical path (blocked tasks) |
| Reach | 0.20 | Users / volume affected |
| Urgency | 0.15 | Time until an SLA, gate, or window closes |

`score = round(0.35·value + 0.30·unblock + 0.20·reach + 0.15·urgency)`, each sub-score on 0–100.

Weights protect production value first, then unblocking — deliberately, because a delivery executive's failure mode is letting a high-value regression sit while low-stakes polish advances. Tapping any score reveals the **honest arithmetic** (stacked contributions, `sub × weight = contribution`) and a templated *"why this ranks here"* sentence written in dollars and blocked tasks, never in weights. The score is computed live, so re-ranking after a toggle or a resolved decision is real, not scripted.

---

## 6. RACI-lite and decision routing

Every decision carries an inline **R / A / C / I** strip, with the **Accountable** role emphasized and named ("You" when it's the current decider). The governance principle from v1 — *many consult, one decides* — becomes an interactive control:

- **Decision required** — sits in the blocking queue, ranked by Impact Score, waiting on the accountable person.
- **Informative only** — the decider delegates accountability to a named owner; the item leaves the blocking stack, advances autonomously under its guardrail, and stays visible in the FYI group. One tap takes it back.

This makes delegation a first-class, reversible act rather than a meeting outcome — and it is the single most demonstrable "control without overhead" moment in the product.

---

## 7. The delivery crew: 8 agents on a watch floor

ProofLoop runs a standing crew of monitoring agents. Most stay behind the scenes; the briefing only shows the ones that *escalate*.

| Agent | Watches | Surfaces when |
|---|---|---|
| Chief of Staff | Assembles the briefing, RACI routing, decision latency | Orchestrates (always, quietly) |
| Impact Analyst | Computes each decision's Impact Score | On demand (score breakdown) |
| Eval Runner | Regression + scenario evals on every build change | A regression or new failure appears |
| Evidence Steward | Source coverage, recency, agreement, traceability | Evidence is thin or contradictory |
| Requirements Analyst | Requirement-to-behavior mapping | A behavior conflicts with a confirmed requirement |
| Risk & Compliance Sentinel | Promise breaks, policy, safety | A confirmed commitment is at risk → **escalates** |
| Rollout Manager | Readiness, cohorts, guardrails, rollback | A rollout reaches a go/no-go gate → **escalates** |
| Dependency Tracker | Cross-workstream blockers | A dependency threshold trips → **escalates** |

Every finding and decision carries an **attribution chip** naming the agent that produced it, so autonomous work stays auditable. The watch-floor view lists all eight with live status (watching / analyzing / escalated / idle); an escalated agent links straight to the brief it raised. This is where the "full team of agents monitoring all aspects of ProofLoop" lives — surfaced deliberately, not all at once.

---

## 8. The rollout arc: value showcase → pilot

The second escalated decision in the briefing is a **go/no-go on rolling out a proven agent** (in the prototype, a *Billing Resolution Agent* saving ~$18k/month at 87% confidence). It routes to two purpose-built surfaces:

- **Value Showcase** — before/after KPI cards with delta pills, dollars saved, a confidence bar backed by evidence, and a clear go/no-go verdict. This is the artifact that justifies a rollout to a leader who wasn't in the build.
- **Pilot Rollout planner** — staged cohorts (5% → 25% → 100%), each with a success gate; explicit guardrails; and named rollback triggers. Designed by the Rollout Manager; the go/no-go approval writes to Decision Memory like any other call.

This extends ProofLoop past "decide on one behavior" into "decide to ship, then govern the ship safely" — the full evidence-to-production loop.

---

## 9. Capstone-sized MVP

### In scope
- Mobile-first morning briefing: ranked decision queue, hero decision, quick-decide, cleared + FYI states.
- Composite Impact Score with live re-ranking and an honest, tappable breakdown.
- RACI-lite strip + Decision ⇄ Informative routing that moves items and updates counts live.
- Brief detail: recommendation, confidence, before/after diff, affected goals, evidence trace, escalation reason, and a decide panel (sticky bottom bar on mobile, side panel on desktop).
- Agent watch floor (8 agents, statuses, escalation links) and inline agent attribution.
- Value Showcase → Pilot planner → go/no-go writing to Decision Memory.
- Evidence Map (goals/requirements tree → source cards with confirmed/observed/contradicts claims) and Decision Memory timeline.
- Synthetic data throughout; opens by double-clicking `index.html` (no build, no backend).

### Explicitly out of scope (unchanged intent)
- Enterprise identity/access, Jira/Linear/Slack/Teams sync, production trace ingestion at scale.
- Automatic prompt optimization; a trained client-preference model; autonomous ship decisions (the human always decides).
- A predictive delivery-risk model; general project management.

---

## 10. Evals for ProofLoop

Evaluation remains both the product's output *and* the way the product itself is tested. The v1 table (rubric generation, requirement extraction, case prioritization, feedback interpretation, failure clustering, preference learning, disagreement detection, reviewer efficiency/experience, business usefulness) still applies. v2 adds the capabilities the sharpened product introduces:

| Capability (new in v2) | Evaluation design | Example metric |
|---|---|---|
| **Impact-ranking quality** | Have delivery leads rank a decision set by "what most changes today's build"; compare with the Impact Score order. | Rank correlation, Precision@1 (was the true #1 surfaced first) |
| **RACI-routing correctness** | Label each decision's correct Accountable owner and decision-vs-informative status; compare with the system's assignment. | Routing accuracy; false-block rate; false-delegate rate |
| **Rollout-readiness signal** | Compare the go/no-go recommendation and confidence with an expert readiness verdict on the same evidence. | Agreement rate; calibration of the confidence bar |
| **Decision latency** | Time from a build change escalating to a logged human decision. | Median time-to-decision; % resolved within one briefing |
| **Briefing calm (over-escalation)** | Fraction of surfaced items an expert agrees truly needed the human. | Escalation precision; items-shown per real decision |

**The distinction that governs all of them (unchanged):** don't maximize review *volume* — maximize *useful learning and correct direction per minute of attention*.

---

## 11. North-star metric

Primary, carried forward and sharpened for the decision ritual:

> **Durable direction-changes produced per 15 minutes of decider attention** — where a durable change is an accepted reference case, a confirmed rubric rule, a resolved ambiguity, an approved rollout, or a logged ship decision.

Supporting operating metric (new):

> **Judgment-debt burndown** — the count and age of build-affecting behaviors awaiting a human call. A healthy team keeps this low and young; a rising, aging queue is the leading indicator of debt.

---

## 12. Risks and mitigations

Carried forward: reviews requiring too much context (allow escalate-to-discussion), reviewer fatigue (strict attention budgets), preference overfitting (preserve multiple reviewers + disagreement), false client proxy (label confirmed/inferred/unknown), bad rubric extraction (confirm before authoritative), sensitive data (synthetic for capstone), cold start (seed from SOW/PRD), platform competition (compete on delivery methodology + traceability). New to v2:

| Risk | Why it matters | Mitigation |
|---|---|---|
| Impact Score reads as academic | An executive won't trust a black-box number. | Four plain-language factors, visible arithmetic, a why-sentence in dollars and blocked tasks — never in weights. |
| Over-featuring the briefing | A busy mobile screen defeats the two-minute promise. | Hero shows only #1; everything else one tap away; agents surface only on escalation. |
| Delegation becomes abdication | "Informative" could hide a real risk. | Compliance/risk escalations can't be silently demoted; informative items keep a named owner, a guardrail, and remain visible in FYI. |
| Rollout theater | A go/no-go with no teeth is a demo, not a decision. | The showcase is evidence-backed; the pilot has explicit gates, guardrails, and rollback triggers, all logged. |

---

## 13. The prototype

`../prototype-2/` is a dependency-free, mobile-first, clickable prototype. Double-click `index.html` (or serve the folder) — no build step, no backend, all data synthetic. See its `README.md` for the click-through script. What to demonstrate:

1. Open **Today** on a phone-width window → read the state line → decide the hero decision → watch #2 surface → reach the cleared state.
2. Flip a decision to **Informative** → watch it leave the blocking stack and the count drop; flip it back.
3. Tap an **Impact Score** → read the honest breakdown and the why-sentence.
4. Open the **rollout** decision → Value Showcase → Pilot planner → go/no-go → find it in **Decision Memory**.
5. Visit the **Agent** watch floor and the **Evidence Map**; note attribution chips throughout.

---

## 14. Capstone narrative

1. **Observation:** AI production capacity has outrun qualified human judgment.
2. **Problem:** review cycles accumulate judgment debt; teams optimize against unconfirmed proxies and pay for it as rework.
3. **User:** the accountable delivery executive — and the crew and clients around them.
4. **Insight:** the unit of progress isn't a finished feature; it's a *resolved, build-changing decision* captured as durable evidence — and the scarcest input is the decider's attention.
5. **Product:** ProofLoop turns each morning into two minutes that set the day's direction, ranks decisions by production ROI, routes the rest with RACI-lite, and runs a crew of agents that surface only when they must.
6. **Demo:** set today's direction from a phone; approve a rollout through a value showcase and pilot plan; see it all in decision memory.
7. **Evaluation:** impact-ranking quality, RACI-routing correctness, rollout-readiness calibration, decision latency, and briefing calm — plus the v1 rubric/selection/interpretation suite.
8. **Learning:** which decisions truly need the human, which the crew can carry, and how the briefing changed after testing.
9. **Roadmap:** connect to eval/observability platforms, learn a calibrated preference model, and wire routing into real delivery tooling.

### Memorable framing
- "AI teams no longer have a production bottleneck. They have a judgment bottleneck."
- "The fastest team isn't the one that generates the most variants — it's the one that resolves the most important uncertainty."
- "If the exec answers only one thing today, ProofLoop makes sure it was the right thing."
- "Client feedback should become an eval, not disappear into meeting notes."

---

## Appendix A — Alternatives considered (condensed)

The Sept 2 landscape doc weighed ProofLoop against strong alternatives across three domains; that analysis stands and is summarized here so the decision trail is preserved.

- **Professional services:** SOW-to-Eval Compiler (best low-risk fallback — convert contracted intent into an evaluation plan), Decision Latency Radar, Client Proxy Reviewer, Demo-to-Eval Recorder, Proposal-to-Delivery Integrity Agent, Evidence Loop Planner, Decision Receipt.
- **Construction / CRE:** Preconstruction Assumption Ledger (best construction bet), Warranty Lens (best multimodal demo), Homebuyer Upgrade Bundle Advisor, Inspection Readiness Coach, Closeout Concierge, Change-Order Decision Chain, Field Knowledge Capture, Permit-to-Plan Interpreter.
- **Newborn travel:** Newborn Destination Index (best consumer bet — friction-adjusted destination comparison), Hotel Truth Extractor, Disruption Replanner, Flight Friction Scorer, Pack-Rent-Buy Optimizer, Feeding Logistics Planner.

**Prioritized shortlist (directional, six-week part-time):** ProofLoop 4.7 · SOW-to-Eval Compiler 4.5 · Preconstruction Assumption Ledger 4.2 · Warranty Lens 4.2 · Homebuyer Upgrade Bundle Advisor 4.0 · Newborn Destination Index 4.0 · Decision Latency Radar 4.0.

**Fallbacks:** narrow to SOW-to-Eval Compiler if reviewer/output access proves too hard; test the Preconstruction Assumption Ledger if professional-services interviews don't confirm judgment debt; Newborn Destination Index if enterprise-user access blocks recruiting.

*(The full landscape, discovery plan, interview guide, kill criteria, and experiment sequence remain in the original Sept 2 document.)*

## Appendix B — Sources

- [AI Product Management Bootcamp & Certification — Maven](https://maven.com/marily-nika/ai-pm-bootcamp)
- [LangSmith: Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Braintrust: Set up human review](https://www.braintrust.dev/docs/annotate/human-review)
- [RICS Artificial Intelligence in Construction Report 2025](https://www.rics.org/news-insights/artificial-intelligence-in-construction-report)
- [Procore introduces Digital Coworkers and expands its AI agent library](https://www.procore.com/press/procore-introduces-digital-coworker-packages-expands-ai-agent-library-and-previews-skills-to-help-construction-teams-put-ai-to-work)
- [Toddler Trip](https://family-travel-planner.vercel.app/) · [Kidotel](https://kidotel.co/landing/)
