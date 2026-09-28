/* ProofLoop AI Eval — Phase B input preparation.
   Builds two blinded views of the full scenario bank for the synthetic panel and LLM judge:
     - panelView: for ranking + escalation label + owner + readiness + confidence. Strips every
       field that states or implies ProofLoop's OWN conclusion about the decision (impact scores,
       type, raci, delegateTo, recommendation, confidenceInputs, gate text, trace — trace's
       "Inference" line pre-states the recommended action, gate text pre-states the escalation
       verdict) — leaving only what a real delivery lead reviewing the underlying facts would see
       (title, one_liner, signals, metrics, evidence, goals, diff, showAndTell, openedMinsAgo).
     - judgeView: same blinding, PLUS `recommendation` restored — that's the one field the judge
       exists to score.
   Neither view includes `groundTruth`, `source`, or the `bankSource` tag added by run.js/this
   script (would reveal which scenarios are adversarial "traps" and bias attention toward them). */

const fs = require("fs");
const path = require("path");
const { loadEngines } = require("./engines");
const { newScenarios } = require("./scenarios");

const { PL } = loadEngines();

const anchors = PL.decisions.map((d) => Object.assign({ bankSource: "anchor" }, d));
const expansions = newScenarios.filter((s) => s.source === "expansion").map((d) => Object.assign({ bankSource: "expansion" }, d));
const adversarial = newScenarios.filter((s) => s.source === "adversarial").map((d) => Object.assign({ bankSource: "adversarial" }, d));
const all = anchors.concat(expansions, adversarial);

const STRIP_ALWAYS = ["impact", "type", "raci", "delegateTo", "confidenceInputs", "gate", "trace", "severity", "groundTruth", "source", "bankSource"];

function blind(d, keepRecommendation) {
  const out = {};
  Object.keys(d).forEach((k) => {
    if (STRIP_ALWAYS.indexOf(k) !== -1) return;
    if (k === "recommendation" && !keepRecommendation) return;
    out[k] = d[k];
  });
  return out;
}

const panelView = all.map((d) => blind(d, false));
const judgeView = all.map((d) => blind(d, true));

const outDir = path.join(__dirname, "phase-b");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "panel-input.json"), JSON.stringify(panelView, null, 2));
fs.writeFileSync(path.join(outDir, "judge-input.json"), JSON.stringify(judgeView, null, 2));

console.log(`panel-input.json: ${panelView.length} scenarios, fields kept: ${Object.keys(panelView[0]).join(", ")}`);
console.log(`judge-input.json: ${judgeView.length} scenarios, fields kept: ${Object.keys(judgeView[0]).join(", ")}`);
console.log(`Written to ${outDir}`);
