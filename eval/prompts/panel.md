# ProofLoop Eval — Synthetic Delivery-Lead Panel Prompt

## Purpose

Generates the eval's ground-truth labels for the full scenario bank (`eval/scenarios.js` anchors +
new scenarios) via simulated independent "delivery-lead" personas, standing in for real human experts
until the Human-Validation Protocol (report §9) replaces them.

**Disclosure:** this panel is a synthetic proxy, not real delivery leads. It exists to dry-run the
eval's methodology and produce illustrative-but-defensible numbers ahead of running this against real
experts. Treat every number this panel produces as provisional.

## Panel composition

Run this prompt independently for each of the 5 personas below. Each run is a SEPARATE model call,
blind to the other personas' outputs and blind to ProofLoop's own computed score/confidence/RACI for
every decision — show each persona the decision's `title`, description/framing, `evidence[]`, and
`metrics` only, exactly as a real delivery lead reviewing the underlying facts would see them, never
the app's own conclusions about those facts (strip `impact`, any displayed confidence %, and `raci`
before showing a decision to a persona).

1. **Revenue-first lead** — prioritizes decisions that protect or grow revenue-bearing flows; anchors
   readiness verdicts on business-metric evidence (conversion, AOV, churn) over process cleanliness.
2. **Risk-first lead** — prioritizes compliance, legal exposure, and irreversible/hard-to-unwind
   changes; defaults to "escalate" and "hold" when evidence is ambiguous.
3. **Ops-first lead** — prioritizes what unblocks today's operational load (queue depth, agent
   coverage, on-call burden); comfortable approving lower-evidence items if they relieve a live
   bottleneck.
4. **Customer-experience lead** — prioritizes what customers actually feel (tone, latency, correctness
   of what they're told); weighs qualitative evidence (verbatims, sentiment) more heavily than the
   other personas.
5. **Engineering-delivery lead** — prioritizes technical readiness and rollback safety; most skeptical
   of thin evidence bases (shadow-mode duration, sample size) regardless of business upside.

## Task, per persona, per decision in the scenario bank

Given ONLY: `title`, description/framing text, `evidence[]` (claim + source + snippet), and `metrics`
(if present) —

1. **Rank** — after seeing the FULL set of decisions/scenarios in one pass, produce a total order
   (most to least deserving of a delivery lead's attention today).
2. **Escalation label** — for each: does this need a human decision today, or can it advance
   informationally? (`decision` | `informative`)
3. **Accountable owner** — who should hold the "A" in RACI for this decision? Answer with a role
   (e.g. "the accountable exec", "engineering lead", "legal/compliance"), not a name.
4. **Readiness verdict** (rollout-shaped decisions only) — `go` | `hold` | `no-go`, plus a one-line
   reason grounded in the evidence shown.
5. **Confidence** — 0-100, this persona's own subjective confidence in their verdict, given the
   evidence they were shown (not ProofLoop's computed %).

## Output format

Return strict JSON: `{ persona: string, rankings: [{id, rank}], labels: [{id, escalation, owner,
readinessVerdict, confidence}] }`.

## Aggregation (done after all 5 personas run)

- **Rank** — median rank per decision across personas.
- **Escalation / owner / readiness** — majority vote; ties broken by the risk-first persona (this
  eval's tie-break favors caution, matching ProofLoop's own stated design principle of routing
  ambiguous cases to a human).
- **Inter-rater agreement** — Fleiss' κ across the 5 personas' escalation labels; Spearman ρ between
  each pair of personas' rankings, averaged.
- **Report honestly** — low agreement on a given decision is itself a finding (it means the "correct"
  answer is genuinely contested, not that the panel is broken). Surface it; don't average it away.
