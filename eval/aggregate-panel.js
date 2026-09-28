const fs = require("fs");
const path = require("path");
const { loadEngines } = require("./engines");
const { newScenarios } = require("./scenarios");

const { PL } = loadEngines();
const results = JSON.parse(fs.readFileSync(path.join(__dirname, "results.json"), "utf8"));

const anchors = PL.decisions.map((d) => Object.assign({ bankSource: "anchor" }, d));
const expansions = newScenarios.filter((s) => s.source === "expansion").map((d) => Object.assign({ bankSource: "expansion" }, d));
const adversarial = newScenarios.filter((s) => s.source === "adversarial").map((d) => Object.assign({ bankSource: "adversarial" }, d));
const allRaw = anchors.concat(expansions, adversarial);
const rawById = new Map(allRaw.map((d) => [d.id, d]));
const bankById = new Map(results.scenarioBank.map((d) => [d.id, d]));
const ids = results.scenarioBank.map((d) => d.id);

function readJson(name) {
  const raw = fs.readFileSync(path.join(__dirname, "phase-b", name), "utf8");
  return JSON.parse(raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, ""));
}

const personaFiles = ["persona-revenue-first.json", "persona-risk-first.json", "persona-ops-first.json", "persona-customer-experience.json", "persona-engineering-delivery.json"];
const personas = personaFiles.map(readJson);
const judgeRuns = ["judge-run-1.json", "judge-run-2.json", "judge-run-3.json"].map(readJson);

// ---------- Panel aggregation ----------

function rankMapOf(persona) {
  const m = new Map();
  persona.rankings.forEach((r) => m.set(r.id, r.rank));
  return m;
}
const personaRankMaps = personas.map(rankMapOf);

function labelMapOf(persona) {
  const m = new Map();
  persona.labels.forEach((l) => m.set(l.id, l));
  return m;
}
const personaLabelMaps = personas.map(labelMapOf);
const riskFirstIdx = personas.findIndex((p) => p.persona === "risk-first");

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function majorityVote(values, tiebreakValue) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = [];
  let bestCount = 0;
  counts.forEach((c, v) => {
    if (c > bestCount) { bestCount = c; best = [v]; }
    else if (c === bestCount) best.push(v);
  });
  if (best.length === 1) return best[0];
  if (tiebreakValue !== undefined && best.indexOf(tiebreakValue) !== -1) return tiebreakValue;
  return best[0];
}

const panelAgg = {};
ids.forEach((id) => {
  const ranks = personaRankMaps.map((m) => m.get(id));
  const labels = personaLabelMaps.map((m) => m.get(id));
  const escalations = labels.map((l) => l.escalation);
  const owners = labels.map((l) => l.owner);
  const readiness = labels.map((l) => l.readinessVerdict).filter((r) => r !== null && r !== undefined);
  const confidences = labels.map((l) => l.confidence).filter((c) => typeof c === "number");
  panelAgg[id] = {
    medianRank: median(ranks),
    ranks,
    majorityEscalation: majorityVote(escalations, escalations[riskFirstIdx]),
    escalations,
    owners,
    majorityReadiness: readiness.length ? majorityVote(readiness) : null,
    meanConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null
  };
});

// Fleiss' kappa across escalation labels (5 raters x 34 items x 2 categories)
function fleissKappa(itemsCategoryCounts, nRaters, categories) {
  const N = itemsCategoryCounts.length;
  const k = categories.length;
  const pj = categories.map((_, ci) => itemsCategoryCounts.reduce((s, row) => s + row[ci], 0) / (N * nRaters));
  const Pi = itemsCategoryCounts.map((row) => {
    const sumSq = row.reduce((s, nij) => s + nij * nij, 0);
    return (sumSq - nRaters) / (nRaters * (nRaters - 1));
  });
  const Pbar = Pi.reduce((a, b) => a + b, 0) / N;
  const PbarE = pj.reduce((a, b) => a + b * b, 0);
  return (Pbar - PbarE) / (1 - PbarE);
}
const escalCategories = ["decision", "informative"];
const escalCounts = ids.map((id) => {
  const row = [0, 0];
  panelAgg[id].escalations.forEach((e) => { row[escalCategories.indexOf(e)]++; });
  return row;
});
const fleissKappaEscalation = fleissKappa(escalCounts, 5, escalCategories);

// Spearman rho between each pair of personas' rankings, averaged
function spearman(ranksA, ranksB) {
  const n = ranksA.length;
  const d2 = ranksA.reduce((s, a, i) => s + Math.pow(a - ranksB[i], 2), 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
let pairSum = 0, pairCount = 0;
for (let i = 0; i < personas.length; i++) {
  for (let j = i + 1; j < personas.length; j++) {
    const ra = ids.map((id) => personaRankMaps[i].get(id));
    const rb = ids.map((id) => personaRankMaps[j].get(id));
    pairSum += spearman(ra, rb);
    pairCount++;
  }
}
const meanPairwisePersonaSpearman = pairSum / pairCount;

// ---------- Judge aggregation ----------

const DIMS = ["correctChoice", "grounded", "actionable", "addressesRisk", "noHallucination"];
const judgeById = judgeRuns.map((run) => {
  const m = new Map();
  run.forEach((r) => m.set(r.decisionId, r));
  return m;
});

const judgeAgg = {};
let agreeCount = 0, agreeTotal = 0;
const dimSums = {}; DIMS.forEach((d) => (dimSums[d] = { sum: 0, n: 0 }));
const hallucinationFlags = [];

ids.forEach((id) => {
  const scoresByDim = {};
  DIMS.forEach((dim) => {
    const vals = judgeById.map((m) => {
      const rec = m.get(id);
      return rec ? rec.scores[dim] : null;
    }).filter((v) => v !== null);
    scoresByDim[dim] = vals;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    dimSums[dim].sum += mean; dimSums[dim].n++;
    const within1 = (Math.max(...vals) - Math.min(...vals)) <= 1;
    agreeTotal++; if (within1) agreeCount++;
  });
  const noHallVals = scoresByDim.noHallucination;
  if (noHallVals.some((v) => v === 1)) {
    hallucinationFlags.push({
      id,
      noHallucinationScores: noHallVals,
      rationales: judgeById.map((m) => (m.get(id) || {}).rationale || null)
    });
  }
  judgeAgg[id] = {
    meanByDim: Object.fromEntries(DIMS.map((d) => [d, scoresByDim[d].reduce((a, b) => a + b, 0) / scoresByDim[d].length])),
    overallMean: DIMS.reduce((s, d) => s + scoresByDim[d].reduce((a, b) => a + b, 0) / scoresByDim[d].length, 0) / DIMS.length
  };
});
const interJudgeAgreement = agreeCount / agreeTotal;
const dimMeans = Object.fromEntries(DIMS.map((d) => [d, dimSums[d].sum / dimSums[d].n]));
const overallJudgeMean = DIMS.reduce((s, d) => s + dimMeans[d], 0) / DIMS.length;

// ---------- Tier 2 metrics ----------

// Impact ranking: system order = scenarioBank sorted desc by score; truth order = panel median rank asc
const systemOrder = ids.slice().sort((a, b) => bankById.get(b).score - bankById.get(a).score);
const truthOrder = ids.slice().sort((a, b) => panelAgg[a].medianRank - panelAgg[b].medianRank);
function topKPrecision(k) {
  const sysTop = new Set(systemOrder.slice(0, k));
  const truthTop = new Set(truthOrder.slice(0, k));
  let hit = 0; sysTop.forEach((id) => { if (truthTop.has(id)) hit++; });
  return hit / k;
}
const precisionAt1 = topKPrecision(1);
const precisionAt3 = topKPrecision(3);
const systemRankOf = new Map(systemOrder.map((id, i) => [id, i + 1]));
const spearmanSystemVsPanel = spearman(ids.map((id) => systemRankOf.get(id)), ids.map((id) => panelAgg[id].medianRank));

function ndcg(order, relevanceOf, idealOrder) {
  function dcg(seq) {
    return seq.reduce((s, id, i) => s + relevanceOf(id) / Math.log2(i + 2), 0);
  }
  return dcg(order) / dcg(idealOrder);
}
const relevanceOf = (id) => ids.length - panelAgg[id].medianRank; // higher = more relevant
const ndcgValue = ndcg(systemOrder, relevanceOf, truthOrder);

// Escalation classification: predicted = authored type, actual = panel majority
let tp = 0, fp = 0, fn = 0, tn = 0;
ids.forEach((id) => {
  const predicted = bankById.get(id).type; // "decision" | "informative"
  const actual = panelAgg[id].majorityEscalation;
  const predPos = predicted === "decision";
  const actPos = actual === "decision";
  if (predPos && actPos) tp++;
  else if (predPos && !actPos) fp++;
  else if (!predPos && actPos) fn++;
  else tn++;
});
const escPrecision = tp / (tp + fp) || 0;
const escRecall = tp / (tp + fn) || 0;
const escF1 = (2 * escPrecision * escRecall) / (escPrecision + escRecall) || 0;
const falseBlockRate = fp / (fp + tn) || 0; // over-escalation
const falseDelegateRate = fn / (fn + tp) || 0; // under-escalation

const commitmentIds = ids.filter((id) => (rawById.get(id).signals || {}).commitmentAtStake === true);
const catastrophicMisses = commitmentIds.filter((id) => bankById.get(id).type === "informative" && panelAgg[id].majorityEscalation === "decision");
const catastrophicMissRate = commitmentIds.length ? catastrophicMisses.length / commitmentIds.length : 0;

// RACI routing accuracy via role-family heuristic
const FAMILY_PATTERNS = [
  { id: "maya-okonkwo", re: /delivery exec|accountable delivery exec|\bcdo\b|rollout owner|sponsoring/i },
  { id: "andrew-aasen", re: /engineering|eval[- ]runner|eval\/quality|routing|intent|model/i },
  { id: "nadia-chen", re: /content|knowledge|copy|\bqa\b|faq/i },
  { id: "sam-tan", re: /data[- ]privacy|security|data[- ]access|data[- ]governance|logistics|carrier|fulfillment|order[- ]management/i },
  { id: "legal", re: /legal|compliance/i }
];
function familyOf(ownerText) {
  for (const f of FAMILY_PATTERNS) if (f.re.test(ownerText)) return f.id;
  return null;
}
// Ground truth for RACI is the panel's own majority judgment (the synthetic-panel proxy),
// compared against what ProofLoop currently displays (authored accountableOwner) — not the
// scenario bank's pre-authored groundTruth.correctOwnerId, which was only ever a guess made
// before the panel ran and is superseded by real panel data where they disagree.
let ownerHits = 0, ownerTotal = 0;
const raciDisagreements = [];
ids.forEach((id) => {
  const authoredOwner = bankById.get(id).accountableOwner;
  const families = panelAgg[id].owners.map(familyOf).filter(Boolean);
  if (!families.length) return;
  const predictedFamily = majorityVote(families);
  ownerTotal++;
  if (predictedFamily === authoredOwner) ownerHits++;
  else raciDisagreements.push({ id, authoredOwner, panelMajorityFamily: predictedFamily, preAuthoredCorrectOwnerId: bankById.get(id).groundTruth.correctOwnerId });
});
const accountableOwnerAccuracy = ownerTotal ? ownerHits / ownerTotal : null;

// Confidence calibration: ECE / Brier using judge correctChoice as accuracy proxy
const accuracyProxy = new Map(ids.map((id) => [id, judgeAgg[id].meanByDim.correctChoice / 5]));
const confidenceOf = new Map(ids.map((id) => [id, bankById.get(id).confidence / 100]));
const brier = ids.reduce((s, id) => s + Math.pow(confidenceOf.get(id) - accuracyProxy.get(id), 2), 0) / ids.length;
const NBINS = 10;
const bins = Array.from({ length: NBINS }, () => ({ confSum: 0, accSum: 0, n: 0 }));
ids.forEach((id) => {
  const c = confidenceOf.get(id);
  const bi = Math.min(NBINS - 1, Math.floor(c * NBINS));
  bins[bi].confSum += c; bins[bi].accSum += accuracyProxy.get(id); bins[bi].n++;
});
let ece = 0;
bins.forEach((b) => { if (b.n) ece += (b.n / ids.length) * Math.abs(b.confSum / b.n - b.accSum / b.n); });

// Grounding / traceability
const citationCoverage = dimMeans.grounded / 5;
const faithfulness = dimMeans.noHallucination / 5;

// Rollout readiness go/no-go agreement
const rolloutIds = ids.filter((id) => bankById.get(id).groundTruth.readinessVerdict);
const rolloutAgree = rolloutIds.filter((id) => panelAgg[id].majorityReadiness === bankById.get(id).groundTruth.readinessVerdict);
const goNoGoAgreement = rolloutIds.length ? rolloutAgree.length / rolloutIds.length : null;

const output = {
  panel: {
    fleissKappaEscalation,
    meanPairwisePersonaSpearman,
    byId: panelAgg
  },
  judge: {
    interJudgeAgreement,
    dimMeans,
    overallJudgeMean,
    hallucinationFlags,
    byId: judgeAgg
  },
  tier2Metrics: {
    impactRanking: { precisionAt1, precisionAt3, spearman: spearmanSystemVsPanel, ndcg: ndcgValue },
    escalation: { precision: escPrecision, recall: escRecall, f1: escF1, falseBlockRate, falseDelegateRate, catastrophicMissRate, commitmentScenarioCount: commitmentIds.length, catastrophicMissIds: catastrophicMisses },
    raciRouting: { accountableOwnerAccuracy, n: ownerTotal, disagreements: raciDisagreements },
    calibration: { ece, brier },
    recommendationQuality: { judgeMean: overallJudgeMean, dimMeans, interJudgeAgreement },
    grounding: { citationCoverage, faithfulness },
    rolloutReadiness: { goNoGoAgreement, n: rolloutIds.length }
  }
};

fs.writeFileSync(path.join(__dirname, "phase-b", "aggregated.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output.tier2Metrics, null, 2));
console.log("hallucination flags:", hallucinationFlags.map((h) => h.id));
console.log("fleiss kappa (escalation):", fleissKappaEscalation, "mean pairwise persona spearman:", meanPairwisePersonaSpearman);
