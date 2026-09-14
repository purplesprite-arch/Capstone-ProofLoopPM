# Calibrated Confidence (§4.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-authored `recommendation.confidence` numbers and the free-text `evidenceMap.detail.confidence` string in `prototype-2/` with one computed, inspectable confidence formula — mirroring the "honest arithmetic" pattern the Impact Score already uses — so every confidence value shown anywhere in the app is reproducible from visible inputs.

**Architecture:** Add a small pure-function "confidence engine" to `render.js` (parallel to the existing `score()`/`contributions()`/`breakdown()` functions for the Impact Score), fed by new structured fields on each decision (and on `evidenceMap.detail`) in `data.js`. Wire the two existing display sites — Brief detail's confidence bar and the Evidence Map detail panel — to call the engine instead of reading an authored number, and make "How confidence works" open a real breakdown modal (reusing the existing modal + `.breakdown`/`.bd-*` CSS already built for the Impact Score) instead of a static toast description.

**Tech Stack:** Vanilla HTML/CSS/JS, no framework, no build, no package.json, no test runner — the prototype is intentionally dependency-free so it opens via `file://`. This plan does not introduce Jest/Vitest/etc. Verification steps use the browser console against the already-loaded `window.PL` / `window.PLRender` globals instead of an automated test suite.

**Spec:** [`docs/ProofLoop PRD v1.md`](../../ProofLoop%20PRD%20v1.md), §4.7 "Calibrated confidence" (lines 113–129), cross-referenced with §4.2 (Impact Score, the pattern being mirrored), §4.4 (Brief detail, the primary display site), §7 (risk table), §8 Q1 (weights are explicitly open).

## Global Constraints

- **No test framework.** "Write the failing test" steps below mean: write a short browser-console check against `window.PL`/`window.PLRender`, note the expected output inline, and confirm it manually. Do not add Jest, Vitest, npm, or a `package.json` — that would break the "double-click `index.html`, no build step" constraint stated in `prototype-2/README.md`.
- **No black box.** Every confidence value must be traceable to visible inputs (PRD §4.7 acceptance). Never hardcode a final confidence number in `data.js` again — always compute it from `confidenceInputs` + the evidence/sources array.
- **Reuse the Impact Score's pattern, don't reinvent it.** The confidence breakdown UI reuses the existing `.breakdown` / `.bd-row` / `.bd-name` / `.bd-bar` / `.bd-math` / `.bd-prov` / `.bd-band` / `.bd-stack` / `.bd-total` / `.bd-note` CSS classes already defined for the Impact Score (`prototype-2/styles.css:469-491`). Only new CSS needed is four `.seg-*` stacked-bar segment colors.
- **Weights are provisional, and must say so.** `w1..w4` are an open question per PRD §8 Q1 — there is no held-out expert-labeled set to fit them against in this capstone. Ship a documented placeholder split (`0.35 / 0.30 / 0.20 / 0.15`, matching the order in the PRD's strawman formula) with an explicit "provisional/unvalidated" comment in code and a matching sentence in the breakdown's UI copy. Do not present the weights as final anywhere in code or copy.
- **`PL.rollout.confidence` is explicitly out of scope for this pass.** The Rollout arc (Value Showcase / Pilot planner) is a Next-phase feature (PRD §5); only `recommendation.confidence` (§4.4, MVP) and `evidenceMap.detail.confidence` (§4.7's explicit normalization callout) get migrated. Do not touch `prototype-2/render.js`'s `showcase()` function or `PL.rollout.confidence`.
- **Every decision gets real `confidenceInputs`,** including the three informative/FYI decisions that have no `evidence` array today (`d-intent-routing`, `d-refund-knowledge`, `d-tone-tweak`) and `d-billing-golive` (whose Brief detail page is currently unreachable because `isRollout` routes it to the Showcase instead — it still needs real inputs so calling the confidence engine on it never throws).
- **`recency` uses band-based scoring, not a continuous curve** — three bands (`fresh` ≤7 days, `recent` ≤30 days, `stale` >30 days) mapped to fixed scores (100 / 70 / 30), so recency gets the same "computed number + inspectable band chip" treatment as everything else, without inventing a decay curve the spec never specified.

---

### Task 1: Confidence compute engine (pure functions, no UI wiring yet)

**Files:**
- Modify: `prototype-2/data.js` (add `confidenceWeights`, `confidenceWeightMeta`, `today.nowIso`)
- Modify: `prototype-2/render.js` (add the confidence engine functions; export from `window.PLRender`)

**Interfaces:**
- Consumes: nothing new — reads `PL.confidenceWeights`, `PL.confidenceWeightMeta`, `PL.today.nowIso` (added in this task).
- Produces (used by Tasks 2–4): `confidenceScore(o)`, `confidenceBreakdown(o)`, `confidenceContributions(o)` — all take one object `o` that has `o.confidenceInputs = { eval: {passed,total}, coverage: {linked,total}, mostRecentAt: isoString }` and either `o.evidence` or `o.sources` (an array of `{claim: "confirmed"|"observed"|"contradicts", ...}`). Exported on `window.PLRender` as `confidenceScore`, `confidenceBreakdown`.

- [ ] **Step 1: Add confidence weights, weight metadata, and a "now" reference timestamp to `data.js`**

Add this block immediately after the existing `weightMeta` block (`prototype-2/data.js`, after line 20):

```js
  // Calibrated-confidence weights (PRD §4.7). PROVISIONAL / UNVALIDATED — §8 Q1 flags these
  // as an open question pending a held-out set of expert-assigned confidence to fit against,
  // which doesn't exist in this capstone. Ship inspectable, not asserted as final.
  // confidence = round(w1·evalPassRate + w2·sourceAgreement + w3·coverage + w4·recency)
  confidenceWeights: { evalPassRate: 0.35, sourceAgreement: 0.30, coverage: 0.20, recency: 0.15 },
  confidenceWeightMeta: {
    evalPassRate:    { label: "Eval pass rate",   hint: "Share of relevant eval cases passed" },
    sourceAgreement: { label: "Source agreement", hint: "Evidence that confirms vs. contradicts" },
    coverage:        { label: "Coverage",         hint: "Claims backed by a linked source" },
    recency:         { label: "Recency",          hint: "Freshness of the latest supporting run" }
  },
```

Then update the existing `today` line (`prototype-2/data.js:11`):

Old:
```js
  today: { label: "Monday, September 7", greetingName: "Maya" },
```

New:
```js
  today: { label: "Monday, September 7", greetingName: "Maya", nowIso: "2026-09-07T09:50:00" },
```

- [ ] **Step 2: Verify the new data loads**

Open `prototype-2/index.html` in a browser (double-click, or serve per the README), open devtools console, and run:

```js
PL.confidenceWeights.evalPassRate + PL.confidenceWeights.sourceAgreement + PL.confidenceWeights.coverage + PL.confidenceWeights.recency
```

Expected: `1` (weights must sum to 1 — if they don't, the composite isn't a true weighted average).

- [ ] **Step 3: Add the confidence engine to `render.js`**

Insert this new section directly after the existing `breakdown(d)` function and its closing `}` (`prototype-2/render.js`, after line 140, before the `/* ---------- RACI ---------- */` comment):

```js
  /* ---------- calibrated confidence (§4.7) ----------
     Mirrors the Impact Score's honest-arithmetic pattern: a visible composite
     (sub × weight = contribution) plus a band-based provenance chip per factor.
     Unlike the Impact Score, no sub-score here is hand-authored — every factor
     is computed straight from confidenceInputs + the evidence/sources array. */
  function evidenceList(o) {
    return o.evidence || o.sources || [];
  }
  function pct(n, total) {
    return total ? Math.round((n / total) * 100) : 0;
  }
  function sourceAgreementPct(list) {
    if (!list.length) return 0;
    const agreeing = list.filter((s) => s.claim === "confirmed" || s.claim === "observed").length;
    return Math.round((agreeing / list.length) * 100);
  }
  function daysBetween(fromIso, toIso) {
    return Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 86400000));
  }
  function recencyBand(daysAgo) {
    if (daysAgo <= 7) return { name: "fresh", score: 100 };
    if (daysAgo <= 30) return { name: "recent", score: 70 };
    return { name: "stale", score: 30 };
  }

  function confidenceFactors(o) {
    const inputs = o.confidenceInputs;
    const sources = evidenceList(o);
    const daysAgo = daysBetween(inputs.mostRecentAt, PL.today.nowIso);
    const band = recencyBand(daysAgo);
    return {
      evalPassRate: pct(inputs.eval.passed, inputs.eval.total),
      sourceAgreement: sourceAgreementPct(sources),
      coverage: pct(inputs.coverage.linked, inputs.coverage.total),
      recency: band.score,
      daysAgo,
      band
    };
  }

  function confidenceScore(o) {
    const w = PL.confidenceWeights;
    const f = confidenceFactors(o);
    return Math.round(w.evalPassRate * f.evalPassRate + w.sourceAgreement * f.sourceAgreement + w.coverage * f.coverage + w.recency * f.recency);
  }

  function confidenceContributions(o) {
    const w = PL.confidenceWeights;
    const f = confidenceFactors(o);
    return Object.keys(w)
      .map((k) => ({ key: k, sub: f[k], contrib: +(w[k] * f[k]).toFixed(1), weight: w[k] }))
      .sort((a, b) => b.contrib - a.contrib);
  }

  function confidenceProvenance(key, o, f) {
    const inputs = o.confidenceInputs;
    const sources = evidenceList(o);
    if (key === "evalPassRate") return `${inputs.eval.passed} of ${inputs.eval.total} eval cases passed`;
    if (key === "sourceAgreement") {
      const agreeing = sources.filter((s) => s.claim === "confirmed" || s.claim === "observed").length;
      return `${agreeing} of ${sources.length} sources confirm or observe this`;
    }
    if (key === "coverage") return `${inputs.coverage.linked} of ${inputs.coverage.total} claims are source-linked`;
    if (key === "recency") return `latest supporting run was ${f.daysAgo} day${f.daysAgo === 1 ? "" : "s"} ago`;
    return "";
  }

  function confidenceBreakdown(o) {
    const total = confidenceScore(o);
    const f = confidenceFactors(o);
    const rows = confidenceContributions(o)
      .map((c) => {
        const meta = PL.confidenceWeightMeta[c.key];
        const bandChip = c.key === "recency" ? `<b class="bd-band">${f.band.name} band</b>` : "";
        return `<div class="bd-row">
            <span class="bd-name">${meta.label}<em>${meta.hint}</em></span>
            <span class="bd-bar"><i style="width:${c.sub}%"></i></span>
            <span class="bd-math">${c.sub} × ${c.weight.toFixed(2)} = <b>${c.contrib}</b></span>
            <span class="bd-prov">${bandChip}<span>${confidenceProvenance(c.key, o, f)}</span></span>
          </div>`;
      })
      .join("");
    const segs = confidenceContributions(o)
      .map((c) => `<i class="seg-${c.key}" style="width:${c.contrib}%" title="${PL.confidenceWeightMeta[c.key].label}: ${c.contrib}"></i>`)
      .join("");
    return `<div class="breakdown">
        <div class="bd-total"><span>Confidence</span><b>${total}<small>/100</small></b></div>
        <div class="bd-stack">${segs}</div>
        <div class="bd-rows">${rows}</div>
        <p class="bd-note">Confidence is computed from this decision's own evidence — eval pass rate, source agreement, coverage, and recency — not asserted. Weights are provisional, pending validation against expert-assigned confidence on a held-out set (PRD §8).</p>
      </div>`;
  }
```

- [ ] **Step 4: Export the new functions**

Update the export line at the bottom of `prototype-2/render.js` (currently line 523):

Old:
```js
  window.PLRender = { icon, score, today, decisions, agents, evidence, memory, brief, showcase, pilot, breakdown, whyLine };
```

New:
```js
  window.PLRender = { icon, score, today, decisions, agents, evidence, memory, brief, showcase, pilot, breakdown, whyLine, confidenceScore, confidenceBreakdown };
```

- [ ] **Step 5: Verify the engine end-to-end with a hand-computable example**

This is the "test" for this task — a manual console check standing in for an automated unit test (see Global Constraints). Reload `prototype-2/index.html`, open the console, and run:

```js
PLRender.confidenceScore({
  evidence: [
    { claim: "confirmed" }, { claim: "observed" }, { claim: "contradicts" }, { claim: "confirmed" }
  ],
  confidenceInputs: {
    eval: { passed: 23, total: 24 },
    coverage: { linked: 4, total: 4 },
    mostRecentAt: "2026-09-07T09:42:00"
  }
})
```

Expected: `91`.

Hand-check: evalPassRate = round(23/24×100) = 96; sourceAgreement = round(3/4×100) = 75 (3 of 4 claims are `confirmed`/`observed`); coverage = round(4/4×100) = 100; recency = 0 days ago → `fresh` band → 100. `round(0.35×96 + 0.30×75 + 0.20×100 + 0.15×100)` = `round(33.6 + 22.5 + 20 + 15)` = `round(91.1)` = **91**. If the console doesn't print `91`, stop and debug before continuing — every later task depends on this arithmetic being right.

- [ ] **Step 6: Commit**

```bash
git add prototype-2/data.js prototype-2/render.js
git commit -m "feat: add calibrated-confidence compute engine (§4.7)"
```

---

### Task 2: Author real confidenceInputs for every decision + evidenceMap.detail; remove hand-authored confidence

**Files:**
- Modify: `prototype-2/data.js`

**Interfaces:**
- Consumes: `confidenceScore`/`confidenceBreakdown` contract from Task 1 (`o.confidenceInputs` + `o.evidence`/`o.sources`).
- Produces: every decision in `PL.decisions` and `PL.evidenceMap.detail` now has `confidenceInputs`; no object in `data.js` has a hand-authored `confidence` number anymore (except `PL.rollout.confidence`, which stays per Global Constraints).

- [ ] **Step 1: `d-escalation` — add `confidenceInputs`, remove `recommendation.confidence`**

Old (`prototype-2/data.js`, inside the `d-escalation` object):
```js
      recommendation: {
        choice: "approve",
        headline: "Approve with a 30-second handoff guardrail.",
        rationale: "v2.4 improves escalation clarity in 23 of 24 scenarios. One edge case delays human transfer past the promise. A hard 30-second timeout keeps the clarity gains without breaking the commitment.",
        confidence: 92
      },
```

New:
```js
      recommendation: {
        choice: "approve",
        headline: "Approve with a 30-second handoff guardrail.",
        rationale: "v2.4 improves escalation clarity in 23 of 24 scenarios. One edge case delays human transfer past the promise. A hard 30-second timeout keeps the clarity gains without breaking the commitment."
      },
      confidenceInputs: {
        eval: { passed: 23, total: 24 },       // matches the "23 of 24 cases passed" evidence note below
        coverage: { linked: 4, total: 4 },     // all 4 evidence entries backing this decision are source-linked
        mostRecentAt: "2026-09-07T09:42:00"    // matches the "run Sep 7, 09:42" evidence note below
      },
```

- [ ] **Step 2: `d-billing-golive` — add `evidence` + `confidenceInputs`, remove `recommendation.confidence`**

This decision's Brief detail page is currently unreachable (`isRollout: true` routes it to the Showcase instead), so it has no `evidence`/`goals`/`diff` today. It still needs real inputs so the engine never throws if this ever changes.

Old:
```js
      raci: { r: ["andrew-aasen", "sam-tan"], a: "maya-okonkwo", c: ["nadia-chen"], i: ["legal"] },
      delegateTo: "nadia-chen",
      severity: "Rollout gate",
      isRollout: true,   // routes to the Value Showcase → Pilot planner instead of the standard brief
      recommendation: {
        choice: "approve",
        headline: "Approve a 5% pilot with staged expansion.",
        rationale: "Across 6 weeks in shadow mode the agent beat the human baseline on deflection and handle time while holding CSAT. Guardrails and rollback triggers are in place for a limited pilot.",
        confidence: 87
      },
      openedMinsAgo: 42
    },
```

New:
```js
      raci: { r: ["andrew-aasen", "sam-tan"], a: "maya-okonkwo", c: ["nadia-chen"], i: ["legal"] },
      delegateTo: "nadia-chen",
      severity: "Rollout gate",
      isRollout: true,   // routes to the Value Showcase → Pilot planner instead of the standard brief
      recommendation: {
        choice: "approve",
        headline: "Approve a 5% pilot with staged expansion.",
        rationale: "Across 6 weeks in shadow mode the agent beat the human baseline on deflection and handle time while holding CSAT. Guardrails and rollback triggers are in place for a limited pilot."
      },
      evidence: [
        { kind: "eval", title: "Pre-launch eval battery", note: "412 billing scenarios · 94% resolved correctly.", claim: "observed" },
        { kind: "doc",  title: "Refund policy grounding", note: "All refund logic linked to approved policy v2.1.", claim: "confirmed" },
        { kind: "eval", title: "Shadow-mode comparison", note: "Beat human baseline on 3 of 4 KPIs over 6 weeks.", claim: "observed" }
      ],
      confidenceInputs: {
        eval: { passed: 387, total: 412 },     // 94% of 412 pre-launch scenarios resolved correctly
        coverage: { linked: 3, total: 3 },     // all 3 evidence sources behind the go/no-go are source-linked
        mostRecentAt: "2026-09-06T00:00:00"    // shadow-mode comparison closed out the day before go/no-go
      },
      openedMinsAgo: 42
    },
```

- [ ] **Step 3: `d-repeat-threshold` — add an eval evidence entry + `confidenceInputs`, remove `recommendation.confidence`**

Old:
```js
      recommendation: {
        choice: "approve",
        headline: "Set the limit at 2 repeat attempts, then force a human handoff.",
        rationale: "Two attempts covers 96% of successful self-resolutions in the logs. Beyond that, resolution rate falls and frustration signals rise. A hard cap closes the open evidence gap and unblocks the routing work.",
        confidence: 78
      },
      goals: [
        { title: "Human handoff within 30 seconds", note: "A cap keeps repeat loops from delaying escalation.", dir: "up" },
        { title: "Contain 65% of tier-1 requests", note: "Marginal containment loss past 2 attempts is minimal.", dir: "flat" }
      ],
      evidence: [
        { kind: "eval",     title: "Self-resolution log analysis", note: "96% of successful resolutions happen within 2 attempts.", claim: "observed" },
        { kind: "conflict", title: "Coverage gap EG-03", note: "No approved threshold for repeat escalation attempts.", claim: "contradicts" }
      ],
```

New:
```js
      recommendation: {
        choice: "approve",
        headline: "Set the limit at 2 repeat attempts, then force a human handoff.",
        rationale: "Two attempts covers 96% of successful self-resolutions in the logs. Beyond that, resolution rate falls and frustration signals rise. A hard cap closes the open evidence gap and unblocks the routing work."
      },
      goals: [
        { title: "Human handoff within 30 seconds", note: "A cap keeps repeat loops from delaying escalation.", dir: "up" },
        { title: "Contain 65% of tier-1 requests", note: "Marginal containment loss past 2 attempts is minimal.", dir: "flat" }
      ],
      evidence: [
        { kind: "eval",     title: "Self-resolution log analysis", note: "96% of successful resolutions happen within 2 attempts.", claim: "observed" },
        { kind: "conflict", title: "Coverage gap EG-03", note: "No approved threshold for repeat escalation attempts.", claim: "contradicts" },
        { kind: "eval",     title: "Repeat-cap simulation", note: "Simulated a 2-attempt cap against 90 days of logs — 187 of 194 sessions matched the target resolution behavior.", claim: "observed" }
      ],
      confidenceInputs: {
        eval: { passed: 187, total: 194 },     // repeat-cap simulation result
        coverage: { linked: 1, total: 2 },     // the open coverage gap (EG-03) is exactly one of two claims still unlinked
        mostRecentAt: "2026-08-28T00:00:00"    // the log analysis predates today by about 10 days
      },
```

- [ ] **Step 4: `d-intent-routing` (informative) — add `evidence` + `confidenceInputs`, remove `recommendation.confidence`**

Old:
```js
      raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 2h",
      recommendation: { choice: "approve", headline: "Advancing under approved routing policy.", rationale: "", confidence: 96 }
    },
```

New:
```js
      raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 2h",
      recommendation: { choice: "approve", headline: "Advancing under approved routing policy.", rationale: "" },
      evidence: [
        { kind: "eval", title: "Intent routing regression suite", note: "142 of 142 cases passed · run Sep 7, 07:10.", claim: "observed" },
        { kind: "doc",  title: "Routing policy v1.3", note: "Matches approved routing policy — no scope change.", claim: "confirmed" }
      ],
      confidenceInputs: {
        eval: { passed: 142, total: 142 },
        coverage: { linked: 2, total: 2 },
        mostRecentAt: "2026-09-07T07:10:00"
      }
    },
```

- [ ] **Step 5: `d-refund-knowledge` (informative) — add `evidence` + `confidenceInputs`, remove `recommendation.confidence`**

Old:
```js
      raci: { r: ["priya-rao"], a: "nadia-chen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 4h",
      recommendation: { choice: "approve", headline: "Advancing — grounded in approved sources.", rationale: "", confidence: 94 }
    },
```

New:
```js
      raci: { r: ["priya-rao"], a: "nadia-chen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 4h",
      recommendation: { choice: "approve", headline: "Advancing — grounded in approved sources.", rationale: "" },
      evidence: [
        { kind: "doc", title: "Refund policy v2.1", note: "12 new refund examples added, all linked to approved policy.", claim: "confirmed" }
      ],
      confidenceInputs: {
        eval: { passed: 12, total: 12 },       // all 12 new examples verified against policy
        coverage: { linked: 12, total: 12 },   // matches the "100% sourced" headline metric
        mostRecentAt: "2026-09-07T06:30:00"
      }
    },
```

- [ ] **Step 6: `d-tone-tweak` (informative) — add `evidence` + `confidenceInputs`, remove `recommendation.confidence`**

Old:
```js
      raci: { r: ["andrew-aasen"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 6h",
      recommendation: { choice: "approve", headline: "Advancing — no behavioral change.", rationale: "", confidence: 91 }
    }
  ],
```

New:
```js
      raci: { r: ["andrew-aasen"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 6h",
      recommendation: { choice: "approve", headline: "Advancing — no behavioral change.", rationale: "" },
      evidence: [
        { kind: "doc", title: "Tone style guide v1.2", note: "8 of 8 sample responses reviewed — warmer phrasing, no policy or claim changes.", claim: "confirmed" }
      ],
      confidenceInputs: {
        eval: { passed: 8, total: 8 },
        coverage: { linked: 1, total: 1 },
        mostRecentAt: "2026-08-29T00:00:00"    // slightly older review pass — lands in the "recent" band, not "fresh"
      }
    }
  ],
```

- [ ] **Step 7: `evidenceMap.detail` — add `confidenceInputs`, remove the free-text `confidence` string**

This is the "one more gap to close" the PRD calls out by name: `evidenceMap.detail.confidence` today is a pre-formatted string (`"High · 96%"`) in a different shape than the recommendation confidence. Normalize it to the same computed format.

Old (`prototype-2/data.js`, inside `evidenceMap.detail`):
```js
    detail: {
      badge: "Confirmed requirement",
      title: "Human escalation within 30 seconds",
      body: "When the agent detects a high-risk intent or fails twice, it must transfer the customer to a human queue within 30 seconds.",
      owner: "Nadia Chen", confidence: "High · 96%", verified: "Sep 7, 2026",
      sources: [
```

New:
```js
    detail: {
      badge: "Confirmed requirement",
      title: "Human escalation within 30 seconds",
      body: "When the agent detects a high-risk intent or fails twice, it must transfer the customer to a human queue within 30 seconds.",
      owner: "Nadia Chen", verified: "Sep 7, 2026",
      confidenceInputs: {
        eval: { passed: 23, total: 24 },
        coverage: { linked: 47, total: 47 },   // the Evidence Steward's "47 of 47 claims source-linked" finding
        mostRecentAt: "2026-09-07T09:42:00"
      },
      sources: [
```

- [ ] **Step 8: Verify every decision + evidenceMap.detail computes without throwing**

In the browser console:

```js
[...PL.decisions, PL.evidenceMap.detail].map(o => {
  try { return PLRender.confidenceScore(o); }
  catch (e) { return "ERROR: " + o.id + " — " + e.message; }
})
```

Expected: an array of 7 numbers between 0 and 100, no `"ERROR"` strings. Spot-check `d-escalation`'s result is `91` (same as Task 1 Step 5's hand-check, since it uses the same numbers) and `evidenceMap.detail`'s result is `91` too (same underlying eval run, different coverage denominator that happens to still be 100%).

- [ ] **Step 9: Commit**

```bash
git add prototype-2/data.js
git commit -m "feat: author real confidenceInputs for every decision (§4.7)"
```

---

### Task 3: Wire Brief detail (§4.4) to the computed confidence + a real breakdown modal

**Files:**
- Modify: `prototype-2/render.js` (`brief()` function)
- Modify: `prototype-2/app.js` (confidence-explainer click handler)
- Modify: `prototype-2/styles.css` (new stacked-bar segment colors)

**Interfaces:**
- Consumes: `confidenceScore(o)` / `confidenceBreakdown(o)` from Task 1; `confidenceInputs` on every decision from Task 2.
- Produces: `openConfidenceBreakdown(ref)` in `app.js` — takes a decision id (opens `state.decisionFor(ref)`) or the literal string `"evidence-map"` (opens `PL.evidenceMap.detail`); reused by Task 4.

- [ ] **Step 1: Replace the static confidence bar in `brief()` with the computed value**

Old (`prototype-2/render.js:403-408`):
```js
          <section class="rec-card">
            <div class="rec-label">${icon("spark")}ProofLoop recommends</div>
            <h2>${rec.headline}</h2>
            <p>${rec.rationale}</p>
            <div class="confidence"><span><b>${rec.confidence}%</b> evidence confidence</span><i class="conf-bar"><em style="width:${rec.confidence}%"></em></i><button class="link-btn" data-conf>How confidence works</button></div>
          </section>
```

New:
```js
          <section class="rec-card">
            <div class="rec-label">${icon("spark")}ProofLoop recommends</div>
            <h2>${rec.headline}</h2>
            <p>${rec.rationale}</p>
            <div class="confidence"><span><b>${confidenceScore(d)}%</b> evidence confidence</span><i class="conf-bar"><em style="width:${confidenceScore(d)}%"></em></i><button class="link-btn" data-conf="${d.id}">How confidence works</button></div>
          </section>
```

- [ ] **Step 2: Remove the old toast-based confidence explainer and add a real breakdown modal opener in `app.js`**

Old (`prototype-2/app.js:143-147`):
```js
    // confidence explainer
    if (t.closest("[data-conf]")) {
      showToast("How confidence works", "A blend of source coverage, recency, agreement across sources, and eval repeatability.");
      return;
    }
```

New:
```js
    // confidence explainer → real computed breakdown, same treatment as the Impact Score's "why"
    const confBtn = t.closest("[data-conf]");
    if (confBtn) { openConfidenceBreakdown(confBtn.dataset.conf); return; }
```

- [ ] **Step 3: Add the `openConfidenceBreakdown` function**

Add this function directly after the existing `openBreakdown` function in `prototype-2/app.js` (after line 168, before the `/* ---------- decision confirm modal ---------- */` comment):

```js
  /* ---------- confidence breakdown modal (§4.7) ---------- */
  function openConfidenceBreakdown(ref) {
    const o = ref === "evidence-map" ? PL.evidenceMap.detail : state.decisionFor(ref);
    if (!o) return;
    const body = document.getElementById("modal-body");
    body.innerHTML = `<div class="modal-head"><h2>How confidence works</h2><button class="icon-btn" data-close>${R.icon("x")}</button></div>
      <p class="modal-sub">${o.title || ""}</p>
      ${R.confidenceBreakdown(o)}
      <p class="modal-foot">Confidence = 0.35·eval pass rate + 0.30·source agreement + 0.20·coverage + 0.15·recency.</p>`;
    openModal();
  }
```

- [ ] **Step 4: Add stacked-bar segment colors for the four confidence factors**

Add after the existing Impact Score segment colors in `prototype-2/styles.css` (after line 479, `.seg-urgency{background:#b9c6ef}`):

```css
.seg-evalPassRate{background:var(--mint)}
.seg-sourceAgreement{background:var(--blue)}
.seg-coverage{background:var(--amber)}
.seg-recency{background:#b9c6ef}
```

- [ ] **Step 5: Verify in the browser**

Serve or open `prototype-2/index.html`. Navigate to Decisions → open "Escalation response v2.4" (or any decision with a Brief detail page — everything except the billing go/no-go, which still routes to the Showcase). Confirm:
- The confidence bar shows a computed percentage (e.g., `91%` for the escalation decision) instead of the old hardcoded number.
- Clicking "How confidence works" opens a modal with a stacked bar, four rows (`sub × weight = contribution`), a band chip on the Recency row, and the provisional-weights note — not the old static toast text.
- The four contributions in the modal sum to the total shown at the top (allow for rounding: `Math.round(sum of contrib) === total` within 1).

- [ ] **Step 6: Commit**

```bash
git add prototype-2/render.js prototype-2/app.js prototype-2/styles.css
git commit -m "feat: wire Brief detail confidence to the computed breakdown (§4.4/§4.7)"
```

---

### Task 4: Wire Evidence Map detail (§4.7 normalization) to the same computed confidence

**Files:**
- Modify: `prototype-2/render.js` (`evidence()` function)

**Interfaces:**
- Consumes: `confidenceScore(o)` / `confidenceBreakdown(o)` from Task 1; `PL.evidenceMap.detail.confidenceInputs` from Task 2; `openConfidenceBreakdown` from Task 3 (already handles the `"evidence-map"` ref case).

- [ ] **Step 1: Replace the free-text confidence stat with the computed value and a breakdown trigger**

Old (`prototype-2/render.js:325-336`):
```js
        <section class="panel">
          <span class="badge blue">${m.detail.badge}</span>
          <h2 class="detail-title">${m.detail.title}</h2>
          <p class="detail-body">${m.detail.body}</p>
          <div class="stat-row">
            <span><small>Owner</small><b>${m.detail.owner}</b></span>
            <span><small>Confidence</small><b>${m.detail.confidence}</b></span>
            <span><small>Verified</small><b>${m.detail.verified}</b></span>
          </div>
          <h3 class="sources-head">Supporting evidence <span>${m.detail.sources.length}</span></h3>
          ${sources}
        </section>
```

New:
```js
        <section class="panel">
          <span class="badge blue">${m.detail.badge}</span>
          <h2 class="detail-title">${m.detail.title}</h2>
          <p class="detail-body">${m.detail.body}</p>
          <div class="stat-row">
            <span><small>Owner</small><b>${m.detail.owner}</b></span>
            <span><small>Confidence</small><b>${confidenceScore(m.detail)}%</b></span>
            <span><small>Verified</small><b>${m.detail.verified}</b></span>
          </div>
          <button class="link-btn" data-conf="evidence-map">How confidence works</button>
          <h3 class="sources-head">Supporting evidence <span>${m.detail.sources.length}</span></h3>
          ${sources}
        </section>
```

- [ ] **Step 2: Verify in the browser**

Navigate to the Evidence tab. Confirm the "Human escalation within 30 seconds" detail panel shows a computed `91%` (not the old `"High · 96%"` string), and clicking "How confidence works" opens the same breakdown modal built in Task 3, computed from this node's own `confidenceInputs` and `sources`.

- [ ] **Step 3: Commit**

```bash
git add prototype-2/render.js
git commit -m "feat: normalize Evidence Map confidence onto the computed format (§4.7)"
```

---

### Task 5: Full acceptance pass against §4.7's acceptance criterion

**Files:** none (verification only — fix forward in whichever file if something fails)

**Interfaces:** none new.

- [ ] **Step 1: Confirm every confidence value in the app is now computed**

```js
[...PL.decisions, PL.evidenceMap.detail].every(o => o.confidenceInputs != null)
```
Expected: `true`.

```js
PL.decisions.some(d => "confidence" in (d.recommendation || {}))
```
Expected: `false` — no decision should still carry a hand-authored `recommendation.confidence`.

```js
"confidence" in PL.evidenceMap.detail
```
Expected: `false` — the old free-text field is gone, replaced by `confidenceInputs`.

- [ ] **Step 2: Walk every decision's Brief detail page**

For each of: Escalation response v2.4, Repeat-escalation threshold, Intent routing patch v1.3, Billing refund knowledge update, Tone & style refinement — open its Brief detail (Decisions tab → tap the card), confirm the confidence bar renders a number in `0–100`, and "How confidence works" opens a breakdown whose four rows are all traceable to a note visible elsewhere on the same page (the eval row's numbers should match an evidence entry's note; the source-agreement row's count should match the number of evidence cards shown; the coverage row and recency row should read as plausible given the evidence dates shown).

Note: the billing go/no-go decision (`d-billing-golive`) still routes to the Value Showcase, not this Brief detail page — confirm that routing is unchanged (this task did not touch `isRollout` or `showcase()`).

- [ ] **Step 3: Confirm the Rollout arc is untouched**

Open the billing go/no-go decision from the briefing (routes to Showcase). Confirm the confidence shown there is still the static `87%` from `PL.rollout.confidence` — this pass deliberately left it alone (see Global Constraints).

- [ ] **Step 4: Confirm no other view regressed**

Click through Today, Decisions, Agents, Evidence, Memory, and the Pilot planner. Confirm nothing else references the removed `confidence` fields (a broken reference would render `undefined%` or `undefined` in the UI — grep to be sure):

```bash
grep -rn "\.confidence\b" prototype-2/render.js prototype-2/app.js
```

Expected matches: only `confidenceScore(...)`/`confidenceBreakdown(...)` calls, `PL.confidenceWeights`/`PL.confidenceWeightMeta` reads inside the engine, and the two remaining `r.confidence` reads inside `showcase()` (Rollout arc, explicitly out of scope). No `.recommendation.confidence` or `m.detail.confidence` reads should remain anywhere.

- [ ] **Step 5: No commit for this task** — it's verification-only. If Step 4's grep turns up a stray reference, fix it in the relevant file from Tasks 1–4 and fold the fix into that task's commit (or make a small `fix:` commit if those are already pushed).

---

### Task 6: Cap displayed confidence below 100% (post-review addendum)

The final whole-branch review (after Task 5) found that `d-intent-routing` and `d-refund-knowledge` compute to a literal 100 — perfect inputs (full eval pass, full coverage, all-agreeing sources, fresh recency) hit the formula's ceiling exactly, and both decisions are reachable via the live Brief detail page. A bare "100%" badge reads as absolute certainty even with the breakdown one click away. Decision (recorded in PRD §7): cap the *displayed* composite below 100, leaving the underlying per-factor math, weights, and breakdown rows completely unchanged — only the single rounded number every caller reads gets clamped.

**Files:**
- Modify: `prototype-2/render.js` — `confidenceScore(o)`

**Interfaces:**
- Consumes: nothing new.
- Produces: `confidenceScore(o)` now returns `Math.min(99, <previous return value>)`. Every existing caller (`brief()`, `evidence()`, `confidenceBreakdown()`'s total line) already goes through this one function, so no other file changes.

- [ ] **Step 1: Apply the cap**

Find `confidenceScore(o)` in `prototype-2/render.js` (added in Task 1). It currently ends with a line shaped like:

```js
return Math.round(f.evalPassRate*w.evalPassRate + f.sourceAgreement*w.sourceAgreement + f.coverage*w.coverage + f.recency*w.recency);
```

Change the `return` so the rounded value is clamped to 99 as a display ceiling, without touching how `f` (factors) or `w` (weights) are computed:

```js
const raw = Math.round(f.evalPassRate*w.evalPassRate + f.sourceAgreement*w.sourceAgreement + f.coverage*w.coverage + f.recency*w.recency);
return Math.min(99, raw);
```

Add a one-line comment directly above explaining why: displayed confidence never reads as absolute certainty, even when every input is perfect — the per-factor breakdown rows (`confidenceContributions`/`confidenceProvenance`) are untouched and still show the true, uncapped per-factor math.

- [ ] **Step 2: Verify**

No test framework exists — verify manually. Re-run the same hand-computation used in Task 1/Task 2's verification for all 7 confidence-bearing objects (`PL.decisions` + `PL.evidenceMap.detail`) via a Node script loading the real `data.js`/`render.js`. Expected: every object that previously computed to 100 now returns exactly `99`; every object that previously computed to anything below 100 (e.g. `d-escalation` → 91, `evidenceMap.detail` → 91) is completely unaffected, since `Math.min(99, x)` only changes values that were already ≥ 99. Also confirm `confidenceBreakdown(o)`'s per-row math (e.g. `d-intent-routing`'s individual factor contributions) still shows the true uncapped per-factor values — only the total/badge is capped, not the row-level arithmetic.

- [ ] **Step 3: Commit**

```bash
git add prototype-2/render.js
git commit -m "feat: cap displayed confidence at 99% so perfect inputs never read as absolute certainty (§7)"
```
