# ProofLoop — Product Requirements Document (v1)

**Prepared for:** Andrew Aasen
**Course:** AI Product Management Bootcamp, AI Product Academy / Maven
**Prepared:** September 14, 2026
**Companion doc:** [`ProofLoop Capstone Overview v2.md`](ProofLoop%20Capstone%20Overview%20v2.md) carries the full thesis, narrative, and capstone story. This PRD does not repeat that — it exists to make scope, requirements, and sequencing decidable and testable. Read the Overview first if you want the "why"; read this for the "what, precisely, and in what order."

**Relationship to the prototype:** `prototype-2/` already demonstrates the *entire* feature set described across MVP, Next, and Later below — it's a synthetic-data, single-persona click-through built to prove the concept end to end. This PRD's MVP/Next/Later split is **not** "what's built vs. not built." It's the sequencing a real engineering team would commit to first if this went from capstone prototype to a resourced product: which capabilities are the load-bearing daily loop (build fully, including the one piece that isn't real yet — calibrated confidence), and which are high-value but separable second releases.

---

## 1. Problem statement

AI delivery teams can now generate agent behavior changes faster than any qualified human can review them. That surplus of unreviewed behavior is **judgment debt**: the team ships against its own unconfirmed proxy for "good," ambiguous requirements stay hidden, and the true cost surfaces later as rework or a broken client promise. The bottleneck in AI delivery has moved from *production* to *judgment* — and no tool manufactures more reviewer availability. The only lever is spending the judgment that exists on the calls that reduce the most uncertainty, and converting each call into durable evidence instead of a Slack thread that evaporates.

ProofLoop is the decision-intelligence layer that does this: it decides *what* deserves a human, routes it to the *right* human, and turns the answer into an eval.

---

## 2. Personas

Two personas — deliberately not more. Everyone else around a decision (implementation consultant, client SME, evaluation lead) is real context but is served *through* these two, not designed for directly in v1.

### 2.1 Maya Okonkwo — Chief Delivery Officer (primary decider)

- **Role:** Accountable executive who owns the client relationship and the ship decision. Judged on delivery outcomes, not on hours spent reviewing.
- **Context:** Mobile-first, fragmented attention, oversees multiple concurrent engagements. Cannot go deep on any single build change — has minutes, not hours.
- **JTBD:** *"When my team produces agent behavior faster than anyone can review it, tell me the single decision that most changes today's outcome, give me the evidence to make it in one confident tap, and let everything that doesn't need me advance safely and on the record."*
- **Pain today:** No reliable signal for what's actually urgent among dozens of open items; delegation is informal (a verbal "keep me posted") with no record and no way to reclaim an item if it turns out to matter.
- **Success looks like:** She opens the app, resolves the one thing that mattered, and trusts — without checking — that everything else is either fine or will come back to her if it isn't.

### 2.2 AI Delivery Lead / PM (supporting, day-to-day operator)

- **Role:** Runs the engagement day to day — preps evidence, tunes escalation thresholds, owns rollout mechanics, is the one Maya will ask "did we look at this?"
- **Context:** Lives in the tool continuously, not just two minutes a day. Accountable for the *quality of the queue* Maya sees — too much noise burns her trust; a missed real escalation burns the client relationship.
- **JTBD:** *"Keep Maya's queue small and trustworthy: make sure only genuine escalations reach her, and make sure everything that doesn't is defensible if she ever asks why."*
- **Pain today:** "What needs the exec" is currently a judgment call made ad hoc, per Slack thread, with no consistent bar, no audit trail, and no way to prove in hindsight that a decision was routed correctly.
- **Success looks like:** Escalation precision is high enough that Maya never says "why am I seeing this," and every autonomous decision is reconstructable later.

---

## 3. Goals & success metrics

**North-star metric (unchanged from the Overview, carried forward):**

> Durable direction-changes produced per 15 minutes of decider attention — where a durable change is an accepted reference case, a confirmed rubric rule, a resolved ambiguity, an approved rollout, or a logged ship decision.

**MVP scoping note:** at MVP launch (before the Next-phase Rollout arc ships), the only direction-change types MVP actually produces are *resolved ambiguity* (a decision routed and resolved via Approve/Request revision/Reject) and *logged ship decision* in the general sense of any approved recommendation written to Decision Memory. *Approved rollout* specifically depends on the Value Showcase → Pilot planner flow (§5, Next). *Accepted reference case* and *confirmed rubric rule* are evaluation-pipeline concepts that stay part of the north-star's full definition but aren't operationalized until Later-phase real ingestion (§5) exists — MVP doesn't measure them directly.

**Supporting operating metric:**

> Judgment-debt burndown — the count and age of build-affecting behaviors awaiting a human call. Healthy: low and young. Unhealthy: rising and aging.

**MVP-specific launch metrics** — the metrics we'll use to set the actual gate values (thresholds are explicitly open, see §8 Q2):

| Metric | Provisional target | Why it matters |
|---|---:|---|
| Escalation precision | ≥85% of surfaced items agreed genuine by an expert | Directly tests the "calm briefing" promise — over-escalation defeats the two-minute goal |
| Precision@1 | ≥80% match between Impact-Score #1 and an independent delivery-lead ranking | Tests whether the ranking is trustworthy enough to act on without re-deriving it |
| Confidence calibration error | ≤10 points \| stated confidence − empirically observed correctness rate \| | Tests whether the new derived-confidence engine (§4.7) is honest, not just less-obviously-fake |
| Decision latency | Median <2 minutes from escalation to logged human decision | Tests whether "one tap" is actually fast in practice, not just in the demo |

These are provisional starting targets, not validated thresholds — §8 Q2 tracks setting them for real.

---

## 4. MVP scope

The MVP is the full daily decision loop, including the one piece of it that isn't real yet. Everything here must ship together — cutting any one item breaks the "confident tap" promise for a different reason (no ranking → no calm queue; no real confidence → no trustworthy tap; no memory → no "on the record").

### 4.1 Morning briefing
- State line on open: count of decisions needing the user today vs. count advancing autonomously.
- Ranked queue with a single hero decision (highest Impact Score) filling the primary view.
- Quick-decide: Approve / Request revision / Reject, with a lightweight confirm step.
- On resolution: card clears with a toast, next-ranked decision animates into the hero slot.
- Cleared state: explicit "you've set today's direction" message once the blocking queue is empty, with the FYI (autonomous) group visible below.
- **Acceptance:** the hero decision is, at the moment of resolution, verifiably the item with the highest Impact Score in the blocking queue — checkable directly against the score, not asserted.

### 4.2 Impact Score
- Composite: `round(0.35·value + 0.30·unblock + 0.20·reach + 0.15·urgency)`, each sub-score 0–100.
- Live recomputation — re-ranking after any decision or routing toggle is real, not scripted.
- Tappable breakdown: stacked contributions (`sub × weight = contribution`) plus a plain-language why-sentence in dollars and blocked tasks, never in weights.
- Each sub-score's band is grounded in an observable signal (dollars at stake, blocked-tasks count, reach, urgency kind) — the existing provenance layer (`render.js` band rubric) is retained and is a **hard requirement**, not a nice-to-have: an Impact Score with no visible provenance regresses the credibility bar already established.
- **Build gap:** the breakdown is currently wired only on the hero card. MVP requires wiring the same tappable breakdown into compact queue cards, FYI rows, and the Brief detail page so it's reachable from every decision, not just the hero.
- **Acceptance:** for any decision — hero, queued, or FYI — a user can trace every point of the score to a named, observable fact.

### 4.3 RACI-lite & routing
- Inline R/A/C/I strip on every decision; Accountable role emphasized and named ("You" when current user is Accountable). **Build gap:** currently wired only on hero/compact cards — MVP requires extending it to FYI rows and the Brief detail page so it truly appears on every decision.
- Decision ⇄ Informative toggle: moves an item into/out of the blocking queue, updates the "needs you" count immediately, and is reversible with no data loss.
- **Not yet built:** compliance/risk escalations must not be silently demotable to Informative. Today the Decision ⇄ Informative toggle is unguarded for every decision in the prototype — this guardrail is new MVP build work, not a restyle. Scope: an item counts as a compliance/risk escalation when `signals.commitmentAtStake` is true or the escalating agent is the Risk & Compliance Sentinel; the toggle must be disabled (not just discouraged) for those items. (See Overview §12 risk: "delegation becomes abdication".)
- **Acceptance:** flipping any non-guarded item's routing changes the blocking count within the same interaction, with no page reload or delay.

### 4.4 Brief detail (full)
- Recommendation with confidence (see §4.7 for how confidence must be computed).
- Before/after diff of the behavior change.
- Evidence trace: the specific sources (docs, evals, prior decisions, conflicting results) backing the recommendation, each tagged confirmed / observed / contradicts.
- Escalation reason: why this specific item needed a human rather than advancing autonomously.
- Decide panel: sticky bottom bar (mobile) / side panel (desktop) carrying the same Approve / Request revision / Reject actions as the hero card. **Build gap:** today this renders in-flow at the end of the scroll on mobile, not fixed to the viewport — MVP requires true sticky/fixed-position behavior so the decide actions stay reachable without scrolling.
- Affected goals/requirements mapping: a flat list of the goal/requirement IDs already tagged on this decision — shippable at MVP without a full tree UI. The cross-decision, explorable goals/requirements tree is the Evidence Map (§5, Next); Brief detail only needs to show which IDs this decision touches, not let a user browse the tree.
- **Acceptance:** without leaving the screen, it shows a recommendation with its confidence breakdown, a before/after diff, at least one evidence-tagged source, and a stated escalation reason.

### 4.5 Agent attribution & watch floor
- Every decision and finding carries an attribution chip naming the agent that produced it.
- Full watch floor view: all agents in the standing crew, live status (watching / analyzing / escalated / idle), and a direct link from any escalated agent to the brief it raised.
- Only escalated agents get a dedicated card in the briefing; watching-status agents still appear by name via attribution chips on FYI/autonomous items — the full watch floor with all eight statuses is one tap away, never default-visible clutter.
- **Acceptance:** for any autonomous decision, a user can answer "which agent decided this, and can I see what it's doing right now" in two taps.

### 4.6 Decision Memory (full timeline)
- **Partially built — real work remains for MVP:** every resolved decision (human or autonomous) must log its outcome, the evidence it was based on, and who resolved it. Today the prototype logs outcome and a hardcoded "resolved by you" attribution only; evidence isn't carried into the memory entry, and there's no live autonomous-resolution path (the one autonomous entry in Decision Memory is seed data, not something the app generates at runtime). Both gaps close for MVP: entries need an evidence reference, and autonomous resolutions need to write to memory when they happen, not just when a human acts.
- **Not yet built:** timeline view with filtering (by decision type, by outcome, by date) — no filter UI or logic exists in the prototype today.
- **Acceptance:** for any decision made in the last 30 days, a user can find it, see why it was made, and see what evidence supported it, without asking anyone.

### 4.7 Calibrated confidence *(new build — the credibility fix)*
This is the one MVP item that does not exist in the prototype today. Today, `recommendation.confidence` in `data.js` is a hand-authored number (e.g., 92, 87, 78) with a UI affordance ("How confidence works") that *claims* it's "a blend of source coverage, recency, agreement across sources, and eval repeatability" — but no such computation exists. This is a real credibility gap, not a cosmetic one: it is the exact question a skeptical stakeholder asks first, and today there's no honest answer.

**Requirement:** confidence must become a transparent composite, using the same "honest arithmetic" pattern already validated by the Impact Score (§4.2) — visible contributions, not a black box. Strawman formula, to be validated empirically before being treated as final:

`confidence = round(w1·evalPassRate + w2·sourceAgreement + w3·coverage + w4·recency)`

- **Source agreement** *(data-ready now)* — % of evidence sources tagged `confirmed`/`observed` vs. `contradicts` for this decision; the `claim` enum on each evidence entry already carries this structure directly.
- **Eval pass rate** *(needs a new structured field)* — % of relevant eval cases passed. Today this only exists as free text in an evidence note (e.g. "23 of 24 cases passed"); MVP needs a structured `eval: { passed, total }` field to compute from rather than parse out of prose.
- **Coverage** *(needs a new structured field)* — % of claims that are source-linked at all. Today this is also free text on the Evidence Steward's finding (e.g. "47 of 47 claims source-linked"); MVP needs a structured `coverage: { linked, total }` field.
- **Recency** *(needs a new field entirely)* — decay factor on the most recent supporting eval run or source update. No structured timestamp exists today; MVP needs to add one per evidence entry.

**One more gap to close:** the Evidence Map already carries a *third*, differently-shaped confidence value — `evidenceMap.detail.confidence` as a pre-formatted display string (e.g. `"High · 96%"`). This must be normalized to the same computed format as the recommendation confidence above; shipping two inconsistent confidence representations would undercut the whole point of §4.7.

Weights (`w1..w4`) are an open question (§8), not a placeholder — they must be set by comparing the formula's output against expert-assigned confidence on a held-out set of decisions (this is exactly the "Rollout-readiness signal" eval already specified in the Overview §10).

**Acceptance:** every confidence value shown anywhere in the product is reproducible from visible inputs; the "How confidence works" affordance shows the real breakdown, not a description of one.

---

## 5. Roadmap

### Next (fast-follow — high-value, separable product surfaces)
Both items below are already fully built in the prototype and are strong demo material now; they move to "Next" in a real build sequence because they each validate a *second* thesis (govern-the-ship; audit-the-evidence) rather than the core daily-decision loop, and neither blocks MVP's promise.

- **Rollout arc** — Value Showcase (before/after KPIs, dollars saved, confidence bar, go/no-go verdict) → Pilot Rollout planner (staged cohorts, guardrails, named rollback triggers) → approval writes to Decision Memory. Extends the loop from "decide on a behavior" to "decide to ship, then govern the ship safely."
- **Evidence Map** — goals/requirements tree → evidence source cards (confirmed/observed/contradicts), for structured evidence exploration beyond a single decision's trace.

### Later (bigger bets, real infrastructure)
- **Real build-change ingestion** — connect to actual eval/observability platforms, replacing synthetic seed data. This is the hard, currently-unsolved core of the whole thesis: deriving sub-scores and evidence from an arbitrary real build change, not just displaying authored ones.
- **Learned/calibrated client-preference model** — move from confirmed-vs-inferred labeling toward a model that learns a specific client's tolerance and priorities over time.
- **Enterprise integrations** — SSO/identity, Jira/Linear/Slack/Teams sync.
- **Predictive delivery-risk model** — forward-looking risk scoring rather than reactive escalation.

---

## 6. Explicit out of scope

- Enterprise identity/access management, third-party PM-tool sync, production trace ingestion at scale (all **Later**, not never — see §5).
- Automatic prompt optimization.
- Autonomous ship decisions — the human always decides; ProofLoop recommends and routes, never ships unilaterally.
- General project management (timelines, resourcing, budgets) — ProofLoop is a decision layer, not a PM tool.

---

## 7. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Calibrated confidence turns out worse-calibrated than the honest-looking asserted number it replaces | A "real" formula with bad weights is more dangerous than an obviously-asserted one, because it *looks* trustworthy | Validate against expert-assigned confidence on a held-out set before shipping (§4.7, §8); ship with the breakdown visible so a bad calibration is at least inspectable, not hidden |
| Moving the rollout arc and evidence map to "Next" reads as scope-cutting a demo strength | Both are already built and are strong capstone material | Frame explicitly as sequencing, not deletion (see "Relationship to the prototype" above); keep demoing them — they just aren't gating MVP launch |
| Impact Score / confidence reads as academic to a non-technical exec | An executive won't trust a black-box number | Plain-language factors, visible arithmetic, why-sentences in dollars and blocked tasks — never in weights (carried from Overview §12) |
| Delegation becomes abdication | "Informative" could hide a real risk | Compliance/risk escalations can't be silently demoted; informative items keep a named owner and stay visible in FYI (carried from Overview §12) |
| Escalation-precision target is aspirational without real usage data | No production users yet to measure against | Use the Overview §10 eval design (expert agreement rate) as the interim proxy until real usage exists |

---

## 8. Open questions

1. What are the actual weights (`w1..w4`) for the calibrated-confidence formula in §4.7, and what held-out decision set will be used to fit/validate them?
2. What escalation-precision threshold counts as "calm enough" — is there a number below which Maya's trust demonstrably erodes?
3. Should Decision Memory's 30-day acceptance bar (§4.6) extend indefinitely, or is there a retention/archival policy needed once real usage accumulates?
4. When real build-change ingestion (Later, §5) eventually replaces synthetic data, does the Impact Score's provenance-band approach (§4.2) survive contact with messier real signals, or does it need redesign at that point?

---

## Appendix A — Persona-to-requirement traceability

| MVP requirement | Serves Maya (decider) | Serves AI Delivery Lead/PM (operator) |
|---|---|---|
| Morning briefing (§4.1) | Primary — this is her two minutes | Indirect — she's judging the queue the lead curated |
| Impact Score (§4.2) | Primary — trust-without-re-deriving | Secondary — tunes what feeds the score |
| RACI-lite & routing (§4.3) | Primary — one-tap delegation | Primary — owns the items she delegates |
| Brief detail (§4.4) | Primary — defends the decision to a client | Primary — assembles the evidence Maya relies on |
| Agent attribution & watch floor (§4.5) | Secondary — spot-checks on demand | Primary — daily operating view |
| Decision Memory (§4.6) | Secondary — occasional lookback | Primary — the audit trail she's accountable for |
| Calibrated confidence (§4.7) | Primary — the number she's actually trusting | Primary — has to be able to explain it if challenged |
