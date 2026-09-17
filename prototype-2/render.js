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
  function valueBand(s) {
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

  // Plain-language basis for a factor's band, read straight from the signals.
  function provenance(key, d) {
    const s = d.signals || {};
    const m = d.metrics || {};
    if (key === "value") {
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
        const band = BAND_FN[c.key](sig);
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
    return `<div class="breakdown">
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

  /* ---------- RACI ---------- */
  function raci(d) {
    const r = d.raci || {};
    const names = (arr) => (arr || []).map((id) => P[id] ? P[id].initials : id).join(" · ");
    const isYou = r.a === PL.user.id;
    const aName = isYou ? "You" : (P[r.a] ? P[r.a].short : r.a);
    const items = [];
    items.push(`<span class="raci-item is-a" title="Accountable — the decider"><i>A</i><span>${aName}</span></span>`);
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
      ${rows}`;
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

  function agents() {
    const status = { orchestrating: "Orchestrating", watching: "Watching", analyzing: "Analyzing", escalated: "Escalated" };
    const cards = PL.agents
      .map((a) => {
        const esc = a.status === "escalated";
        return `<article class="agent-card${esc ? " is-escalated" : ""}">
          <div class="agent-id">
            <span class="agent-ic">${icon(a.icon)}</span>
            <div><strong>${a.name}</strong><small>${a.monitors}</small></div>
            <span class="agent-status s-${a.status}">${status[a.status] || a.status}</span>
          </div>
          <p class="agent-finding">${a.finding}</p>
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
    // VALUE_FOCUS_SEAM — a later feature renders its "Value Focus" module here.
    // Replace this function's return value (or have it call a new render.js
    // function, then add that function to the window.PLRender export object)
    // with the real markup. `state` is already passed in for that feature to
    // read (e.g. state.all() / state.blocking()) without re-plumbing anything.
    return `<!-- VALUE_FOCUS_SEAM: render "Value Focus" content here -->`;
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
            <div class="conf-side"><small>Evidence confidence</small><b>${r.confidence}%</b><i class="conf-bar"><em style="width:${r.confidence}%"></em></i></div>
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

  window.PLRender = { icon, score, today, decisions, agents, evidence, memory, brief, showcase, pilot, breakdown, whyLine, timePicker, confidenceScore, confidenceBreakdown, profile };
})();
