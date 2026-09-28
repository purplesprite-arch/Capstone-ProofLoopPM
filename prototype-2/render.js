/* ProofLoop Prototype 2 — rendering.
   Pure-ish functions that turn window.PL data into HTML strings.
   No DOM event wiring here; app.js handles state and interaction. */

(function () {
  const PL = window.PL;
  const P = PL.people;

  /* ---------- small helpers ---------- */
  const icon = (id, cls) => `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#${id}" /></svg>`;
  const ava = (id, extra) => `<span class="ava${extra ? " " + extra : ""}">${P[id] ? P[id].initials : "?"}</span>`;
  const agentOf = (id) => PL.agents.find((a) => a.id === id);
  // Shared $/wk-or-k formatter — used by the value-model provenance line and the cockpit panel.
  function fmtDollars(n) {
    if (n == null || isNaN(n)) return "$0";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return abs >= 1000 ? sign + "$" + (Math.round(abs / 100) / 10).toString().replace(/\.0$/, "") + "k" : sign + "$" + Math.round(abs);
  }

  function score(impact) {
    const w = PL.weights;
    return Math.round(w.value * impact.value + w.unblock * impact.unblock + w.reach * impact.reach + w.urgency * impact.urgency);
  }

  // Ordered contributions (weighted), largest first — used by the breakdown and the "why" line.
  function contributions(impact) {
    const w = PL.weights;
    return Object.keys(w)
      .map((k) => ({ key: k, sub: impact[k], contrib: +(w[k] * impact[k]).toFixed(1), weight: w[k] }))
      .sort((a, b) => b.contrib - a.contrib);
  }

  /* ---------- sub-score provenance ----------
     The composite is honest arithmetic (sub × weight). These push the same
     honesty one level down: each sub-score sits in a BAND derived from
     observable signals. We do NOT recompute the sub-score — we expose the
     facts that justify its band. The band is the grounded claim; the exact
     point within it stays an estimate. */
  function valueBand(s, lever) {
    // When this decision inherits a grounded lever (rung >= 2), the band comes from the
    // MODELED value, not the hand-authored signals below — those signals remain the
    // fallback for decisions with no mapped lever, or one still at "Strategic Model."
    if (lever) {
      const range = leverValueRange(lever);
      if (!range.qualitative && !range.metricOnly) {
        const weeks = (lever.period && lever.period.weeks) || 13;
        const weekly = range.mid / weeks;
        if (weekly >= 4000) return { name: "critical", lo: 80, hi: 100 };
        if (weekly >= 1500) return { name: "high", lo: 60, hi: 79 };
        if (weekly > 0) return { name: "moderate", lo: 40, hi: 59 };
      }
    }
    if (s.commitmentAtStake) return { name: "critical", lo: 80, hi: 100 };
    if (s.weeklyDollars != null && s.weeklyDollars >= 4000) return { name: "critical", lo: 80, hi: 100 };
    if (s.weeklyDollars != null && s.weeklyDollars >= 1500) return { name: "high", lo: 60, hi: 79 };
    if (s.weeklyDollars != null && s.weeklyDollars > 0) return { name: "moderate", lo: 40, hi: 59 };
    if (s.valueKind === "unblocks-work" || s.valueKind === "accuracy-gain") return { name: "moderate", lo: 40, hi: 59 };
    return { name: "low", lo: 0, hi: 39 };
  }
  function unblockBand(s) {
    const n = s.blocksToday || 0;
    if (n >= 4) return { name: "high", lo: 75, hi: 100 };
    if (n >= 2) return { name: "moderate", lo: 55, hi: 74 };
    return { name: "low", lo: 0, hi: 54 };
  }
  function reachBand(s) {
    if (s.reachPerWeek != null) {
      if (s.reachPerWeek >= 5000) return { name: "broad", lo: 80, hi: 100 };
      if (s.reachPerWeek >= 300) return { name: "moderate", lo: 45, hi: 79 };
      return { name: "narrow", lo: 0, hi: 44 };
    }
    return { name: "moderate", lo: 45, hi: 79 }; // "all X" control surfaces, volume not metered
  }
  function urgencyBand(s) {
    if (s.urgencyKind === "commitment-breaking") return { name: "immediate", lo: 85, hi: 100 };
    if (s.urgencyKind === "gate-window") return { name: "time-boxed", lo: 55, hi: 79 };
    if (s.urgencyKind === "scheduled") return { name: "scheduled", lo: 30, hi: 54 };
    return { name: "low", lo: 0, hi: 29 };
  }
  const BAND_FN = { value: valueBand, unblock: unblockBand, reach: reachBand, urgency: urgencyBand };

  /* ---------- Value Model (progressive value capture) ----------
     Pure functions over PL.valueModelState (falling back to PL.valueModelSeed) —
     app.js owns loading/persisting/mutating that model; nothing here writes to it.
     A lever climbs a 5-rung DATA-GROUNDING ladder as fields are supplied: naming a
     goal, attaching a benchmark, entering the customer's own baseline, committing to
     a target, and finally wiring live actuals + attribution. The composite is never
     recomputed to look more certain than its inputs — at rung <=1 there is no number
     at all, and the range only narrows as real data lands. */
  const RUNG_META = [
    { n: 0, label: "No goal yet" },
    { n: 1, label: "Strategic Model" },
    { n: 2, label: "Benchmarked" },
    { n: 3, label: "Baselined" },
    { n: 4, label: "Target-Committed" },
    { n: 5, label: "Operationally Airtight" }
  ];
  const RANGE_HALFWIDTH = [null, 0.60, 0.45, 0.30, 0.18, 0.07]; // indexed by rung; narrower as grounding deepens

  function rungLabel(n) { return (RUNG_META[n] || RUNG_META[0]).label; }
  // Levers carry only kind/period/model — domain, direction ("revenue"|"cost"), and label
  // live on the matching valueFocusTaxonomy entry (same key), so the taxonomy is the one
  // place that metadata is authored.
  function taxonomyFor(key) {
    return PL.valueFocusTaxonomy.find((v) => v.key === key) || null;
  }
  function taxonomyLabel(key) {
    const t = taxonomyFor(key);
    return t ? t.label : key;
  }
  // Shared 5-pip rung ladder markup — used by the engagement-grade badge (profile seam +
  // Value Model header) and by each lever's own small ladder.
  function rungPips(rung, cls) {
    return [1, 2, 3, 4, 5].map((n) => `<i class="rung-step${cls ? " " + cls : ""}${n <= rung ? " is-on" : ""}"></i>`).join("");
  }
  // The live, persisted model (app.js publishes overrides here) — falls back to the seed
  // so every function below works identically before any input has been entered.
  function liveModel() { return PL.valueModelState || PL.valueModelSeed || []; }
  function leverByKey(key) { return liveModel().find((l) => l.key === key); }
  // A decision may map to several taxonomy keys (valueFocusTagMap); it inherits value
  // from whichever mapped lever is MOST grounded, not just the first tag — an ungrounded
  // tag listed first shouldn't hide a better-grounded one listed second.
  function leverForDecision(d) {
    const tags = (PL.valueFocusTagMap && PL.valueFocusTagMap[d.id]) || [];
    let best = null, bestRung = -1;
    tags.forEach((k) => {
      const lever = leverByKey(k);
      if (!lever) return;
      const r = leverRung(lever);
      if (r > bestRung) { bestRung = r; best = lever; }
    });
    return best;
  }

  function leverRung(lever) {
    if (!lever || lever.kind !== "value") return 0;
    const m = lever.model || {};
    if (!m.goal) return 0;
    if (!m.benchmark) return 1;
    if (!m.baseline || m.baseline.value == null) return 2;
    if (!m.target || m.target.value == null || !m.target.timeframe) return 3;
    if (!m.actuals || m.actuals.value == null || m.actuals.attributionPct == null) return 4;
    return 5;
  }

  // Bottom-up: (improved metric - baseline) x volume x unit economics x the realization
  // window. Prefers live actuals over a committed target once actuals exist.
  function bottomUpValue(lever) {
    const m = (lever && lever.model) || {};
    if (!m.baseline || m.baseline.value == null) return null;
    const endpoint = m.actuals && m.actuals.value != null ? m.actuals.value : (m.target && m.target.value != null ? m.target.value : null);
    if (endpoint == null || !m.bottomUp || m.bottomUp.volumePerWeek == null || m.bottomUp.unitEconomics == null) return null;
    const unit = m.baseline.unit || "";
    const delta = unit.indexOf("%") !== -1 ? (endpoint - m.baseline.value) / 100 : endpoint - m.baseline.value;
    const weeks = (lever.period && lever.period.weeks) || 13;
    return delta * m.bottomUp.volumePerWeek * m.bottomUp.unitEconomics * weeks;
  }

  // Top-down: the customer's own stated target-gap x a plausible attribution share to
  // this lever/agent. Independent of bottom-up on purpose — see valueCrossCheck().
  function topDownValue(lever) {
    const m = (lever && lever.model) || {};
    if (!m.topDown || m.topDown.customerTargetGap == null || m.topDown.attributionShare == null) return null;
    return m.topDown.customerTargetGap * m.topDown.attributionShare;
  }

  // Both methods, side by side — divergence is a SIGNAL the model needs more data, never
  // silently averaged away.
  function valueCrossCheck(lever) {
    const bu = bottomUpValue(lever);
    const td = topDownValue(lever);
    if (bu == null || td == null) return { bu, td, divergencePct: null, diverges: false };
    const denom = Math.max(Math.abs(bu), Math.abs(td)) || 1;
    const divergencePct = Math.abs(bu - td) / denom;
    return { bu, td, divergencePct, diverges: divergencePct > 0.4 };
  }

  // The tightening value range. <=1: qualitative, no number. Otherwise a $ range once
  // bottom-up/top-down are computable; if only a benchmark exists (no volume/economics
  // yet), the range is the benchmarked KPI range itself, not a fabricated dollar figure.
  function leverValueRange(lever) {
    const rung = leverRung(lever);
    if (rung <= 1) return { qualitative: true, rung };
    const m = lever.model || {};
    const cross = valueCrossCheck(lever);
    const hw = RANGE_HALFWIDTH[rung] || 0.5;
    if (cross.bu != null || cross.td != null) {
      const mid = cross.bu != null && cross.td != null ? (cross.bu + cross.td) / 2 : cross.bu != null ? cross.bu : cross.td;
      return { qualitative: false, metricOnly: false, rung, mid, lo: mid * (1 - hw), hi: mid * (1 + hw), unit: "$", cross };
    }
    if (m.benchmark) return { qualitative: false, metricOnly: true, rung, lo: m.benchmark.lo, hi: m.benchmark.hi, unit: m.benchmark.unit };
    return { qualitative: true, rung };
  }

  // How many days a delivery lever's slip defers the START of this lever's value —
  // the ONLY place delivery time touches money: it shrinks the realization window,
  // it never invents its own dollar figure.
  function deliveryForLever(key) {
    return liveModel()
      .filter((l) => l.kind === "delivery" && l.model && (l.model.defers || []).indexOf(key) !== -1)
      .reduce((sum, l) => sum + (l.model.slipDays || 0), 0);
  }
  function deliveryAdjustedRange(lever) {
    const range = leverValueRange(lever);
    const slipDays = deliveryForLever(lever.key);
    if (range.qualitative || range.metricOnly || !slipDays) return Object.assign({}, range, { slipDays: slipDays || 0 });
    const weeks = (lever.period && lever.period.weeks) || 13;
    const fraction = Math.max(0, (weeks - slipDays / 7) / weeks);
    return Object.assign({}, range, { mid: range.mid * fraction, lo: range.lo * fraction, hi: range.hi * fraction, slipDays });
  }

  // One engagement-level grade, WEAKEST-LINK WEIGHTED: the value-weighted average rung,
  // capped at the rung of whichever single lever carries the most modeled value — you
  // can't read as "Operationally Airtight" while your #1 value lever is still just named.
  // A completely separate axis from confidenceScore() below; never merged with it.
  function engagementGrade(model) {
    const levers = (model || liveModel()).filter((l) => l.kind === "value");
    const scored = levers.map((l) => ({ lever: l, rung: leverRung(l), range: leverValueRange(l) }));
    const priced = scored.filter((x) => !x.range.qualitative && !x.range.metricOnly && x.range.mid > 0);
    let weightedAvg, cap, capLever;
    if (priced.length) {
      const totalWeight = priced.reduce((s, x) => s + x.range.mid, 0);
      weightedAvg = priced.reduce((s, x) => s + x.range.mid * x.rung, 0) / totalWeight;
      const top = priced.reduce((best, x) => (!best || x.range.mid > best.range.mid ? x : best), null);
      cap = top.rung;
      capLever = top.lever;
    } else {
      // No lever has a modeled dollar yet — fall back to breadth across whatever has a goal,
      // so the grade still moves as levers deepen even before any $ figure exists.
      const named = scored.filter((x) => x.rung >= 1);
      weightedAvg = named.length ? named.reduce((s, x) => s + x.rung, 0) / named.length : 0;
      cap = named.length ? Math.min.apply(null, named.map((x) => x.rung)) : 0;
      capLever = named.length ? named.reduce((low, x) => (x.rung < low.rung ? x : low), named[0]).lever : null;
    }
    const rung = Math.max(0, Math.min(Math.floor(Math.min(weightedAvg, cap)), 5));
    const capBinds = cap < weightedAvg;
    return { rung, label: rungLabel(rung), weightedAvg, cap, capLeverKey: capBinds && capLever ? capLever.key : null, capLeverLabel: capBinds && capLever ? taxonomyLabel(capLever.key) : null };
  }

  // Shared badge markup for engagementGrade() — used on the Profile seam (compact) and atop
  // the Value Model screen (same markup, CSS just sizes it up via the .lg class).
  function gradeBadgeHtml(grade, cls) {
    const cap = grade.capLeverKey
      ? `<p class="grade-cap">Held back by <b>${grade.capLeverLabel}</b> — still ${rungLabel(leverRung(leverByKey(grade.capLeverKey)))}.</p>`
      : "";
    return `<div class="grade-badge${cls ? " " + cls : ""}">
        <div class="grade-top"><b>${grade.label}</b><span class="grade-sub">Engagement grade · L${grade.rung}</span></div>
        <div class="rung-ladder">${rungPips(grade.rung)}</div>
        ${cap}
      </div>`;
  }

  /* ---------- Value Model screen (progressive lever inputs) ----------
     One editable field per data-grounding rung. Inputs are wired by app.js's delegated
     "change" listener via data-lever-field="leverKey|dot.path.into.model" — this file only
     ever produces markup, never touches PL.valueModelState directly. */
  function leverField(lever, path, value, label, opts) {
    opts = opts || {};
    const key = `${lever.key}|${path}`;
    if (opts.textarea) {
      const safe = value == null ? "" : String(value).replace(/</g, "&lt;");
      return `<label class="lever-field wide"><span>${label}</span><textarea class="lever-input" data-lever-field="${key}" placeholder="${opts.placeholder || ""}">${safe}</textarea></label>`;
    }
    const safeAttr = (value == null ? "" : String(value)).replace(/"/g, "&quot;");
    return `<label class="lever-field${opts.wide ? " wide" : ""}"><span>${label}</span><input class="lever-input" data-lever-field="${key}" type="${opts.type || "text"}" value="${safeAttr}" placeholder="${opts.placeholder || ""}" /></label>`;
  }

  // Rung-by-rung field groups, in the same order leverRung() checks them. Only the levers
  // already satisfied PLUS the next one are returned — progressive disclosure, so a lever
  // never shows an "actuals" field before it has even named a goal.
  function leverSections(lever) {
    const m = lever.model || {};
    const r = leverRung(lever);
    const all = [
      { title: "Goal", body: leverField(lever, "goal", m.goal, "What are we trying to move?", { textarea: true, placeholder: "e.g. Lift cross-sell attach on inbound billing chats." }) },
      { title: "Industry benchmark", body: [
          leverField(lever, "benchmark.lo", m.benchmark && m.benchmark.lo, "Low", { type: "number" }),
          leverField(lever, "benchmark.hi", m.benchmark && m.benchmark.hi, "High", { type: "number" }),
          leverField(lever, "benchmark.unit", m.benchmark && m.benchmark.unit, "Unit", { placeholder: "% attach" }),
          leverField(lever, "benchmark.source", m.benchmark && m.benchmark.source, "Source", { wide: true, placeholder: "e.g. SaaS benchmark, 2025" })
        ].join("") },
      { title: "Customer's own baseline", body: [
          leverField(lever, "baseline.value", m.baseline && m.baseline.value, "Current value", { type: "number" }),
          leverField(lever, "baseline.unit", m.baseline && m.baseline.unit, "Unit", { placeholder: "% attach" }),
          leverField(lever, "baseline.asOf", m.baseline && m.baseline.asOf, "As of", { type: "date" })
        ].join("") },
      { title: "Committed target", body: [
          leverField(lever, "target.value", m.target && m.target.value, "Target value", { type: "number" }),
          leverField(lever, "target.timeframe", m.target && m.target.timeframe, "Timeframe", { placeholder: "by Q4" }),
          leverField(lever, "target.committedBy", m.target && m.target.committedBy, "Committed by", { placeholder: "who signed off" })
        ].join("") },
      { title: "Live actuals", body: [
          leverField(lever, "actuals.value", m.actuals && m.actuals.value, "Actual value", { type: "number" }),
          leverField(lever, "actuals.unit", m.actuals && m.actuals.unit, "Unit", { placeholder: "% attach" }),
          leverField(lever, "actuals.asOf", m.actuals && m.actuals.asOf, "As of", { type: "date" }),
          leverField(lever, "actuals.attributionPct", m.actuals && m.actuals.attributionPct, "Attribution %", { type: "number" })
        ].join("") }
    ];
    const visible = Math.min(all.length, r + 2); // everything satisfied, plus one to fill in next
    return all.slice(0, visible).map((s, i) => Object.assign({}, s, { locked: i > r }));
  }

  // Optional, independent of the rung ladder: once a lever has a benchmark (rung >= 1), it
  // can be converted into an actual range via EITHER path — this is where bottomUp/topDown
  // get entered. Filling one is enough; filling both lets the cross-check run.
  function leverEconomicsSection(lever) {
    if (leverRung(lever) < 1) return "";
    const m = lever.model || {};
    const bu = m.bottomUp || {};
    const td = m.topDown || {};
    return `<div class="lever-section econ">
        <p class="lever-section-title">Turn this into a range <span class="rung-next-tag">optional — either path works</span></p>
        <div class="two-up">
          <div class="lever-fields"><p class="econ-label">Bottom-up</p>
            ${leverField(lever, "bottomUp.volumePerWeek", bu.volumePerWeek, "Volume / week", { type: "number" })}
            ${leverField(lever, "bottomUp.unitEconomics", bu.unitEconomics, "$ per unit", { type: "number" })}
          </div>
          <div class="lever-fields"><p class="econ-label">Top-down</p>
            ${leverField(lever, "topDown.customerTargetGap", td.customerTargetGap, "Customer's target gap ($)", { type: "number" })}
            ${leverField(lever, "topDown.attributionShare", td.attributionShare, "Attribution share (0–1)", { type: "number" })}
          </div>
        </div>
      </div>`;
  }

  function leverValueOutput(lever) {
    const range = leverValueRange(lever);
    if (range.qualitative) return `<p class="lever-value qualitative">Name a goal to begin — no number yet.</p>`;
    if (range.metricOnly) {
      return `<div class="lever-value">
          <div class="range-bar"><i style="width:100%"></i></div>
          <div class="range-nums"><b>${range.lo}–${range.hi}${range.unit}</b><span>benchmarked range — not yet priced (add volume/economics below)</span></div>
        </div>`;
    }
    const adj = deliveryAdjustedRange(lever);
    const weeks = (lever.period && lever.period.weeks) || 13;
    const cross = range.cross || {};
    const divergenceNote = cross.diverges
      ? `<p class="bd-prov flag"><span class="flag-note">Bottom-up and top-down disagree by ${Math.round(cross.divergencePct * 100)}% — that's a signal to gather more data, not something to average away.</span></p>`
      : "";
    const slipNote = adj.slipDays
      ? `<p class="delivery-chip slip">${icon("alert")}Value start deferred ~${adj.slipDays}d by a delivery lever</p>`
      : "";
    return `<div class="lever-value">
        <div class="range-bar"><i style="width:100%"></i></div>
        <div class="range-nums"><b>${fmtDollars(adj.lo)}–${fmtDollars(adj.hi)}</b><span>modeled over ${weeks} wks · ${fmtDollars(adj.mid)} mid</span></div>
        <div class="two-up calc-cols">
          <div class="calc-col"><small>Bottom-up</small><b>${cross.bu != null ? fmtDollars(cross.bu) : "—"}</b></div>
          <div class="calc-col"><small>Top-down</small><b>${cross.td != null ? fmtDollars(cross.td) : "—"}</b></div>
        </div>
        ${divergenceNote}
        ${slipNote}
      </div>`;
  }

  function leverCard(lever) {
    const r = leverRung(lever);
    const sections = leverSections(lever);
    const sectionHtml = sections
      .map((s) => `<div class="lever-section${s.locked ? " is-next" : ""}">
          <p class="lever-section-title">${s.title}${s.locked ? ' <span class="rung-next-tag">next</span>' : ""}</p>
          <div class="lever-fields">${s.body}</div>
        </div>`)
      .join("");
    return `<article class="lever-card" data-lever="${lever.key}">
        <div class="lever-card-head">
          <b>${taxonomyLabel(lever.key)}</b>
          <div class="rung-ladder small">${rungPips(r)}<span class="rung-label">${rungLabel(r)}</span></div>
        </div>
        ${leverValueOutput(lever)}
        <div class="lever-body">
          ${sectionHtml}
          ${leverEconomicsSection(lever)}
        </div>
      </article>`;
  }

  // "Value starts ~{date}" readout for a delivery lever — the only date-flavored output
  // delivery ever produces; still no dollar figure anywhere in this function.
  function deliveryStartReadout(lever) {
    const m = lever.model || {};
    const days = (m.valueStartOffsetWeeks || 0) * 7 + (m.slipDays || 0);
    const base = new Date(PL.today.nowIso);
    base.setDate(base.getDate() + Math.round(days));
    return base.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function deliveryLeverCard(lever) {
    const m = lever.model || {};
    const defers = (m.defers || []).map((k) => `<span class="pill">${taxonomyLabel(k)}</span>`).join(" ") || `<span class="muted">none linked</span>`;
    return `<article class="lever-card delivery-card" data-lever="${lever.key}">
        <div class="lever-card-head">
          <b>${taxonomyLabel(lever.key)}</b>
          <span class="delivery-chip slip">${icon("alert")}${m.slipDays || 0}d slip</span>
        </div>
        <p class="lever-goal">${m.goal || ""}</p>
        <div class="lever-fields">${leverField(lever, "slipDays", m.slipDays, "Days slipped so far", { type: "number" })}</div>
        <p class="defer-note">Defers value from: ${defers}</p>
        <p class="defer-note">Value starts ~<b>${deliveryStartReadout(lever)}</b> at the current slip — never its own dollar figure.</p>
      </article>`;
  }

  function valueModel(state) {
    const model = state.valueModel || liveModel();
    const grade = engagementGrade(model);
    const valueLevers = model.filter((l) => l.kind === "value");
    const deliveryLevers = model.filter((l) => l.kind === "delivery");
    const domains = [];
    valueLevers.forEach((l) => {
      const domain = (taxonomyFor(l.key) || {}).domain || "Other";
      let group = domains.find((g) => g.domain === domain);
      if (!group) { group = { domain, levers: [] }; domains.push(group); }
      group.levers.push(l);
    });
    const domainHtml = domains
      .map((g) => `<section class="lever-domain-group"><h2>${g.domain}</h2><div class="lever-grid">${g.levers.map(leverCard).join("")}</div></section>`)
      .join("");
    const deliveryHtml = deliveryLevers.length
      ? `<section class="lever-domain-group"><h2>Delivery — time as cost</h2><div class="lever-grid">${deliveryLevers.map(deliveryLeverCard).join("")}</div></section>`
      : "";
    return `
      <button class="back" data-view="profile">${icon("arrow-left")}Back to profile</button>
      <header class="page-head">
        <h1>Value Model</h1>
        <p>Name a goal, then deepen it — each lever climbs a data-grounding ladder from a strategic goal to live, attributed actuals. Delivery risk is modeled in days, never a fabricated dollar.</p>
      </header>
      ${gradeBadgeHtml(grade, "lg")}
      ${domainHtml}
      ${deliveryHtml}
    `;
  }

  // Plain-language basis for a factor's band, read straight from the signals.
  function provenance(key, d) {
    const s = d.signals || {};
    const m = d.metrics || {};
    if (key === "value") {
      const lever = leverForDecision(d);
      if (lever) {
        const rung = leverRung(lever);
        const range = leverValueRange(lever);
        if (range.qualitative) return `goal named (${rungLabel(rung)}) — not yet enough data to model a number`;
        const label = `${rungLabel(rung)} (L${rung}), narrowing as more data lands`;
        if (range.metricOnly) return `${range.lo}–${range.hi}${range.unit} benchmarked · ${label}`;
        const weeks = (lever.period && lever.period.weeks) || 13;
        return `${fmtDollars(range.lo / weeks)}–${fmtDollars(range.hi / weeks)}/wk modeled · ${label}`;
      }
      const money = s.dollarsDisplay
        ? s.dollarsDisplay + (s.dollarsKind === "at-risk" ? " at risk" : s.dollarsKind === "opportunity" ? " projected" : "")
        : "";
      if (s.commitmentAtStake && money) return money + " against a confirmed commitment";
      if (s.commitmentAtStake) return "a confirmed external commitment is at stake";
      if (money) return money;
      return {
        "unblocks-work": "no direct dollars — value is unblocking downstream work",
        "accuracy-gain": "a measurable accuracy gain, no dollars at stake",
        "content": "a sourced content update, no KPI moved",
        "cosmetic": "cosmetic change, no KPI moved"
      }[s.valueKind] || "indirect production value";
    }
    if (key === "unblock") {
      const n = s.blocksToday || 0;
      return n ? `unblocks ${n} build ${n === 1 ? "task" : "tasks"} due today` : "advances the build path; blocks no gated task today";
    }
    if (key === "reach") return m.reach ? "affects " + m.reach : "affects a defined surface";
    if (key === "urgency") return {
      "commitment-breaking": "a confirmed commitment is being broken now",
      "gate-window": "a go/no-go or dependency gate is open",
      "scheduled": "advances on a timer, no hard gate",
      "low": "no time pressure"
    }[s.urgencyKind] || "";
    return "";
  }

  function whyLine(d, rank) {
    const top = contributions(d.impact).slice(0, 2);
    const phrase = (f) => {
      const m = d.metrics || {};
      if (f.key === "value") return `it protects ${m.headline || "production value"}`;
      if (f.key === "unblock") return m.blocksToday ? `it unblocks ${m.blocksToday} build ${m.blocksToday === 1 ? "task" : "tasks"} due today` : `it clears today's build path`;
      if (f.key === "reach") return `it affects ${m.reach || "a wide surface"}`;
      return `its window is closing soon`;
    };
    return `Ranks #${rank} because ${phrase(top[0])}, and ${phrase(top[1])}.`;
  }

  /* ---------- score badge + breakdown ---------- */
  function scoreBadge(impact, size) {
    const s = score(impact);
    const cls = size === "lg" ? "score lg" : "score";
    return `<span class="${cls}" style="--fill:${s}"><b>${s}</b><small>impact</small></span>`;
  }

  function breakdown(d) {
    const s = score(d.impact);
    const sig = d.signals || {};
    const rows = contributions(d.impact)
      .map((c) => {
        const meta = PL.weightMeta[c.key];
        const band = c.key === "value" ? valueBand(sig, leverForDecision(d)) : BAND_FN[c.key](sig);
        const inBand = c.sub >= band.lo && c.sub <= band.hi;
        const basis = provenance(c.key, d);
        return `<div class="bd-row">
            <span class="bd-name">${meta.label}<em>${meta.hint}</em></span>
            <span class="bd-bar"><i style="width:${c.sub}%"></i></span>
            <span class="bd-math">${c.sub} × ${c.weight.toFixed(2)} = <b>${c.contrib}</b></span>
            <span class="bd-prov${inBand ? "" : " flag"}"><b class="bd-band">${band.name} band</b>${basis ? `<span>${basis}</span>` : ""}${inBand ? "" : `<span class="flag-note">· sits outside its signal band — review</span>`}</span>
          </div>`;
      })
      .join("");
    const segs = contributions(d.impact)
      .map((c) => `<i class="seg-${c.key}" style="width:${c.contrib}%" title="${PL.weightMeta[c.key].label}: ${c.contrib}"></i>`)
      .join("");
    const esc = classifyEscalation(d);
    return `<div class="breakdown">
        <p class="bd-escalation"><b>${esc.type === "decision" ? "Needs you" : "Advancing on its own"} because:</b> ${esc.reason}</p>
        <div class="bd-total"><span>Impact score</span><b>${s}<small>/100</small></b></div>
        <div class="bd-stack">${segs}</div>
        <div class="bd-rows">${rows}</div>
        <p class="bd-note">Each factor sits in a band set by observable signals — dollars at stake, blocked tasks, reach, and time pressure. The band is the grounded claim; the exact point within it is an estimate.</p>
      </div>`;
  }

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
    // Cap displayed confidence at 99 so perfect inputs never read as absolute certainty;
    // per-factor breakdown rows remain untouched — only the total badge is clamped (§7).
    const raw = Math.round(w.evalPassRate * f.evalPassRate + w.sourceAgreement * f.sourceAgreement + w.coverage * f.coverage + w.recency * f.recency);
    return Math.min(99, raw);
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

  /* ---------- escalation classification (derived, not authored) ----------
     Whether a decision needs a human is derived from the signals already on the object —
     a confirmed external commitment, a rollout go/no-go, or a policy-consequence gate/severity
     — instead of trusting the seed's own `type` literal. The four inputs below are exactly the
     ones every seed decision actually carries; score()/confidenceScore() aren't used as gating
     thresholds (there's no held-out calibrated set to fit a cutoff against — see
     confidenceWeights' own PROVISIONAL note), but they're surfaced in the reason for context. */
  function classifyEscalation(d) {
    const sig = d.signals || {};
    const context = ` (Impact ${score(d.impact)}${d.confidenceInputs ? `, confidence ${confidenceScore(d)}%` : ""}.)`;
    if (sig.commitmentAtStake === true) {
      return { type: "decision", reason: "Breaks a confirmed external commitment — that always needs a human, whatever the impact score reads." + context };
    }
    if (d.isRollout) {
      return { type: "decision", reason: "A rollout go/no-go always needs an accountable owner." + context };
    }
    if (d.gate) {
      return { type: "decision", reason: d.gate + context };
    }
    if (d.severity) {
      return { type: "decision", reason: `Crosses a policy line (${d.severity.toLowerCase()}) — needs sign-off before it advances.` + context };
    }
    return { type: "informative", reason: "No confirmed commitment, rollout gate, or policy line at stake — safe to advance on its own." + context };
  }

  /* ---------- RACI routing (derived accountable owner) ----------
     Every anchor decision the eval's independent panel confirmed shares one rule: whatever
     classifyEscalation() flags as needing a human is accountable to the exec who owns the
     outcome (PL.user), not whoever happens to be building it — that's exactly the fix for the
     d-order-history-access mis-route (authored "sam-tan", an engineering lead) without editing
     the seed data. Items that advance on their own keep whatever owner is already authored. */
  function routeOwner(d) {
    const esc = classifyEscalation(d);
    if (esc.type === "decision") {
      return { id: PL.user.id, reason: "Needs a human, so it's accountable to the exec who owns the outcome — not the team that built it." };
    }
    const a = (d.raci || {}).a;
    return { id: a, reason: "Advancing on its own — ownership stays with whoever's already accountable for this lane." };
  }

  /* ---------- RACI ---------- */
  function raci(d) {
    const r = d.raci || {};
    const owner = routeOwner(d);
    const names = (arr) => (arr || []).map((id) => P[id] ? P[id].initials : id).join(" · ");
    const isYou = owner.id === PL.user.id;
    const aName = isYou ? "You" : (P[owner.id] ? P[owner.id].short : owner.id);
    const items = [];
    items.push(`<span class="raci-item is-a" title="Accountable — the decider. Routed here because: ${owner.reason}"><i>A</i><span>${aName}</span></span>`);
    if (r.r && r.r.length) items.push(`<span class="raci-item" title="Responsible — does the work"><i>R</i><span>${names(r.r)}</span></span>`);
    if (r.c && r.c.length) items.push(`<span class="raci-item" title="Consulted"><i>C</i><span>${names(r.c)}</span></span>`);
    if (r.i && r.i.length) items.push(`<span class="raci-item" title="Informed"><i>I</i><span>${names(r.i)}</span></span>`);
    return `<div class="raci">${items.join("")}</div>`;
  }

  function agentChip(agentId) {
    const a = agentOf(agentId);
    if (!a) return "";
    return `<span class="agent-chip" data-goto-agent="${a.id}">${icon(a.icon)}${a.name}</span>`;
  }

  function toggle(d) {
    const on = (v) => (d.type === v ? " is-on" : "");
    return `<div class="toggle" data-toggle="${d.id}" role="group" aria-label="Decision or informative">
        <button class="seg${on("decision")}" data-set="decision">Decision</button>
        <button class="seg${on("informative")}" data-set="informative">Informative</button>
      </div>`;
  }

  /* ---------- decision cards ---------- */
  function heroCard(d, rank) {
    const rec = d.recommendation || {};
    return `<article class="hero-card" data-card="${d.id}">
      <div class="hero-top">
        ${agentChip(d.agentId)}
        <span class="tag-consequence">${d.severity || "Decision"}</span>
      </div>
      <div class="hero-head">
        <div class="hero-title"><h2>${d.title}</h2><p>${d.one_liner}</p></div>
        ${scoreBadge(d.impact, "lg")}
      </div>
      <button class="why" data-why="${d.id}">${whyLine(d, rank)} <span class="why-more">see the math</span></button>
      <div class="rec-line">${icon("spark")}<span><b>Recommends:</b> ${rec.headline}</span></div>
      ${raci(d)}
      <div class="quick">
        <button class="qbtn approve" data-decide="approve" data-id="${d.id}">${icon("check")}Approve</button>
        <button class="qbtn revise" data-decide="revise" data-id="${d.id}">${icon("edit")}Revise</button>
        <button class="qbtn reject" data-decide="reject" data-id="${d.id}">${icon("x")}Reject</button>
      </div>
      <div class="hero-foot">
        <button class="link-btn" data-open="${d.id}">Open full brief ${icon("arrow-right")}</button>
        ${toggle(d)}
      </div>
    </article>`;
  }

  function compactCard(d, rank) {
    return `<article class="dec-card" data-card="${d.id}">
      <button class="dec-main" data-open="${d.id}">
        ${scoreBadge(d.impact)}
        <span class="dec-body">
          <span class="dec-title">${d.title}</span>
          <span class="dec-sub">${d.one_liner}</span>
          <span class="dec-meta">${agentChip(d.agentId)}<span class="dec-metric">${d.metrics.headline}</span></span>
        </span>
        ${icon("chevron-right", "muted")}
      </button>
      <div class="dec-controls">${raci(d)}${toggle(d)}</div>
    </article>`;
  }

  function fyiRow(d) {
    return `<div class="fyi-row" data-card="${d.id}">
      <span class="fyi-dot"></span>
      <button class="fyi-main" data-open="${d.id}">
        <span class="fyi-title">${d.title}</span>
        <span class="fyi-sub">${agentOf(d.agentId) ? agentOf(d.agentId).name : ""} · ${d.autoIn || "advancing"}</span>
      </button>
      <span class="fyi-score">${score(d.impact)}</span>
      ${toggle(d)}
    </div>`;
  }

  /* ---------- time-available gate ---------- */
  function timePicker() {
    const colorClass = { zero: "reject", little: "revise", lots: "" };
    const rows = PL.timeModes
      .map(
        (m) => `<button class="choice" data-time="${m.id}">
          <span class="choice-ic bars ${colorClass[m.id]}">${icon(m.icon, "filled")}</span>
          <span><b>${m.label}</b><small>${m.tagline}</small></span>
        </button>`
      )
      .join("");
    return `<div class="modal-head"><h2>How much time do you have today?</h2></div>
      <p class="modal-sub">Pick one — Today will adjust to match.</p>
      ${rows}
      <p class="group-label">Or switch modes</p>
      <button class="choice choice-secondary" data-presenter-entry>
        <span class="choice-ic presenter">${icon("gauge", "filled")}</span>
        <span><b>Presenter Mode</b><small>A screen-share view for walkthroughs — not a time choice.</small></span>
      </button>`;
  }

  /* ---------- views ---------- */
  function today(state) {
    const mode = state.timeAvailable || "lots";
    const blocking = state.blocking();
    const fyi = state.informative();
    const hero = blocking[0];
    const rest = blocking.slice(1);
    const hiddenCount = rest.length + fyi.length;

    let stateLine;
    if (blocking.length === 0) {
      stateLine = "You've set today's direction.";
    } else if (mode === "zero") {
      stateLine = hiddenCount
        ? `One thing today. ${hiddenCount} more waiting when you have a minute.`
        : "One thing today.";
    } else {
      stateLine = `${blocking.length} ${blocking.length === 1 ? "decision needs" : "decisions need"} you · ${fyi.length} advancing on their own`;
    }

    let heroBlock;
    if (hero) {
      heroBlock = `<p class="focus-label">If you do one thing today</p>${heroCard(hero, 1)}`;
    } else {
      heroBlock = `<div class="cleared">${icon("check")}<h2>You've set today's direction.</h2><p>Every decision that needed you is resolved. The crew is handling the rest.</p></div>`;
    }

    const restBlock = mode !== "zero" && rest.length
      ? `<div class="stack"><p class="group-label">Also waiting on you</p>${rest.map((d, i) => compactCard(d, i + 2)).join("")}</div>`
      : "";

    let fyiBlock = "";
    if (mode === "lots" && fyi.length) {
      fyiBlock = `<div class="stack fyi-group"><p class="group-label">Advancing on their own${" "}<span class="muted-note">— tap to take one back</span></p>${fyi.map(fyiRow).join("")}</div>`;
    } else if (mode === "little" && fyi.length) {
      fyiBlock = `<p class="group-label">${fyi.length} ${fyi.length === 1 ? "item" : "items"} advancing on their own</p>`;
    }

    const deeperBlock =
      mode === "lots"
        ? `<div class="deeper-links">
             <p class="group-label">Have more time?</p>
             <button class="link-btn" data-view="agents">${icon("robot")}Review the agent floor</button>
             <button class="link-btn" data-view="evidence">${icon("nodes")}Browse the evidence map</button>
             <button class="link-btn" data-view="showcase">${icon("rocket")}See the rollout value showcase</button>
           </div>`
        : "";

    return `
      <header class="brief-greeting">
        <p class="date">${PL.today.label}</p>
        <h1>Good morning, ${PL.today.greetingName}.</h1>
        <p class="state-line" aria-live="polite">${stateLine}</p>
      </header>
      ${heroBlock}
      ${restBlock}
      ${fyiBlock}
      ${deeperBlock}
    `;
  }

  function decisions(state) {
    const blocking = state.blocking();
    const fyi = state.informative();
    return `
      <header class="page-head">
        <h1>Decisions</h1>
        <p>Ranked by production impact. Only what can't be safely inferred needs you.</p>
      </header>
      <div class="stack">${blocking.length ? blocking.map((d, i) => compactCard(d, i + 1)).join("") : `<div class="cleared small">${icon("check")}<p>Nothing needs a decision right now.</p></div>`}</div>
      ${fyi.length ? `<div class="stack fyi-group"><p class="group-label">Advancing on their own</p>${fyi.map(fyiRow).join("")}</div>` : ""}
    `;
  }

  function agents(state) {
    const status = { orchestrating: "Orchestrating", watching: "Watching", analyzing: "Analyzing", escalated: "Escalated" };
    const blockingCount = state ? state.blocking().length : PL.decisions.filter((d) => d.type === "decision").length;
    const informativeCount = state ? state.informative().length : PL.decisions.filter((d) => d.type === "informative").length;
    const cards = PL.agents
      .map((a) => {
        const esc = a.status === "escalated";
        // The Chief of Staff's finding is the one card that reports live counts (everyone else
        // reports a fixed observation) — computed here, not authored, so it can never drift
        // from what the Decisions/Today views actually show.
        const finding = a.id === "chief-of-staff"
          ? `Assembled today's briefing — routed ${blockingCount} to you, ${informativeCount} advancing on their own.`
          : a.finding;
        return `<article class="agent-card${esc ? " is-escalated" : ""}">
          <div class="agent-id">
            <span class="agent-ic">${icon(a.icon)}</span>
            <div><strong>${a.name}</strong><small>${a.monitors}</small></div>
            <span class="agent-status s-${a.status}">${status[a.status] || a.status}</span>
          </div>
          <p class="agent-finding">${finding}</p>
          ${esc ? `<button class="link-btn" data-open="${a.escalatedTo}">Escalated a decision to you ${icon("arrow-right")}</button>` : `<span class="agent-clear">${icon("check")}No action needed</span>`}
        </article>`;
      })
      .join("");
    const escCount = PL.agents.filter((a) => a.status === "escalated").length;
    return `
      <header class="page-head">
        <h1>Agent team</h1>
        <p>Eight specialists watch delivery around the clock. ${escCount} escalated something to you today; the rest are clear.</p>
      </header>
      <div class="agent-grid">${cards}</div>
    `;
  }

  function evidence() {
    const m = PL.evidenceMap;
    const treeRow = (n, child) => {
      const chev = n.children ? icon(n.open ? "chevron-down" : "chevron-right") : `<span class="tree-line"></span>`;
      return `<div class="tree-row${n.selected ? " selected" : ""}${child ? " child" : ""}">
          ${chev}<span class="tree-dot ${n.dot}"></span>
          <span class="tree-label"><strong>${n.label}</strong><small>${n.meta}</small></span><b>${n.count}</b>
        </div>`;
    };
    const tree = m.tree
      .map((n) => treeRow(n) + (n.children ? `<div class="tree-children">${n.children.map((c) => treeRow(c, true)).join("")}</div>` : ""))
      .join("");
    const sources = m.detail.sources.map(sourceCard).join("");
    return `
      <header class="page-head">
        <h1>Evidence map</h1>
        <p>Every decision connected to its goals, proof, and owner.</p>
      </header>
      <div class="evidence-layout">
        <section class="panel">
          <div class="panel-head"><div><h2>Goals & requirements</h2><small>30 mapped items</small></div></div>
          <div class="tree">${tree}</div>
        </section>
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
      </div>
    `;
  }

  /* ---------- show & tell ----------
     Delivery-lead-curated media (screenshots, graphics, short videos) attached to a
     decision or the rollout showcase. Renders nothing when unset — visible to the
     exec only once the delivery lead has actually populated it. */
  const ST_LABEL = { screenshot: "Screenshot", graphic: "Graphic", video: "Video" };
  function showAndTell(items) {
    if (!items || !items.length) return "";
    const tiles = items
      .map((it) => {
        const person = P[it.addedBy];
        const credit = person ? `${person.short || person.name}${person.role ? " · " + person.role : ""}` : "";
        return `<article class="st-tile">
            <div class="st-thumb st-${it.type}">
              ${icon(it.type === "video" ? "play" : "image", "st-ic")}
              <span class="st-kind">${ST_LABEL[it.type] || it.type}</span>
            </div>
            <div class="st-body">
              <b>${it.title}</b>
              <p>${it.caption}</p>
              ${credit ? `<span class="st-credit">Added by ${credit}</span>` : ""}
            </div>
          </article>`;
      })
      .join("");
    return `<section class="detail-block showtell">
        <div class="block-head"><h2>Show & tell</h2><span class="muted">${items.length} attached</span></div>
        <div class="st-grid">${tiles}</div>
      </section>`;
  }

  function sourceCard(s) {
    const label = { confirmed: "Confirmed", observed: "Observed", contradicts: "Contradicts" };
    return `<div class="source-card${s.kind === "conflict" ? " is-conflict" : ""}">
        <span class="source-ic k-${s.kind}">${icon(s.kind === "eval" ? "pulse" : s.kind === "conflict" ? "alert" : s.kind === "decision" ? "history" : "file")}</span>
        <span class="source-body"><b>${s.title}</b><small>${s.note}</small></span>
        <span class="claim c-${s.claim}">${label[s.claim] || s.claim}</span>
      </div>`;
  }

  function memory(state) {
    const groups = state.memory
      .map((g) => {
        const items = g.items
          .map(
            (it) => `<div class="tl-item${it.tone ? " " + it.tone : ""}">
              <span class="tl-dot${it.tone ? " " + it.tone : ""}">${icon(it.icon)}</span>
              <div><strong>${it.title}</strong><p>${it.body}</p><small>${it.meta}</small></div>
              ${it.status ? `<span class="pill ${it.tone || ""}">${it.status}</span>` : ""}
            </div>`
          )
          .join("");
        return `<div class="tl-day">${g.day}</div>${items}`;
      })
      .join("");
    return `
      <header class="page-head">
        <h1>Decision memory</h1>
        <p>What changed, why it changed, and who authorized it.</p>
      </header>
      <section class="panel timeline">${groups}</section>
    `;
  }

  /* ---------- brief detail ---------- */
  function brief(d) {
    if (!d) return `<div class="cleared"><p>Brief not found.</p></div>`;
    const rec = d.recommendation || {};
    const goals = (d.goals || [])
      .map((g) => {
        const map = { risk: ["down", "At risk", "alert"], up: ["up", "Improves", "trend-up"], flat: ["flat", "No change", "shield"] };
        const [c, tag, ic] = map[g.dir] || map.flat;
        return `<div class="goal-row"><span class="goal-ic ${c}">${icon(ic)}</span><div><strong>${g.title}</strong><p>${g.note}</p></div><span class="goal-tag ${c}">${tag}</span></div>`;
      })
      .join("");
    const ev = (d.evidence || []).map(sourceCard).join("");
    const trace = (d.trace || []).map((t) => `<div class="trace-row"><b>${t.label}</b><span>${t.body}</span></div>`).join("");
    const diff = d.diff
      ? `<section class="detail-block"><h2>What changed</h2>
           <div class="diff"><div class="d-minus"><span>−</span><code>${d.diff.before}</code></div><div class="d-plus"><span>+</span><code>${d.diff.after}</code></div></div>
           <p class="src-link">${icon("link")}${d.diff.source}</p></section>`
      : "";

    return `
      <button class="back" data-view="decisions">${icon("arrow-left")}Back to decisions</button>
      <div class="brief-detail">
        <div class="brief-detail-main">
          <div class="detail-header">
            <div class="detail-meta">${agentChip(d.agentId)}<span class="tag-consequence">${d.severity || "Decision"}</span></div>
            <h1>${d.title}</h1>
            <p class="detail-one">${d.one_liner}</p>
          </div>

          <section class="rec-card">
            <div class="rec-label">${icon("spark")}ProofLoop recommends</div>
            <h2>${rec.headline}</h2>
            <p>${rec.rationale}</p>
            <div class="confidence"><span><b>${confidenceScore(d)}%</b> evidence confidence</span><i class="conf-bar"><em style="width:${confidenceScore(d)}%"></em></i><button class="link-btn" data-conf="${d.id}">How confidence works</button></div>
          </section>

          ${diff}

          ${showAndTell(d.showAndTell)}

          ${goals ? `<section class="detail-block"><div class="block-head"><h2>Why it matters</h2><span class="badge coral">${d.goals.length} goals affected</span></div>${goals}</section>` : ""}

          ${ev ? `<section class="detail-block"><div class="block-head"><h2>Evidence reviewed</h2><span class="muted">${d.evidence.length} sources</span></div>${ev}
              ${trace ? `<button class="trace-toggle" data-trace>${icon("nodes")}Requirement-to-evidence trace ${icon("chevron-down", "chev")}</button><div class="trace" hidden>${trace}</div>` : ""}
            </section>` : ""}

          ${d.gate ? `<section class="gate">${icon("lock")}<div><span class="badge blue">Why you're seeing this</span><p>${d.gate}</p></div></section>` : ""}
        </div>

        <aside class="decide-panel">
          <div class="decide-card">
            <span class="badge blue">Your decision</span>
            <h2>How should the team proceed?</h2>
            <button class="choice recommended" data-decide="approve" data-id="${d.id}"><span class="choice-ic">${icon("check")}</span><span><b>Approve${rec.choice === "approve" ? " (recommended)" : ""}</b><small>${rec.headline}</small></span></button>
            <button class="choice" data-decide="revise" data-id="${d.id}"><span class="choice-ic revise">${icon("edit")}</span><span><b>Request revision</b><small>Send specific conditions to the team.</small></span></button>
            <button class="choice" data-decide="reject" data-id="${d.id}"><span class="choice-ic reject">${icon("x")}</span><span><b>Reject change</b><small>Keep the current behavior.</small></span></button>
            <p class="decide-note">${icon("lock")}Your decision and its evidence are added to decision memory.</p>
          </div>
        </aside>
      </div>
    `;
  }

  /* ---------- profile shell (A1) ----------
     Reached by tapping the user avatar / user-card (app.js wires those as
     data-view="profile"). This view is a SHARED SHELL — later build items add
     their own content by replacing the body of the two seam functions below.
     Do not add that content inline inside profile(); add it inside the seam
     function instead, so the header markup here never needs to change. */
  function valueFocusCard(v, selected) {
    return `<button type="button" class="choice vf-card${selected ? " is-selected" : ""}" data-vf="${v.key}" aria-pressed="${selected ? "true" : "false"}">
        <span class="choice-ic vf-ic${selected ? " is-on" : ""}">${icon(selected ? "check" : "spark")}</span>
        <span class="vf-body">
          <b>${v.label}</b>
          <small class="vf-framing">“${v.framing}”</small>
          <span class="vf-kpi"><i>Primary KPI</i>${v.primaryKpi}</span>
          <span class="vf-kpi vf-kpi-supporting"><i>Also tracks</i>${v.supportingKpis.join(" · ")}</span>
        </span>
      </button>`;
  }

  function valueFocusSection(state) {
    const selected = state.valueFocus || [];
    const cards = PL.valueFocusTaxonomy.map((v) => valueFocusCard(v, selected.indexOf(v.key) !== -1)).join("");
    const n = selected.length;
    const status =
      n === 0 ? "Pick 2–3 focus areas — ProofLoop will surface matching decisions first, still ranked by impact."
      : n === 1 ? "1 selected — the Decisions queue already surfaces it first, ranked by impact. Pick 1–2 more for fuller coverage."
      : `${n} selected — the Decisions queue now surfaces these first, ranked by impact within that group.`;
    return `<section class="detail-block vf-section">
        <div class="block-head"><h2>Value focus</h2><span class="muted">${n} of 3 selected</span></div>
        <p class="vf-intro">What should ProofLoop optimize for, in your words? Pick 2–3 — each shows the primary metric plus what it rolls up.</p>
        <div class="vf-grid">${cards}</div>
        <p class="vf-status" aria-live="polite">${status}</p>
      </section>`;
  }

  function decisionLogRow(row, i) {
    return `<article class="rd-row">
        <div class="rd-body">
          <b class="rd-title">${row.decisionTitle}</b>
          <span class="rd-decider">${icon("check", "rd-ic")}Decided by <b>${row.decidedBy}</b></span>
          ${row.conditional ? `<span class="rd-conditional">${icon("lock", "rd-ic")}Conditional: ${row.conditional}</span>` : ""}
          <p class="rd-impact">${row.impactSummary}</p>
        </div>
        <button class="link-btn rd-concern" data-concern="${i}">${icon("alert")}Raise a concern</button>
      </article>`;
  }

  function profileValueFocusSeam(state) {
    // VALUE_FOCUS_SEAM (A2) — superseded by the Value Model: the picker below is now the
    // engagement-grade badge (data-grounding maturity across every lever) plus a link into
    // the full Value Model screen. Queue re-ranking (feature #7) still works — it's now
    // driven by activeFocusKeys() (app.js), the set of levers with a named goal, rather
    // than a manual 2-3 pick list. valueFocusSection/valueFocusCard stay defined below,
    // unused, in case a future taxonomy-only picker is wanted again.
    const grade = engagementGrade(state.valueModel);
    return `<section class="detail-block vf-section">
        <div class="block-head"><h2>Value Model</h2><span class="muted">${grade.label}</span></div>
        ${gradeBadgeHtml(grade)}
        <button class="link-btn" data-view="valuemodel">${icon("trend-up")}Open the Value Model ${icon("arrow-right")}</button>
      </section>`;
  }
  function profileRecentDecisionsSeam(state) {
    // RECENT_DECISIONS_SEAM (A3) — recent-decisions log: who decided, any
    // conditions attached, and the impact, with a one-tap way to flag a
    // concern about a call that's already been made.
    const log = PL.decisionLog || [];
    const rows = log.map((row, i) => decisionLogRow(row, i)).join("");
    return `
      <section class="detail-block recent-decisions">
        <div class="block-head"><h2>Recent decisions</h2><span class="muted">${log.length} logged</span></div>
        <p class="rd-lede">Who decided, any conditions attached, and the impact — with a one-tap way to flag a concern about a call that's already been made.</p>
        <div class="stack rd-stack">${rows || `<p class="muted">No decisions logged yet.</p>`}</div>
      </section>
    `;
  }

  function profile(state) {
    const u = PL.user;
    return `
      <button class="back" data-view="today">${icon("arrow-left")}Back to today</button>
      <div class="profile-view">
        <header class="profile-head">
          <span class="user-ava profile-ava">${u.initials}</span>
          <div class="profile-id">
            <h1>${u.name}</h1>
            <p class="profile-role">${u.role}</p>
            <p class="profile-ws">${PL.workspace.name}</p>
          </div>
        </header>

        <div class="choice">
          <span class="choice-ic">${icon("shield")}</span>
          <span><b>Scope of authority</b><small>Accountable for customer-service behavior & rollout gates; consulted on revenue and compliance.</small></span>
        </div>

        ${profileValueFocusSeam(state)}
        ${profileRecentDecisionsSeam(state)}
      </div>
    `;
  }

  /* ---------- rollout: value showcase ---------- */
  function showcase() {
    const r = PL.rollout;
    const billing = PL.decisions.find((d) => d.id === "d-billing-golive");
    const confidence = confidenceScore(billing);
    const kpis = r.kpis
      .map(
        (k) => `<article class="kpi">
          <span class="kpi-label">${k.label}</span>
          <span class="kpi-nums"><b>${k.before}${k.unit}</b>${icon("arrow-right", "kpi-arrow")}<b class="kpi-after">${k.after}${k.unit}</b></span>
          <span class="kpi-delta ${k.dir}">${k.delta}</span>
        </article>`
      )
      .join("");
    const ev = r.evidence.map(sourceCard).join("");
    return `
      <button class="back" data-view="today">${icon("arrow-left")}Back to briefing</button>
      <div class="showcase">
        <div class="showcase-main">
          <div class="detail-header">
            <div class="detail-meta"><span class="agent-chip">${icon("rocket")}Rollout Manager</span><span class="tag-consequence">Rollout gate</span></div>
            <h1>${r.agentName}</h1>
            <p class="detail-one">${r.subtitle}</p>
          </div>
          <div class="value-banner">
            <div><small>Projected value</small><b>${r.dollarsSaved}</b><span>${r.dollarsNote}</span></div>
            <div class="conf-side"><small>Evidence confidence</small><b>${confidence}%</b><i class="conf-bar"><em style="width:${confidence}%"></em></i></div>
          </div>
          <div class="kpi-grid">${kpis}</div>
          ${showAndTell(r.showAndTell)}
          <section class="detail-block"><div class="block-head"><h2>Evidence for the decision</h2><span class="muted">${r.evidence.length} sources</span></div>${ev}</section>
        </div>
        <aside class="decide-panel">
          <div class="decide-card">
            <span class="badge blue">Go / no-go</span>
            <h2>Approve the pilot rollout?</h2>
            <p class="decide-sub">The Rollout Manager drafted a staged pilot with guardrails and rollback triggers.</p>
            <button class="btn primary block" data-view="pilot">Review the pilot plan ${icon("arrow-right")}</button>
            <button class="choice" data-decide="reject" data-id="${PL.rollout ? "d-billing-golive" : ""}"><span class="choice-ic reject">${icon("x")}</span><span><b>Hold rollout</b><small>Keep the agent in shadow mode.</small></span></button>
          </div>
        </aside>
      </div>
    `;
  }

  /* ---------- rollout: pilot planner ---------- */
  function pilot() {
    const r = PL.rollout;
    const steps = r.cohorts
      .map(
        (c, i) => `<div class="cohort ${c.status}">
          <span class="cohort-node">${c.status === "proposed" ? c.pct : icon("lock")}</span>
          <div class="cohort-body">
            <div class="cohort-top"><b>${c.pct}</b><span class="cohort-window">${c.window}</span></div>
            <p>${c.label}</p>
            <span class="cohort-gate">${icon("check")}Advances when: ${c.gate}</span>
          </div>
        </div>`
      )
      .join("");
    const guard = r.guardrails.map((g) => `<li>${icon("shield")}${g}</li>`).join("");
    const rollback = r.rollbackTriggers.map((g) => `<li>${icon("alert")}${g}</li>`).join("");
    return `
      <button class="back" data-view="showcase">${icon("arrow-left")}Back to value showcase</button>
      <div class="pilot">
        <div class="pilot-main">
          <div class="detail-header">
            <div class="detail-meta"><span class="agent-chip">${icon("rocket")}Rollout Manager</span><span class="tag-consequence">Pilot plan</span></div>
            <h1>Staged pilot rollout</h1>
            <p class="detail-one">Start small, prove each gate, then widen. Rollback is automatic if a trigger fires.</p>
          </div>
          <section class="detail-block"><h2>Cohorts</h2><div class="cohorts">${steps}</div></section>
          <div class="two-up">
            <section class="detail-block"><h2>Guardrails</h2><ul class="rule-list">${guard}</ul></section>
            <section class="detail-block"><h2>Auto-rollback triggers</h2><ul class="rule-list danger">${rollback}</ul></section>
          </div>
        </div>
        <aside class="decide-panel">
          <div class="decide-card">
            <span class="badge blue">Go / no-go</span>
            <h2>Launch the 5% pilot?</h2>
            <button class="choice recommended" data-decide="approve" data-id="d-billing-golive"><span class="choice-ic">${icon("check")}</span><span><b>Approve pilot (recommended)</b><small>Launch to 5%, expand on each gate.</small></span></button>
            <button class="choice" data-decide="revise" data-id="d-billing-golive"><span class="choice-ic revise">${icon("edit")}</span><span><b>Adjust the plan</b><small>Change cohorts or guardrails first.</small></span></button>
            <button class="choice" data-decide="reject" data-id="d-billing-golive"><span class="choice-ic reject">${icon("x")}</span><span><b>Hold rollout</b><small>Stay in shadow mode.</small></span></button>
            <p class="decide-note">${icon("lock")}The go/no-go and its evidence are added to decision memory.</p>
          </div>
        </aside>
      </div>
    `;
  }

  /* ---------- presenter mode: decision cockpit ----------
     Matches docs/presenter-cockpit-mockup.html. Every number here is read straight off
     PL.decisions/PL.features/state — nothing is hand-authored for this view. The Impact
     Score tap (data-cockpit-score, wired in app.js) reuses the same score()/contributions()/
     breakdown() honest-arithmetic pipeline as the "see the math" flow elsewhere. */
  function featureFor(d) {
    return (PL.features || []).find((f) => (f.decisionIds || []).indexOf(d.id) !== -1);
  }

  function cockpitWhoChip(d) {
    const r = d.raci || {};
    const consultedTag = (id) => (P[id] ? `<span class="tag">C: ${P[id].short}</span>` : "");
    if (r.a === PL.user.id) {
      return `<span class="who-chip is-you"><i>A</i>You${r.c && r.c[0] ? consultedTag(r.c[0]) : ""}</span>`;
    }
    const p = P[r.a];
    return `<span class="who-chip is-other"><i>${p ? p.initials : "?"}</i>${p ? p.short : r.a}</span>`;
  }

  function cockpitDashboardHead() {
    return `<div class="dgrid head">
        <span>Decision</span><span>Surfacing agent</span><span>Decides</span><span>Recommendation</span><span>Build item</span><span>Unblocks</span><span>Impact</span><span></span>
      </div>`;
  }

  function cockpitDashboardRow(d) {
    const sig = d.signals || {};
    const f = featureFor(d);
    const n = sig.blocksToday || 0;
    const rec = d.recommendation || {};
    return `<div class="dgrid drow">
        <div><div class="d-title">${d.title}</div><div class="d-sub">${d.one_liner}</div></div>
        ${agentChip(d.agentId)}
        ${cockpitWhoChip(d)}
        <span class="d-rec">${rec.headline || ""}</span>
        <span class="feat-pill${f ? "" : " none"}">${f ? f.name : "— cross-cutting"}</span>
        <span class="unblk${n ? "" : " zero"}">${n ? n + " task" + (n === 1 ? "" : "s") : "—"}</span>
        <button class="d-score" data-cockpit-score="${d.id}" aria-label="See how the impact score for ${d.title} adds up">${score(d.impact)}</button>
        <div class="d-actions">
          <button class="abtn approve" data-decide="approve" data-id="${d.id}" aria-label="Approve">${icon("check")}</button>
          <button class="abtn revise" data-decide="revise" data-id="${d.id}" aria-label="Request revision">${icon("edit")}</button>
          <button class="abtn reject" data-decide="reject" data-id="${d.id}" aria-label="Reject">${icon("x")}</button>
        </div>
      </div>`;
  }

  // Fed entirely by the live Value Model, not by resolved decisions — a lever's modeled
  // range counts here the moment it's grounded enough to price, whether or not any decision
  // tied to it has been decided yet. direction ("cost" vs "revenue") comes from the matching
  // valueFocusTaxonomy entry; delivery time-at-risk is the ONLY delivery number shown, in
  // days — never converted to a dollar.
  function cockpitValuePanel(state) {
    const model = state.valueModel || liveModel();
    const grade = engagementGrade(model);
    const valueLevers = model.filter((l) => l.kind === "value");
    const byDirection = (dir) => valueLevers.filter((l) => (taxonomyFor(l.key) || {}).direction === dir);
    const sumRange = (levers) => {
      let lo = 0, hi = 0, any = false;
      levers.forEach((l) => {
        const r = deliveryAdjustedRange(l);
        if (r.qualitative || r.metricOnly) return;
        lo += r.lo; hi += r.hi; any = true;
      });
      return any ? { lo, hi } : null;
    };
    const caption = (levers, verb) => {
      const named = levers.filter((l) => leverRung(l) >= 1);
      if (!named.length) return "No levers named yet.";
      const labels = named.slice(0, 2).map((l) => taxonomyLabel(l.key));
      return `${labels.join(", ")}${named.length > 2 ? ` + ${named.length - 2} more` : ""} — ${verb}.`;
    };
    const fmtRange = (r) => (r ? `${fmtDollars(r.lo)}–${fmtDollars(r.hi)}` : "still qualitative");
    const cost = byDirection("cost");
    const revenue = byDirection("revenue");
    const totalSlipDays = model.filter((l) => l.kind === "delivery").reduce((sum, l) => sum + ((l.model && l.model.slipDays) || 0), 0);
    return `<div class="vpanel">
        <div class="vhead"><h3>Value from the model</h3><span class="pill">${grade.label} · L${grade.rung}</span></div>
        <div class="vstats">
          <div class="vstat risk"><div class="lbl">Cost saved / risk mitigated</div><div class="num">${fmtRange(sumRange(cost))}</div><div class="cap">${caption(cost, "cost/risk levers")}</div></div>
          <div class="vdivider"></div>
          <div class="vstat opp"><div class="lbl">Value unlocked</div><div class="num">${fmtRange(sumRange(revenue))}</div><div class="cap">${caption(revenue, "revenue levers")}</div></div>
          <div class="vdivider"></div>
          <div class="vstat delivery"><div class="lbl">Delivery time at risk</div><div class="num">${totalSlipDays}d</div><div class="cap">${totalSlipDays ? "slip is deferring when value starts — not a dollar figure" : "nothing slipping right now"}</div></div>
        </div>
      </div>`;
  }

  function cockpitBuildItems(state) {
    const features = PL.features || [];
    const rows = features
      .map((f) => {
        const ids = f.decisionIds || [];
        const open = ids.filter((id) => !state.resolved[id]).length;
        return `<div class="cx-frow">
            <span class="name">${f.name}</span>
            <span class="pill ${f.status}">${f.status}</span>
            <span class="desc">${f.summary} — ${ids.length} decision${ids.length === 1 ? "" : "s"} linked, ${open} still open</span>
          </div>`;
      })
      .join("");
    return `<div class="cx-card cx-card-pad">
        <div class="cx-card-title"><h3>Build items</h3><span class="cx-card-cnt">${features.length} features</span></div>
        <div class="cx-build">${rows}</div>
      </div>`;
  }

  function cockpitScoreModal(d) {
    const rec = d.recommendation || {};
    const ev = (d.evidence || []).map(sourceCard).join("");
    return `
      ${breakdown(d)}
      <section class="rec-card">
        <div class="rec-label">${icon("spark")}ProofLoop recommends</div>
        <h2>${rec.headline || ""}</h2>
        <p>${rec.rationale || ""}</p>
      </section>
      ${ev ? `<section class="detail-block"><div class="block-head"><h2>Key evidence</h2><span class="muted">${d.evidence.length} sources</span></div><div class="stack">${ev}</div></section>` : ""}
      <div class="modal-actions">
        <button class="btn ghost" data-decide="reject" data-id="${d.id}">${icon("x")}Reject</button>
        <button class="btn ghost" data-decide="revise" data-id="${d.id}">${icon("edit")}Revise</button>
        <button class="btn primary" data-decide="approve" data-id="${d.id}">${icon("check")}Approve</button>
      </div>
    `;
  }

  function presenter(state) {
    const open = state
      .all()
      .filter((d) => d.type === "decision" && !state.resolved[d.id])
      .sort((a, b) => score(b.impact) - score(a.impact));
    const advancing = state.all().filter((d) => d.type === "informative" && !state.resolved[d.id]).length;
    const rows = open.map(cockpitDashboardRow).join("");
    return `
      <button class="back" data-view="today">${icon("arrow-left")}Back to Today</button>
      <div class="cockpit">
        <div class="cockpit-head">
          <div class="who"><span class="badge">Presenter Mode</span><span class="ws">${PL.workspace.name} · ${PL.workspace.env}</span></div>
          <span class="status-line">${open.length} decision${open.length === 1 ? "" : "s"} need you · ${advancing} advancing on ${advancing === 1 ? "its" : "their"} own</span>
        </div>

        <div class="cx-card cx-card-pad">
          <div class="cx-card-title"><h3>Decision Dashboard</h3><span class="cx-card-cnt">sorted by impact · ${open.length} open</span></div>
          ${cockpitDashboardHead()}
          ${rows || `<p class="muted">No open decisions — nice work.</p>`}
        </div>

        ${cockpitValuePanel(state)}

        ${cockpitBuildItems(state)}
      </div>
    `;
  }

  /* ---------- build view: read-only feature snapshot ----------
     Static, no live Jira/backend — a card per PL.features entry, linking to its decisions
     via the existing data-open brief navigation (blocking = type "decision", informing =
     type "informative"). */
  function buildFeatureCard(f, state) {
    const links = (f.decisionIds || [])
      .map((id) => {
        const d = state.decisionFor(id);
        if (!d) return "";
        const blocking = d.type === "decision" && !state.resolved[id];
        const label = state.resolved[id] ? "Decided" : blocking ? "Blocking" : "Informing";
        return `<button class="link-btn" data-open="${id}">${icon(blocking ? "alert" : "check")}<b>${label}:</b> ${d.title}</button>`;
      })
      .join("");
    return `<article class="build-card">
        <div class="build-card-head">
          <h2>${f.name}</h2>
          <span class="pill ${f.status}">${f.status}</span>
        </div>
        <p class="build-summary">${f.summary}</p>
        <div class="build-progress" role="img" aria-label="${f.progress}% complete"><i style="width:${f.progress}%"></i></div>
        <div class="build-links stack">${links || `<p class="muted">No linked decisions.</p>`}</div>
      </article>`;
  }

  function buildView(state) {
    const cards = (PL.features || []).map((f) => buildFeatureCard(f, state)).join("");
    return `
      <header class="page-head">
        <h1>Build</h1>
        <p>What's actually being built, and which decisions are blocking or informing it. Static snapshot, not live Jira data.</p>
      </header>
      <div class="build-group">${cards}</div>
    `;
  }

  window.PLRender = {
    icon, score, today, decisions, agents, evidence, memory, brief, showcase, pilot, breakdown, whyLine, timePicker,
    confidenceScore, confidenceBreakdown, presenter, profile, cockpitScoreModal, buildView,
    // Value Model — leverRung/leverForDecision/leverValueRange/valueBand are called directly
    // by app.js (activeFocusKeys, applyModeledValue); valueModel is the routed view.
    leverRung, leverForDecision, leverValueRange, valueBand, valueModel,
    // Derivation layer — classifyEscalation/routeOwner are called directly by app.js
    // (decisionFor/all(), the commitment guardrail) as well as internally by raci()/breakdown().
    classifyEscalation, routeOwner
  };
})();
