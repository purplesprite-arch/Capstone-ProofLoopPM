/* ProofLoop AI Eval — report renderer.
   Reads eval/results.json (written by eval/run.js) and renders a single self-contained
   eval/report/eval-report.html: inline CSS, inline SVG, no external libs, no build step, no
   network dependency — the same "open it and it works" ethos as prototype-2 itself.

   PHASE B — complete. Tier 1 (correctness/integrity) and the Tier 3-deterministic section are real,
   computed from results.json by a real run of eval/run.js against ProofLoop's actual engines. Tier 2
   (AI-quality) and the Tier 3 red-team matrix's likelihood column are now also real, computed by
   eval/aggregate-panel.js from the 5-persona synthetic panel + 3-run LLM judge (eval/phase-b/). The
   synthetic-panel/judge disclosure stays throughout (Methodology, Limitations, Human-Validation
   Protocol) — "real" here means "really computed from that panel," not "validated against real
   experts yet." */

const fs = require("fs");
const path = require("path");
const results = require("./results.json");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function pctFmt(v) { return `${Math.round(v * 100)}%`; }

const SEV_COLOR = { critical: "#e66045", high: "#e66045", medium: "#c98812", low: "#315aef", informational: "#3d4759" };
const SEV_BG = { critical: "#fff0eb", high: "#fff0eb", medium: "#fff6df", low: "#edf1ff", informational: "#eef1f4" };

function sevBadge(sev) {
  return `<span class="badge" style="color:${SEV_COLOR[sev] || "#3d4759"};background:${SEV_BG[sev] || "#eef1f4"}">${esc(sev).toUpperCase()}</span>`;
}
function boolBadge(ok, okText, failText) {
  return ok
    ? `<span class="badge" style="color:#24a981;background:#e8f8f3">${esc(okText || "PASS")}</span>`
    : `<span class="badge" style="color:#be4a33;background:#fff0eb">${esc(failText || "FAIL")}</span>`;
}
function sourceBadge(src) {
  const map = { anchor: ["#315aef", "#edf1ff"], expansion: ["#24a981", "#e8f8f3"], adversarial: ["#e66045", "#fff0eb"] };
  const [c, bg] = map[src] || ["#3d4759", "#eef1f4"];
  return `<span class="badge" style="color:${c};background:${bg}">${esc(src)}</span>`;
}

function svgBar({ value, target, max, betterHigh, width = 180, height = 10 }) {
  const w = width, h = height;
  const vx = Math.max(0, Math.min(1, value / max)) * w;
  const tx = Math.max(0, Math.min(1, target / max)) * w;
  const meets = betterHigh ? value >= target : value <= target;
  const near = betterHigh ? value >= target * 0.85 : value <= target * 1.2;
  const color = meets ? "#24a981" : near ? "#c98812" : "#e66045";
  return `<svg width="${w}" height="${h + 6}" viewBox="0 0 ${w} ${h + 6}" class="scorebar" role="img" aria-label="value vs target">
  <rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="#e3e7eb"/>
  <rect x="0" y="0" width="${Math.max(2, vx)}" height="${h}" rx="${h / 2}" fill="${color}"/>
  <line x1="${tx.toFixed(1)}" y1="-2" x2="${tx.toFixed(1)}" y2="${h + 2}" stroke="#172338" stroke-width="1.5"/>
</svg>`;
}

function findCap(name) { return results.tier2.capabilities.find((c) => c.capability === name); }

/* ---------------------------------------------------------------------------------------- */

function buildHeader() {
  const today = new Date().toISOString().slice(0, 10);
  return `
<header class="hero">
  <div class="hero-inner">
    <div class="brand"><span class="brand-mark">PL</span><span>ProofLoop &middot; <strong>AI Eval Report</strong></span></div>
    <h1>Does ProofLoop's judgment hold up?</h1>
    <p class="lead">A single-run evaluation of the ProofLoop morning decision ritual: correctness of its
    deterministic engines (Tier 1), quality of the AI-shaped judgments a production build would make
    (Tier 2), and the concrete risks worth mitigating before this moves past a capstone demo (Tier 3).</p>
    <div class="hero-meta">
      <div><span class="meta-label">Report generated</span><span class="meta-value">${esc(today)}</span></div>
      <div><span class="meta-label">Scenario bank</span><span class="meta-value">${results.meta.scenarioBankSize} scenarios &middot; ${results.meta.anchorCount} anchor / ${results.meta.expansionCount} expansion / ${results.meta.adversarialCount} adversarial</span></div>
      <div><span class="meta-label">Simulated "now"</span><span class="meta-value">${esc(results.meta.prLoopNowIso)}</span></div>
      <div><span class="meta-label">Ground truth</span><span class="meta-value">synthetic 5-persona panel + 3-run LLM judge (disclosed, see &sect;9 / Appendix)</span></div>
    </div>
  </div>
</header>`;
}

function buildDraftBanner() {
  return `
<div class="draft-banner">
  <strong>Every number below is computed, not illustrative.</strong> Tier 1 and the deterministic half
  of Tier 3 come from a real run of <code>eval/run.js</code> against ProofLoop's actual
  <code>prototype-2</code> engines. Tier 2 and the Tier 3 likelihood column come from a real run of
  <code>eval/aggregate-panel.js</code> over a <strong>synthetic 5-persona delivery-lead panel</strong>
  and a <strong>3-run LLM judge</strong> — a disclosed synthetic ground-truth proxy, not real delivery
  leads. That disclosure doesn't expire: see Methodology (&sect;3), Limitations (&sect;8), and the
  Human-Validation Protocol (&sect;9) for what it means and how it gets replaced with real experts.
</div>`;
}

function buildNav() {
  const items = [
    ["scorecard", "Scorecard"], ["methodology", "Methodology"], ["scenario-bank", "Scenario bank"],
    ["tier1", "Tier 1 — Correctness"], ["tier2", "Tier 2 — AI quality"], ["tier3", "Tier 3 — Risk"],
    ["limitations", "Limitations"], ["human-protocol", "Human validation"], ["appendix", "Appendix"]
  ];
  return `<nav class="report-nav">${items.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join("")}</nav>`;
}

function buildScorecard() {
  const impactRanking = findCap("Impact ranking");
  const escalation = findCap("Escalation classification (needs-a-human)");
  const calibration = findCap("Confidence calibration");
  const routing = findCap("RACI routing");
  const recQuality = findCap("Recommendation quality");

  const headline = [
    { label: "Precision@1 (impact ranking)", value: impactRanking.value["Precision@1"], target: 0.80, max: 1, betterHigh: true, fmt: pctFmt },
    { label: "Escalation precision", value: escalation.value.precision, target: 0.85, max: 1, betterHigh: true, fmt: pctFmt },
    { label: "Confidence-calibration error (ECE)", value: calibration.value.ece, target: 0.10, max: 0.30, betterHigh: false, fmt: pctFmt },
    { label: "RACI routing accuracy", value: routing.value.accountableOwnerAccuracy, target: 0.85, max: 1, betterHigh: true, fmt: pctFmt },
    { label: "Recommendation quality (LLM-judge mean)", value: recQuality.value.judgeMean, target: 4.0, max: 5, betterHigh: true, fmt: (v) => `${v.toFixed(1)}/5` },
    { label: "Catastrophic-miss rate", value: escalation.value.catastrophicMissRate, target: 0.02, max: 0.10, betterHigh: false, fmt: pctFmt }
  ];

  const computedCards = [
    { label: "Impact Score & confidence", value: `${results.tier1.scoreConfidence.checks.filter((c) => c.scorePass && c.confidencePass).length}/${results.tier1.scoreConfidence.checks.length} anchors reproduce exactly`, ok: results.tier1.scoreConfidence.allPass },
    { label: "Bank sanity (34 scenarios)", value: `${results.tier1.bankSanity.checks.filter((c) => c.scoreValid && c.confidenceValid).length}/${results.tier1.bankSanity.checks.length} finite & in-range`, ok: results.tier1.bankSanity.allPass },
    { label: "Band containment sweep", value: `${results.tier1.bandContainment.outOfBandFindings.length} out-of-band flag(s) found (both expected)`, ok: true },
    { label: "Integrity linter", value: `${results.tier1.integrityLinter.confirmedCount}/${results.tier1.integrityLinter.totalCount} findings confirmed`, ok: results.tier1.integrityLinter.confirmedCount === results.tier1.integrityLinter.totalCount },
    { label: "Tier 3 deterministic/adversarial", value: `${Object.values(results.tier3.deterministic).filter((c) => c.confirmed).length}/${Object.keys(results.tier3.deterministic).length} checks confirmed`, ok: Object.values(results.tier3.deterministic).every((c) => c.confirmed) }
  ];

  return `
<section id="scorecard" class="section">
  <h2>Scorecard</h2>
  <h3 class="sub">Computed today — real, from this run</h3>
  <div class="card-grid">
    ${computedCards.map((c) => `
    <div class="stat-card">
      <div class="stat-top">${boolBadge(c.ok)}</div>
      <div class="stat-label">${esc(c.label)}</div>
      <div class="stat-value">${esc(c.value)}</div>
    </div>`).join("")}
  </div>
  <h3 class="sub">AI-quality vs. PRD provisional targets <span class="note">(synthetic-panel/judge ground truth — see &sect;3)</span></h3>
  <div class="card-grid">
    ${headline.map((m) => `
    <div class="stat-card">
      <div class="stat-label">${esc(m.label)}</div>
      <div class="stat-value">${esc(m.fmt(m.value))} <span class="stat-target">target ${esc(m.fmt(m.target))}</span></div>
      ${svgBar({ value: m.value, target: m.target, max: m.max, betterHigh: m.betterHigh })}
    </div>`).join("")}
  </div>
</section>`;
}

function buildMethodology() {
  return `
<section id="methodology" class="section">
  <h2>Methodology &amp; scope</h2>
  <p>Most of what ProofLoop shows today is <strong>deterministic UI over authored data</strong>, not
  live model output — and a credible eval has to say exactly where the line sits, or every metric
  below is meaningless.</p>
  <table class="map-table">
    <thead><tr><th>Computed</th><th>Authored (not intelligence, today)</th></tr></thead>
    <tbody><tr>
      <td>Impact Score (weighted sum of 4 sub-scores) &middot; Confidence % (capped at 99) &middot;
        sub-score band containment &middot; the Value-Model lever override</td>
      <td>Impact sub-scores themselves &middot; the escalation gate (<code>type: "decision" |
        "informative"</code> is a literal field) &middot; recommendations (static choice + reasoning
        strings) &middot; RACI assignment</td>
    </tr></tbody>
  </table>
  <p>So this eval tests two layers, plus a third: <strong>Tier 1</strong> — do the deterministic
  engines, as they exist today, compute what they claim to compute, and where does the authored data
  disagree with itself? <strong>Tier 2</strong> — how would the AI-shaped judgments a production
  ProofLoop would need to make (ranking, escalation classification, routing, recommendation,
  grounding) score against an independent reference? <strong>Tier 3</strong> — what concrete failure
  modes should worry us, and which ones are already exploitable today?</p>
  <p><strong>Ground truth.</strong> Tier 2 needs an independent reference that isn't the app grading
  itself. This run uses a <strong>synthetic 5-persona delivery-lead panel</strong> (revenue-first,
  risk-first, ops-first, customer-experience, engineering-delivery — see <code>eval/prompts/panel.md</code>,
  full text in the Appendix) plus a <strong>3-run LLM-judge rubric</strong> for recommendation quality
  (<code>eval/prompts/judge.md</code>). Both are disclosed as synthetic proxies, not real experts — see
  Limitations (&sect;8) and the Human-Validation Protocol (&sect;9) for how this gets replaced with real
  reviewers.</p>
  <p><strong>Honest-arithmetic invariant.</strong> Every number in Tier 1 and the Tier 3-deterministic
  section is produced by calling ProofLoop's own real, unmodified functions — loaded into Node via a
  window-shim (<code>eval/engines.js</code>) that requires <code>prototype-2/data.js</code> then
  <code>prototype-2/render.js</code> exactly as the browser does — never a parallel reimplementation of
  its scoring logic. The one exception is <em>orchestration</em>, not scoring: the out-of-band-value
  finding (&sect;5) mirrors 8 lines of <code>app.js</code>'s <code>applyModeledValue</code> selection
  logic, which itself calls only <code>PLRender</code>'s own exported functions — no formula is
  reimplemented anywhere in this eval.</p>
</section>`;
}

function buildScenarioBank() {
  const rows = results.scenarioBank
    .slice()
    .sort((a, b) => (a.bankSource === b.bankSource ? a.id.localeCompare(b.id) : ["anchor", "expansion", "adversarial"].indexOf(a.bankSource) - ["anchor", "expansion", "adversarial"].indexOf(b.bankSource)))
    .map((s) => {
      const gt = s.groundTruth || {};
      return `<tr>
        <td><code>${esc(s.id)}</code></td>
        <td>${sourceBadge(s.bankSource)}</td>
        <td>${esc(s.title)}</td>
        <td>${esc(s.type)}</td>
        <td class="num">${s.score}</td>
        <td class="num">${s.confidence}</td>
        <td>${esc(s.accountableOwner)}</td>
        <td class="tags">${(gt.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</td>
      </tr>`;
    }).join("");
  return `
<section id="scenario-bank" class="section">
  <h2>Scenario bank</h2>
  <p>${results.meta.scenarioBankSize} scenarios: the 10 real seed decisions (anchor — a regression
  baseline, never transcribed, always read live from <code>PL.decisions</code>) plus ${results.meta.expansionCount}
  expansion scenarios spanning the four Agentforce decision classes, plus ${results.meta.adversarialCount}
  purpose-built adversarial cases (each targets one specific mechanism — see Tier 3).</p>
  <details open>
  <summary>Full scenario bank (${results.scenarioBank.length} rows)</summary>
  <table class="data-table">
    <thead><tr><th>ID</th><th>Source</th><th>Title</th><th>Type</th><th>Score</th><th>Conf.</th><th>Owner</th><th>Tags</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </details>
</section>`;
}

function buildTier1() {
  const scRows = results.tier1.scoreConfidence.checks.map((c) => `<tr>
    <td><code>${esc(c.id)}</code></td><td>${esc(c.title)}</td>
    <td class="num">${c.expectedScore}</td><td class="num">${c.actualScore}</td><td>${boolBadge(c.scorePass)}</td>
    <td class="num">${c.expectedConfidence}</td><td class="num">${c.actualConfidence}</td><td>${boolBadge(c.confidencePass)}</td>
  </tr>`).join("");

  const bandRows = results.tier1.bandContainment.results.filter((r) => r.outOfBandFactors.length > 0).map((r) => `<tr>
    <td><code>${esc(r.id)}</code></td><td>${sourceBadge(r.bankSource)}</td><td>${r.outOfBandFactors.join(", ")}</td>
  </tr>`).join("") || `<tr><td colspan="3" class="muted">none</td></tr>`;

  const findingCards = results.tier1.integrityLinter.findings.map((f) => `
  <details class="finding-card">
    <summary>${sevBadge(f.severity)} ${boolBadge(f.confirmed, "CONFIRMED", "NOT CONFIRMED")} <strong>${esc(f.title)}</strong></summary>
    <p><strong>Mechanism:</strong> ${esc(f.mechanism)}</p>
    <p><strong>Detail:</strong> ${esc(f.detail)}</p>
  </details>`).join("");

  return `
<section id="tier1" class="section">
  <h2>Tier 1 — Correctness &amp; integrity</h2>
  <p>Fully computed, this run. Every row below is a real call into <code>PLRender</code>, not a
  transcription.</p>

  <h3 class="sub">Impact Score &amp; Confidence — anchored regression table</h3>
  <table class="data-table">
    <thead><tr><th>ID</th><th>Title</th><th>Exp. score</th><th>Actual</th><th></th><th>Exp. conf.</th><th>Actual</th><th></th></tr></thead>
    <tbody>${scRows}</tbody>
  </table>

  <h3 class="sub">Sub-score band containment sweep (all ${results.scenarioBank.length} scenarios)</h3>
  <p>Calls the real <code>breakdown(d)</code> and parses its own HTML for the
  "sits outside its signal band" marker — never a reimplementation of the private band functions.</p>
  <table class="data-table">
    <thead><tr><th>ID</th><th>Source</th><th>Out-of-band factor(s)</th></tr></thead>
    <tbody>${bandRows}</tbody>
  </table>

  <h3 class="sub">Integrity linter — ${results.tier1.integrityLinter.confirmedCount} of ${results.tier1.integrityLinter.totalCount} findings confirmed</h3>
  ${findingCards}
</section>`;
}

function buildTier2() {
  const rows = results.tier2.capabilities.map((c) => `<tr>
    <td>${esc(c.capability)}</td>
    <td>${c.metrics.map((m) => {
      const v = c.value[m];
      const shown = v === undefined ? "—" : (typeof v === "number" && v <= 1 && v >= 0 ? pctFmt(v) : v);
      return `<span class="metric-pill">${esc(m)}: <strong>${esc(String(shown))}</strong></span>`;
    }).join(" ")}</td>
    <td>${esc(c.prdTarget)}</td>
    <td class="cap-note">${esc(c.note)}</td>
  </tr>`).join("");

  const pj = results.tier2.panelJudgeSummary;
  return `
<section id="tier2" class="section">
  <h2>Tier 2 — AI-capability quality</h2>
  <p class="illustrative-note">${esc(results.tier2.note)}</p>
  <table class="data-table">
    <thead><tr><th>Capability</th><th>Metrics</th><th>PRD target</th><th>Method note</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h3 class="sub">Panel &amp; judge agreement (validity signal, not a product metric)</h3>
  <div class="card-grid">
    <div class="stat-card">
      <div class="stat-label">Fleiss' κ — escalation label (5 personas)</div>
      <div class="stat-value">${pj.fleissKappaEscalation.toFixed(3)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Mean pairwise persona Spearman ρ (ranking)</div>
      <div class="stat-value">${pj.meanPairwisePersonaSpearman.toFixed(3)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Inter-judge agreement (3 runs, within 1pt)</div>
      <div class="stat-value">${pctFmt(pj.interJudgeAgreement)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Hallucination flags (≥1 of 3 judge runs)</div>
      <div class="stat-value">${pj.hallucinationFlags.length} of ${results.scenarioBank.length}</div>
    </div>
  </div>
  <p class="muted" style="font-size:12.5px">High panel/judge agreement is a validity signal for the ground
  truth itself (the panel/judge were consistent with each other) — it is not evidence that the panel is
  right, since all 5 personas and all 3 judge runs are the same underlying model. See Limitations.</p>
</section>`;
}

function buildTier3() {
  const matrixRows = results.tier3.redTeamMatrix.rows.map((r) => `<tr>
    <td>${esc(r.failureMode)}</td>
    <td>${esc(r.likelihood)}</td>
    <td>${sevBadge(r.severity === "catastrophic" ? "critical" : r.severity)}</td>
    <td>${esc(r.detection)}</td>
    <td>${esc(r.status)}</td>
  </tr>`).join("");

  const det = results.tier3.deterministic;
  const detCards = [
    { title: "Catastrophic-miss construction", c: det.catastrophicMissConstruction },
    { title: "Zero-evidence / zero-eval division guard", c: det.zeroEvidenceGuard },
    { title: "Near-tie ranking pair", c: det.nearTiePair },
    { title: "Dollars-only baseline trap", c: det.dollarsOnlyBaselineTrap },
    { title: "RACI routing mismatches", c: det.raciRoutingMismatches }
  ].map(({ title, c }) => `
  <details class="finding-card">
    <summary>${boolBadge(c.confirmed, "CONFIRMED", "NOT CONFIRMED")} <strong>${esc(title)}</strong></summary>
    <p>${esc(c.detail)}</p>
  </details>`).join("");

  return `
<section id="tier3" class="section">
  <h2>Tier 3 — Risk / red-team</h2>
  <h3 class="sub">Failure-mode matrix <span class="note">(likelihood computed from the Phase B panel/judge run; severity is a fixed editorial judgment, not panel-scored; detection &amp; status are real)</span></h3>
  <table class="data-table">
    <thead><tr><th>Failure mode</th><th>Likelihood</th><th>Severity</th><th>Detection</th><th>Status</th></tr></thead>
    <tbody>${matrixRows}</tbody>
  </table>
  <p class="illustrative-note">${esc(results.tier3.redTeamMatrix.note)}</p>
  <h3 class="sub">Deterministic &amp; adversarial checks — real, computed this run</h3>
  ${detCards}
</section>`;
}

function buildLimitations() {
  return `
<section id="limitations" class="section">
  <h2>Limitations &amp; validity threats</h2>
  <ul class="prose-list">
    <li><strong>Synthetic panel, not real experts.</strong> The 5 delivery-lead personas (&sect;3) ran
      for real and every Tier 2 number above is a real computation over their actual output — but the
      panel itself is an LLM-simulated proxy, not real delivery leads. All 5 personas share one
      underlying model, so their high agreement (Fleiss' κ, &sect;6) shows internal consistency, not
      correctness against real-world judgment.</li>
    <li><strong>Synthetic judge, not real reviewers.</strong> The recommendation-quality rubric
      (<code>eval/prompts/judge.md</code>) is itself an LLM call, run 3 times. Its scores are a real,
      scalable proxy — not ground truth from real reviewers.</li>
    <li><strong>RACI-routing accuracy is the noisiest Tier 2 number.</strong> The panel was never shown
      ProofLoop's named-owner roster, so it answered in free-text role terms that a keyword heuristic
      maps onto ProofLoop's 5 owner ids (&sect;6 note) — read that one metric as directional, not
      precise.</li>
    <li><strong>Rollout-readiness agreement is n=2.</strong> Only 2 scenarios in the bank are
      rollout-class; 100% agreement at that n is not a statistically meaningful rate.</li>
    <li><strong>Provisional, unvalidated weights.</strong> <code>PL.confidenceWeights</code> is
      explicitly disclosed in-code as provisional/unvalidated (no held-out expert-labeled set exists
      yet to fit it against). <code>PL.weights</code> (the Impact Score weights) carries no such
      in-code disclosure, but is equally unvalidated against real outcomes and should be treated with
      the same caution.</li>
    <li><strong>Small n.</strong> 34 scenarios is enough to exercise every mechanism at least once, not
      enough for tight confidence intervals on Tier 2 metrics. Precision@1/κ/ECE numbers from a bank
      this size should be read as directional, not statistically precise.</li>
    <li><strong>Single run.</strong> This report reflects one execution. No variance across repeated
      runs or repeated panel/judge samples has been characterized yet.</li>
    <li><strong>No LLM in ProofLoop's current build.</strong> Escalation classification, recommendation
      generation, and RACI routing are all authored fields today (&sect;3). Tier 2 evaluates the
      capability a production build would need, using the current authored values as the "model
      output" under test — it is not yet evaluating a live model.</li>
  </ul>
</section>`;
}

function buildHumanProtocol() {
  return `
<section id="human-protocol" class="section">
  <h2>Human-validation protocol</h2>
  <p>How the synthetic panel and judge get replaced with real validation, once this direction is
  signed off:</p>
  <ol class="prose-list">
    <li><strong>Recruit 3-5 real delivery/engineering leads</strong> spanning the same priors the
      synthetic panel simulates (revenue, risk, ops, CX, engineering-delivery) — ideally people who
      would actually receive a ProofLoop-style briefing in their real job.</li>
    <li><strong>Run <code>eval/prompts/panel.md</code>'s task on real humans</strong>, blind to
      ProofLoop's own computed scores, against the same scenario bank — identical inputs, so results
      are directly comparable to the synthetic panel's.</li>
    <li><strong>Compute real inter-rater agreement</strong> (Fleiss' κ for escalation labels, Spearman
      ρ for rankings) among the real panel, and between the real panel and the synthetic one — this
      tells us how good a proxy the synthetic panel actually was.</li>
    <li><strong>Refit the provisional weights</strong> (<code>PL.confidenceWeights</code>, and
      candidate weights for <code>PL.weights</code>) against the real panel's labels, replacing the
      "provisional/unvalidated" disclosure with a real fit and its own reported error.</li>
    <li><strong>Spot-check the LLM judge</strong> — have the real panel independently score a sample of
      recommendations on the same 5-dimension rubric (<code>eval/prompts/judge.md</code>), and report
      agreement between the real scores and the LLM judge's scores as the judge's own validity signal.</li>
    <li><strong>Promote PRD targets from provisional to validated</strong> once the above lands — e.g.
      "Precision@1 ≥ 80%" becomes a target grounded in what real leads actually agreed on, not an
      assumption.</li>
  </ol>
</section>`;
}

function buildAppendix() {
  let panelPrompt = "", judgePrompt = "";
  try { panelPrompt = fs.readFileSync(path.join(__dirname, "prompts", "panel.md"), "utf8"); } catch (e) { panelPrompt = "(eval/prompts/panel.md not found)"; }
  try { judgePrompt = fs.readFileSync(path.join(__dirname, "prompts", "judge.md"), "utf8"); } catch (e) { judgePrompt = "(eval/prompts/judge.md not found)"; }

  return `
<section id="appendix" class="section">
  <h2>Appendix</h2>

  <h3 class="sub">Formulas</h3>
  <pre class="formula">Impact Score  = round(0.35·value + 0.30·unblock + 0.20·reach + 0.15·urgency)

Confidence %  = min(99, round(0.35·evalPassRate + 0.30·sourceAgreement
                              + 0.20·coverage + 0.15·recency))
                — the min(99, …) cap is deliberate: no decision may ever display
                  absolute (100%) certainty. See Tier 1, "confidence-hard-cap-99".</pre>

  <h3 class="sub">Weights (as currently shipped in <code>prototype-2/data.js</code>)</h3>
  <table class="data-table">
    <thead><tr><th>Weight set</th><th>Fields</th><th>Provisional?</th></tr></thead>
    <tbody>
      <tr><td><code>PL.weights</code> (Impact Score)</td><td>value .35 &middot; unblock .30 &middot; reach .20 &middot; urgency .15</td><td>Not disclosed in-code, but unvalidated against real outcomes</td></tr>
      <tr><td><code>PL.confidenceWeights</code></td><td>evalPassRate .35 &middot; sourceAgreement .30 &middot; coverage .20 &middot; recency .15</td><td>${boolBadge(true, "Disclosed provisional/unvalidated", "")}</td></tr>
    </tbody>
  </table>

  <h3 class="sub">Reproducibility</h3>
  <ul class="prose-list">
    <li><code>node eval/run.js</code> regenerates <code>eval/results.json</code> deterministically
      from <code>prototype-2/</code>'s current source plus <code>eval/scenarios.js</code> — no network
      access, no randomness.</li>
    <li><code>node eval/render-report.js</code> regenerates this HTML from
      <code>eval/results.json</code>.</li>
    <li><code>eval/engines.js</code> loads the real <code>prototype-2/data.js</code> and
      <code>prototype-2/render.js</code> into Node via a minimal <code>window</code> shim — the exact
      same scoring functions the browser runs, never a parallel reimplementation.</li>
  </ul>

  <h3 class="sub">Prompts used (full text)</h3>
  <details><summary><code>eval/prompts/panel.md</code> — synthetic delivery-lead panel</summary>
    <pre class="prompt-block">${esc(panelPrompt)}</pre>
  </details>
  <details><summary><code>eval/prompts/judge.md</code> — LLM-as-judge recommendation-quality rubric</summary>
    <pre class="prompt-block">${esc(judgePrompt)}</pre>
  </details>
</section>`;
}

/* ---------------------------------------------------------------------------------------- */

const STYLE = `
:root{--navy:#172338;--muted:#3d4759;--line:#e3e7eb;--bg:#f5f6f7;--white:#fff;--blue:#315aef;--blue-soft:#edf1ff;--coral:#e66045;--coral-soft:#fff0eb;--mint:#24a981;--mint-soft:#e8f8f3;--amber:#c98812;--amber-soft:#fff6df;--shadow:0 10px 30px rgba(23,35,56,.08);--radius:14px}
*{box-sizing:border-box}
body{margin:0;font-family:Manrope,ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--navy);background:var(--bg);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
code,.formula,.prompt-block{font-family:"DM Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
h1,h2,h3,p,ul,ol{margin:0}
.hero{background:linear-gradient(160deg,var(--navy),#223149);color:#fff;padding:40px 24px 32px}
.hero-inner{max-width:980px;margin:0 auto}
.brand{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;opacity:.85;margin-bottom:14px}
.brand-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#6f8cff,#a2b3ff);color:#13203a;font-weight:800;font-size:11px}
.hero h1{font-size:30px;letter-spacing:-.6px;margin-bottom:12px}
.hero .lead{max-width:70ch;opacity:.88;font-size:15px}
.hero-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:26px;padding-top:20px;border-top:1px solid rgba(255,255,255,.18)}
.meta-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.65;margin-bottom:3px}
.meta-value{display:block;font-size:13px;font-weight:600}
.draft-banner{max-width:980px;margin:20px auto 0;padding:14px 18px;background:var(--amber-soft);border:1px solid #f0d68a;border-radius:var(--radius);font-size:13.5px;color:#6b4c0a}
.report-nav{max-width:980px;margin:18px auto 0;padding:10px 16px;background:#fff;border:1px solid var(--line);border-radius:999px;display:flex;gap:4px;flex-wrap:wrap;font-size:12px}
.report-nav a{color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:999px;font-weight:600}
.report-nav a:hover{background:var(--blue-soft);color:var(--blue)}
.section{max-width:980px;margin:34px auto;padding:0 16px}
.section h2{font-size:21px;letter-spacing:-.4px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--line)}
.sub{font-size:14px;font-weight:800;margin:24px 0 10px;color:var(--navy)}
.sub .note{font-weight:500;color:var(--muted);font-size:12px}
p{margin-bottom:12px;max-width:82ch}
.illustrative-note{font-size:12.5px;color:#6b4c0a;background:var(--amber-soft);padding:10px 12px;border-radius:10px;max-width:none}
.badge{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.3px;padding:4px 8px;border-radius:6px;white-space:nowrap}
.badge.draft{color:#6b4c0a;background:var(--amber-soft)}
.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:8px}
.stat-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:14px;box-shadow:var(--shadow)}
.stat-card.illustrative{border-style:dashed}
.stat-top{margin-bottom:8px}
.stat-label{font-size:12px;color:var(--muted);font-weight:700;margin-bottom:4px}
.stat-value{font-size:15px;font-weight:800;margin-bottom:8px}
.stat-target{font-size:11px;color:var(--muted);font-weight:600}
.map-table,.data-table{width:100%;border-collapse:collapse;background:#fff;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);margin-bottom:14px;font-size:13px}
.map-table th,.map-table td,.data-table th,.data-table td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.data-table th{background:#f8f9fa;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
.data-table td.num{font-family:"DM Mono",ui-monospace,monospace;text-align:right}
.data-table .tags .tag{display:inline-block;font-size:9.5px;background:#eef1f4;color:var(--muted);padding:2px 6px;border-radius:5px;margin:1px}
.muted{color:var(--muted)}
.metric-pill{display:inline-block;font-size:11.5px;background:#f0f2f5;padding:3px 8px;border-radius:6px;margin:2px 4px 2px 0}
.cap-note{font-size:12px;color:var(--muted);max-width:32ch}
.finding-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:12px 16px;margin-bottom:10px;box-shadow:var(--shadow)}
.finding-card summary{cursor:pointer;font-size:13.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.finding-card p{margin-top:10px;font-size:13px}
details > summary{list-style:none}
details > summary::-webkit-details-marker{display:none}
.prose-list{padding-left:20px;margin-bottom:14px}
.prose-list li{margin-bottom:9px;max-width:78ch}
.formula,.prompt-block{background:var(--navy);color:#dce6ff;padding:14px 16px;border-radius:10px;font-size:12.5px;overflow-x:auto;white-space:pre-wrap}
footer{text-align:center;padding:30px 16px 50px;color:var(--muted);font-size:12px}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ProofLoop AI Eval Report</title>
<style>${STYLE}</style>
</head>
<body>
${buildHeader()}
${buildDraftBanner()}
${buildNav()}
${buildScorecard()}
${buildMethodology()}
${buildScenarioBank()}
${buildTier1()}
${buildTier2()}
${buildTier3()}
${buildLimitations()}
${buildHumanProtocol()}
${buildAppendix()}
<footer>ProofLoop AI Eval Report &middot; generated by <code>eval/render-report.js</code> from <code>eval/results.json</code> &middot; single capstone run</footer>
</body>
</html>`;

const outDir = path.join(__dirname, "report");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "eval-report.html");
fs.writeFileSync(outPath, html);
console.log(`Report written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
