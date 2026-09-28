# ProofLoop Eval — LLM-as-Judge Recommendation-Quality Rubric

## Purpose

Scores the QUALITY of each decision's authored `recommendation` (the "choice" + supporting reasoning
ProofLoop surfaces to Maya) against the underlying evidence — independent of whether the Impact Score
ranked it correctly. This is a judgment call about business usefulness, not a re-check of arithmetic.

**Disclosure:** the "judge" is itself an LLM call, not a real delivery lead — it is a scalable proxy
for the recommendation-quality dimension of human review, cross-checked against the synthetic panel's
own `recommendationGold` field (see `eval/prompts/panel.md`) and, eventually, real reviewer spot-checks
(Human-Validation Protocol, report §9).

## Inputs shown to the judge, per decision

- The decision's `title`, description, `evidence[]`, `metrics`, and its authored `recommendation`
  (choice + reasoning) — exactly what a real reviewer would see.
- NOT shown: ProofLoop's own Impact Score, confidence %, or the ground-truth panel's own verdict — the
  judge scores the recommendation on its own merits against the evidence, not against another model's
  or panel's conclusion (that comparison happens afterward, as a separate metric).

## Rubric — score each dimension 1-5, independently

1. **Correct choice** — given the evidence shown, is the recommended action (`approve` / `revise` /
   `hold` / a specific threshold, etc.) the one a competent delivery lead would actually make?
2. **Grounded** — does every factual claim in the recommendation's reasoning trace to a specific
   evidence item shown, with no invented specifics?
3. **Actionable** — could Maya act on this recommendation in under 30 seconds, with no follow-up
   question needed to know what "approve" or "hold" actually commits her to?
4. **Addresses risk** — if the decision carries a `commitmentAtStake`, compliance, or irreversibility
   signal, does the recommendation explicitly name that risk rather than silently ignoring it?
5. **No hallucination** — zero fabricated numbers, sources, or claims not present in the evidence
   shown (score 1 if any single fabrication is found, regardless of the other four dimensions).

## Procedure

- Run the rubric with **3 independent judge calls per decision** (same prompt, temperature > 0), not
  one — report the mean per dimension and the inter-judge agreement (e.g. the fraction of
  dimension-scores within 1 point of each other across the 3 runs) as a validity signal on the judge
  itself.
- A decision's overall recommendation-quality score is the mean of the 5 dimensions, itself averaged
  across the 3 judge runs.
- Any run that scores dimension 5 ("no hallucination") at 1 is flagged for manual review regardless of
  the aggregate — a single hallucination is a correctness incident, not something an average should
  smooth over.

## Output format

Return strict JSON per judge run: `{ decisionId, scores: {correctChoice, grounded, actionable,
addressesRisk, noHallucination}, rationale: string }`.
