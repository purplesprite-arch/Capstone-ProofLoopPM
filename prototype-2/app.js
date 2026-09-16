/* ProofLoop Prototype 2 — state + interaction.
   Loaded LAST (after data.js and render.js). Event delegation on document,
   so re-rendering a view never loses listeners. */

(function () {
  const PL = window.PL;
  const R = window.PLRender;

  /* ---------- runtime state ---------- */
  // We clone the decision types so the demo can mutate them (toggle, resolve)
  // without editing the seed data.
  const state = {
    view: "today",
    types: {},          // decisionId -> "decision" | "informative"
    resolved: {},       // decisionId -> outcome label
    timeAvailable: null, // "zero" | "little" | "lots" — asked once per open, never persisted
    memory: PL.memory.map((g) => ({ day: g.day, items: g.items.slice() })),

    decisionFor(id) {
      const d = PL.decisions.find((x) => x.id === id) || (id === "d-billing-golive" ? billingDecision() : null);
      if (!d) return null;
      return Object.assign({}, d, { type: this.types[d.id] || d.type });
    },
    all() {
      return PL.decisions.map((d) => Object.assign({}, d, { type: this.types[d.id] || d.type }));
    },
    blocking() {
      return this.all()
        .filter((d) => d.type === "decision" && !this.resolved[d.id])
        .sort((a, b) => R.score(b.impact) - R.score(a.impact));
    },
    informative() {
      return this.all()
        .filter((d) => d.type === "informative" && !this.resolved[d.id])
        .sort((a, b) => R.score(b.impact) - R.score(a.impact));
    }
  };
  function billingDecision() {
    return PL.decisions.find((d) => d.id === "d-billing-golive");
  }

  /* ---------- view routing ---------- */
  const mount = () => document.getElementById("view");

  function render() {
    const el = mount();
    const v = state.view;
    let html = "";
    if (v === "today") html = R.today(state);
    else if (v === "decisions") html = R.decisions(state);
    else if (v === "agents") html = R.agents();
    else if (v === "evidence") html = R.evidence();
    else if (v === "memory") html = R.memory(state);
    else if (v === "showcase") html = R.showcase();
    else if (v === "pilot") html = R.pilot();
    else if (v === "profile") html = R.profile(state);
    else if (v && v.indexOf("brief:") === 0) html = R.brief(state.decisionFor(v.slice(6)));
    else html = R.today(state);

    el.innerHTML = html;
    el.classList.remove("view-enter");
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("view-enter");

    // nav highlighting (map push-views back to a tab)
    const navKey = v === "showcase" || v === "pilot" || v === "profile" ? "today" : v.indexOf("brief:") === 0 ? "decisions" : v;
    document.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("active", t.dataset.tab === navKey));

    // live "needs you" badge on the Decisions tab
    const bc = state.blocking().length;
    document.querySelectorAll('[data-count="decisions"]').forEach((el) => {
      el.textContent = bc;
      el.style.display = bc ? "" : "none";
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go(view) {
    state.view = view;
    history.replaceState(null, "", "#" + view);
    render();
  }

  /* ---------- interactions (delegated) ---------- */
  let gateOpen = false;

  document.addEventListener("click", (e) => {
    const t = e.target;

    // time-available gate: pick a tier
    const timePick = t.closest("[data-time]");
    if (timePick) {
      state.timeAvailable = timePick.dataset.time;
      gateOpen = false;
      closeModal();
      render();
      return;
    }

    // tab bar / sidebar / back buttons
    const nav = t.closest("[data-view]");
    if (nav) { go(nav.dataset.view); return; }

    // open a decision brief (rollout routes to the showcase)
    const open = t.closest("[data-open]");
    if (open) {
      const id = open.dataset.open;
      const d = state.decisionFor(id);
      if (d && d.isRollout) go("showcase");
      else go("brief:" + id);
      return;
    }

    // agent chip → agents floor
    const gotoAgent = t.closest("[data-goto-agent]");
    if (gotoAgent) { go("agents"); return; }

    // Decision <-> Informative toggle
    const seg = t.closest("[data-set]");
    if (seg) {
      const wrap = seg.closest("[data-toggle]");
      const id = wrap.dataset.toggle;
      const next = seg.dataset.set;
      const base = PL.decisions.find((x) => x.id === id);
      state.types[id] = next;
      const moved = next === "informative";
      const who = base && base.delegateTo && PL.people[base.delegateTo] ? PL.people[base.delegateTo].short : "the team";
      render();
      if (moved) showToast("Now informative", `Accountability delegated to ${who}. It advances on its own — tap to take it back.`);
      else showToast("Back on your desk", "Added to the decisions that need you, ranked by impact.");
      return;
    }

    // quick decide (briefing + brief detail + rollout)
    const decide = t.closest("[data-decide]");
    if (decide) { openDecision(decide.dataset.decide, decide.dataset.id); return; }

    // why → scroll-free reveal of the score math (uses a modal)
    const why = t.closest("[data-why]");
    if (why) { openBreakdown(why.dataset.why); return; }

    // score badge tap → breakdown
    const scoreTap = t.closest("[data-score]");
    if (scoreTap) { openBreakdown(scoreTap.dataset.score); return; }

    // evidence trace expander
    const traceBtn = t.closest("[data-trace]");
    if (traceBtn) {
      const trace = traceBtn.parentElement.querySelector(".trace");
      const chev = traceBtn.querySelector(".chev");
      if (trace) trace.hidden = !trace.hidden;
      if (chev) chev.classList.toggle("rotated");
      return;
    }

    // confidence explainer → real computed breakdown, same treatment as the Impact Score's "why"
    const confBtn = t.closest("[data-conf]");
    if (confBtn) { openConfidenceBreakdown(confBtn.dataset.conf); return; }

    // modal close (the time-gate has no dismiss — picking a tier is the only way out)
    if (t.closest("[data-close]") || t.classList.contains("modal-backdrop")) { if (!gateOpen) closeModal(); return; }

    // confirm a decision
    if (t.closest("#confirm-decision")) { confirmDecision(); return; }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !gateOpen) closeModal(); });

  /* ---------- time-available gate ---------- */
  function openTimeGate() {
    document.getElementById("modal-body").innerHTML = R.timePicker();
    gateOpen = true;
    openModal();
  }

  /* ---------- score breakdown modal ---------- */
  function openBreakdown(id) {
    const d = state.decisionFor(id);
    if (!d) return;
    const body = document.getElementById("modal-body");
    body.innerHTML = `<div class="modal-head"><h2>Why this ranks where it does</h2><button class="icon-btn" data-close>${R.icon("x")}</button></div>
      <p class="modal-sub">${d.title}</p>
      ${R.breakdown(d)}
      <p class="modal-foot">Score = 0.35·value + 0.30·unblocks + 0.20·reach + 0.15·urgency. Weights are tuned to protect production value first.</p>`;
    openModal();
  }

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

  /* ---------- decision confirm modal ---------- */
  let pending = { action: "approve", id: null };
  const copy = {
    approve: ["Approve this direction?", "Records your authorization and tells the delivery crew to proceed with the recommended guardrail.", "Confirm approval", "Approved"],
    revise: ["Request a revision?", "Add conditions and the crew will treat them as confirmed context for the next build and eval cycle.", "Send revision", "Revision requested"],
    reject: ["Reject this change?", "The crew keeps the current behavior. Your rationale is preserved for future recommendations.", "Confirm rejection", "Change rejected"]
  };
  function openDecision(action, id) {
    pending = { action, id };
    const c = copy[action];
    const d = state.decisionFor(id);
    const body = document.getElementById("modal-body");
    body.innerHTML = `<div class="modal-head"><h2 id="decision-title">${c[0]}</h2><button class="icon-btn" data-close>${R.icon("x")}</button></div>
      <p class="modal-sub">${d ? d.title : ""}</p>
      <p class="modal-desc">${c[1]}</p>
      ${action !== "approve" ? `<textarea class="note" id="decision-note" placeholder="${action === "revise" ? "e.g. Ship it, but cap handoff at 30 seconds." : "e.g. Not until the 47-second edge case is fixed."}"></textarea>` : ""}
      <div class="modal-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="confirm-decision">${c[2]}</button></div>`;
    openModal();
  }
  function confirmDecision() {
    const { action, id } = pending;
    const c = copy[action];
    const d = state.decisionFor(id);
    state.resolved[id] = c[3];
    closeModal();

    // write to decision memory
    const tone = action === "approve" ? "approved" : action === "reject" ? "rejected" : "revised";
    const ic = action === "approve" ? "check" : action === "reject" ? "x" : "edit";
    const today = state.memory.find((g) => g.day === "Today");
    const entry = { icon: ic, tone, title: `${c[3]} — ${d ? d.title : id}`, body: (d && d.recommendation ? d.recommendation.headline : "Direction set by you."), meta: "Just now · resolved by you", status: c[3] };
    if (today) today.items.unshift(entry);

    showToast(c[3], "Delivery crew notified. Added to decision memory.");

    // return to the briefing so the next decision surfaces into the hero slot
    setTimeout(() => go(state.view.indexOf("brief:") === 0 || state.view === "showcase" || state.view === "pilot" ? "today" : state.view), 900);
  }

  /* ---------- modal plumbing ---------- */
  const modal = () => document.getElementById("modal");
  function openModal() { const m = modal(); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); }
  function closeModal() { const m = modal(); m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }

  /* ---------- toast ---------- */
  function showToast(title, message) {
    const toast = document.getElementById("toast");
    toast.querySelector("strong").textContent = title;
    toast.querySelector("p").textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__t);
    window.__t = setTimeout(() => toast.classList.remove("show"), 4200);
  }
  document.getElementById("toast").addEventListener("click", (e) => {
    if (e.target.closest("[data-dismiss]")) document.getElementById("toast").classList.remove("show");
  });

  /* ---------- boot ---------- */
  const setAll = (sel, text) => document.querySelectorAll(sel).forEach((n) => (n.textContent = text));
  setAll(".ws-name", PL.workspace.name);
  setAll(".ws-context", PL.workspace.context + " · " + PL.workspace.env);
  setAll(".user-ava", PL.user.initials);
  setAll(".user-name", PL.user.name);
  setAll(".user-role", PL.user.role);

  const initial = location.hash.replace("#", "");
  const valid = ["today", "decisions", "agents", "evidence", "memory", "showcase", "pilot", "profile"];
  state.view = valid.includes(initial) || initial.indexOf("brief:") === 0 ? initial : "today";
  render();
  openTimeGate();
})();
