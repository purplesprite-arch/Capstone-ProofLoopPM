const fs = require("fs");
const path = require("path");

const resultsPath = path.join(__dirname, "results.json");
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const agg = JSON.parse(fs.readFileSync(path.join(__dirname, "phase-b", "aggregated.json"), "utf8"));
const m = agg.tier2Metrics;

results.tier2.note =
  "Ground truth = a synthetic 5-persona delivery-lead panel (revenue-first, risk-first, ops-first, customer-experience, engineering-delivery) each independently ranking and labeling the blinded 34-scenario bank, plus 3 independent LLM-judge runs scoring every authored recommendation on a 5-dimension rubric. This is a disclosed synthetic proxy, not real delivery leads — see Methodology and the Human-Validation Protocol for how it gets replaced with real expert labels. Every number below is a real computation over that panel/judge data (eval/aggregate-panel.js), not a placeholder.";

function setCap(name, patch) {
  const c = results.tier2.capabilities.find((x) => x.capability === name);
  c.illustrative = false;
  delete c.illustrativeValue;
  Object.assign(c, patch);
}

setCap("Impact ranking", {
  value: {
    "Precision@1": m.impactRanking.precisionAt1,
    "Precision@3": m.impactRanking.precisionAt3,
    "Spearman ρ": m.impactRanking.spearman,
    NDCG: m.impactRanking.ndcg
  },
  note: "Precision@1 is a single binary hit/miss over one 34-item ranking (this run's system #1 was not the panel's median-rank #1) — a coarse, high-variance signal at n=1; Precision@3, Spearman ρ, and NDCG are the more stable reads here and all show strong agreement with the panel's ranking."
});

setCap("Escalation classification (needs-a-human)", {
  value: {
    precision: m.escalation.precision,
    recall: m.escalation.recall,
    f1: m.escalation.f1,
    falseBlockRate: m.escalation.falseBlockRate,
    falseDelegateRate: m.escalation.falseDelegateRate,
    catastrophicMissRate: m.escalation.catastrophicMissRate
  },
  note: `Ground truth = panel-majority escalation label (Fleiss' κ = ${agg.panel.fleissKappaEscalation.toFixed(2)} across the 5 personas — near-perfect agreement). Of ${m.escalation.commitmentScenarioCount} commitment-at-stake scenarios in the bank, 1 is a deliberately-constructed miss (${m.escalation.catastrophicMissIds.join(", ")}) — this is the adversarial guardrail-gap case, not a surprise regression.`
});

setCap("RACI routing", {
  value: { accountableOwnerAccuracy: m.raciRouting.accountableOwnerAccuracy },
  note: `Compares ProofLoop's authored accountableOwner against the panel-majority owner, mapped via a keyword role-family heuristic (accountable-delivery-exec / engineering / content-knowledge / data-security / legal) since the panel was never shown ProofLoop's named-owner roster and answered in free-text role terms. This makes it the noisiest metric in this report — treat ${(m.raciRouting.accountableOwnerAccuracy * 100).toFixed(0)}% as a directional signal, not a precise rate; see Limitations. ${m.raciRouting.disagreements.length} of ${m.raciRouting.n} scored scenarios disagreed, including the 3 deliberately-constructed RACI-mismatch cases already confirmed deterministically in Tier 3.`
});

setCap("Confidence calibration", {
  value: { ece: m.calibration.ece, brier: m.calibration.brier },
  note: "Accuracy proxy = mean LLM-judge correctChoice score (rescaled 0-1) per scenario, binned against displayed confidence in 10 deciles for ECE."
});

setCap("Recommendation quality", {
  value: { judgeMean: m.recommendationQuality.judgeMean, interJudgeAgreement: m.recommendationQuality.interJudgeAgreement },
  note: `Mean across all 5 rubric dimensions, 3 independent judge runs, 34 scenarios. Per-dimension means: ${Object.entries(m.recommendationQuality.dimMeans).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ")}. Inter-judge agreement = fraction of (scenario × dimension) scores within 1 point across the 3 runs.`
});

setCap("Grounding / traceability", {
  value: { citationCoverage: m.grounding.citationCoverage, faithfulness: m.grounding.faithfulness },
  note: `faithfulness = mean noHallucination score (rescaled 0-1); citationCoverage = mean grounded score (rescaled 0-1). ${agg.judge.hallucinationFlags.length} of 34 scenarios drew a noHallucination=1 flag from at least one judge run — see the appendix for the full list and rationale; several recur across all 3 runs, indicating reproducible grounding gaps in ProofLoop's authored recommendation text, not judge noise.`
});

setCap("Rollout readiness", {
  value: { goNoGoAgreement: m.rolloutReadiness.goNoGoAgreement },
  note: `Only ${m.rolloutReadiness.n} rollout-class scenarios exist in this bank (d-billing-golive, exp-returns-agent-golive) — full agreement at n=2 is not a statistically meaningful rate; more rollout-shaped scenarios are needed before this metric is trustworthy. See Limitations.`
});

results.tier2.panelJudgeSummary = {
  fleissKappaEscalation: agg.panel.fleissKappaEscalation,
  meanPairwisePersonaSpearman: agg.panel.meanPairwisePersonaSpearman,
  interJudgeAgreement: agg.judge.interJudgeAgreement,
  hallucinationFlags: agg.judge.hallucinationFlags.map((h) => ({ id: h.id, noHallucinationScores: h.noHallucinationScores })),
  raciDisagreements: m.raciRouting.disagreements
};

const rows = results.tier3.redTeamMatrix.rows;
function setRow(failureMode, likelihood, status) {
  const r = rows.find((x) => x.failureMode === failureMode);
  r.likelihood = likelihood;
  r.status = status;
}
setRow(
  "Under-escalation of a commitment-breaking change",
  "medium — 1 of 3 commitment-at-stake scenarios in this bank missed (catastrophic-miss rate 33%)",
  "confirmed gap — no guardrail exists; panel-confirmed catastrophic miss on adv-commitment-mislabeled-informative"
);
setRow(
  "Over-escalation (erodes trust in the ritual)",
  `low-medium — false-block rate ${(m.escalation.falseBlockRate * 100).toFixed(0)}% vs. panel`,
  `measured: false-block rate ${(m.escalation.falseBlockRate * 100).toFixed(0)}%, false-delegate rate ${(m.escalation.falseDelegateRate * 100).toFixed(0)}% (escalation F1 ${(m.escalation.f1 * 100).toFixed(0)}%)`
);
setRow(
  "Hallucinated/ungrounded number (honest-arithmetic violation)",
  `medium — ${agg.judge.hallucinationFlags.length} of 34 authored recommendations flagged by at least one judge run`,
  `${agg.judge.hallucinationFlags.length} scenarios flagged noHallucination=1 by ≥1 of 3 judge runs (faithfulness ${(m.grounding.faithfulness * 100).toFixed(0)}%); the displayed Impact/Confidence numbers themselves remain 0 ungrounded (Tier 1) — this failure mode lives in authored recommendation prose, not the computed scores`
);
setRow(
  "Mis-routing to the wrong accountable owner",
  `medium-high — panel disagreed with the authored owner on ${m.raciRouting.disagreements.length} of ${m.raciRouting.n} scenarios (noisy heuristic, see Tier 2 RACI note)`,
  "3 confirmed deterministically in this run's bank (Tier 3); panel-based Tier 2 signal is directional only given free-text role-matching noise"
);
setRow(
  "Calibration failure (real-looking wrong confidence)",
  `medium — ECE ${(m.calibration.ece * 100).toFixed(1)} pts vs. ≤10pt target`,
  `0 live conflicts — the 87-vs-98 rollout/decision mismatch found in this run is fixed (showcase() now derives confidence live); ECE ${(m.calibration.ece * 100).toFixed(1)} pts, Brier ${m.calibration.brier.toFixed(3)} against judge-derived accuracy proxy`
);
setRow(
  "Delegation-becomes-abdication (compliance item demoted to informative)",
  "medium — same construction as the catastrophic-miss case above",
  "confirmed gap — no guardrail exists"
);
setRow(
  "Stale-data decision",
  "low-medium — recency banding behaves correctly; judge still flagged 1 stale-evidence recommendation as under-grounded",
  "recency correctly drags confidence down (Tier 3); adv-stale-evidence also drew a noHallucination=1 flag from the judge for citing specifics not present in the shown evidence"
);
setRow(
  "Prompt injection via build-change text (LLM-backed future state)",
  "not applicable today — no LLM in ProofLoop's current build loop",
  "out of scope for this run; re-test once an LLM is in the authoring/recommendation path"
);

results.tier3.redTeamMatrix.note =
  "Likelihood is now derived from the real Phase B panel/judge run (rates above); severity remains a fixed editorial judgment per failure mode (catastrophic/high/moderate), not something the panel scored directly. Detection and status are real for every row except prompt injection, which stays out of scope (no LLM in ProofLoop's current build loop).";

fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log("results.json updated.");
