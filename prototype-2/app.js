/* ProofLoop Prototype 2 — state + interaction.
   Loaded LAST (after data.js and render.js). Event delegation on document,
   so re-rendering a view never loses listeners. */

(function () {
  const PL = window.PL;
  const R = window.PLRender;

  /* ---------- Value Focus (A2): persistence + queue re-ranking ----------
     FIRST use of persistence anywhere in this prototype — everything else here is
     purely in-memory (see state.types/state.resolved). localStorage access is wrapped
     in try/catch throughout so a disabled/unavailable store (private mode, file://
     restrictions, storage quota) degrades to a session-only selection instead of
     throwing. The Impact Score itself (R.score) is never touched — only the ORDER
     decisions are listed in changes, via the comparator below.
     NOTE: this block must be defined (in particular VALUE_FOCUS_STORAGE_KEY, a `const`)
     before `state` below, since state's initializer calls loadValueFocus() eagerly —
     a `const` is not hoisted the way a `function` declaration is, so declaring it after
     `state` throws a "Cannot access before initialization" TDZ error the first time
     the app boots (caught locally, but it silently discarded the persisted selection —
     confirmed with a real page load + reload during verification, not just read by eye). */
  const VALUE_FOCUS_STORAGE_KEY = "proofloop.valueFocus";
  function loadValueFocus() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(VALUE_FOCUS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const known = PL.valueFocusTaxonomy.map((v) => v.key);
      return Array.isArray(parsed) ? parsed.filter((k) => known.indexOf(k) !== -1) : [];
    } catch (e) {
      return []; // localStorage unavailable — start empty, selection still works this session
    }
  }
  function saveValueFocus(keys) {
    try {
      if (window.localStorage) window.localStorage.setItem(VALUE_FOCUS_STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
      // localStorage unavailable — selection stays in memory for this session only
    }
  }
  function toggleValueFocus(key) {
    const cur = state.valueFocus.slice();
    const i = cur.indexOf(key);
    if (i !== -1) {
      cur.splice(i, 1);
    } else if (cur.length >= 3) {
      showToast("Pick at most 3", "Remove one focus area before adding another.");
      return;
    } else {
      cur.push(key);
    }
    state.valueFocus = cur;
    saveValueFocus(cur);
    render();
  }
  // Two-tier sort: focus-matching decisions first, then the EXISTING, UNMODIFIED Impact
  // Score decides order both within and across that grouping. score() is untouched.
  function matchesFocus(d, focusKeys) {
    if (!focusKeys || !focusKeys.length) return false;
    const tags = (PL.valueFocusTagMap && PL.valueFocusTagMap[d.id]) || [];
    return tags.some((t) => focusKeys.indexOf(t) !== -1);
  }
  function rankByFocusThenScore(focusKeys) {
    return (a, b) => {
      const fa = matchesFocus(a, focusKeys) ? 0 : 1;
      const fb = matchesFocus(b, focusKeys) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return R.score(b.impact) - R.score(a.impact);
    };
  }

  /* ---------- runtime state ---------- */
  // We clone the decision types so the demo can mutate them (toggle, resolve)
  // without editing the seed data.
  const state = {
    view: "today",
    types: {},          // decisionId -> "decision" | "informative"
    resolved: {},       // decisionId -> outcome label
    timeAvailable: null, // "zero" | "little" | "lots" — asked once per open, never persisted
    memory: PL.memory.map((g) => ({ day: g.day, items: g.items.slice() })),
    valueFocus: loadValueFocus(), // profile → Value Focus (A2): selected taxonomy keys, persisted (see below)

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
        .sort(rankByFocusThenScore(this.valueFocus));
    },
    informative() {
      return this.all()
        .filter((d) => d.type === "informative" && !this.resolved[d.id])
        .sort(rankByFocusThenScore(this.valueFocus));
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
    const navKey = v === "showcase" || v === "pilot" ? "today" : v.indexOf("brief:") === 0 ? "decisions" : v;
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

    // Value Focus card (profile view) — toggle selection, persist, re-render
    const vfCard = t.closest("[data-vf]");
    if (vfCard) { toggleValueFocus(vfCard.dataset.vf); return; }

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

  // Profile entry point (A2 depends on a way in — profile-shell's own entry point isn't
  // merged yet, so this feature wires the minimal one described in docs/roadmap.html
  // #appendix-profile: ".user-card"/".user-ava" become a real link into the profile push
  // view). Scoped to one clickable target per breakpoint so desktop's sidebar card and
  // its nested avatar don't both become focusable (no nested tab stops).
  document.querySelectorAll(".topbar .user-ava, .sidebar .user-card").forEach((el) => {
    el.setAttribute("data-view", "profile");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "Open your profile");
    el.classList.add("clickable");
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-view].clickable")) {
      e.preventDefault();
      go(e.target.getAttribute("data-view"));
    }
  });

  const initial = location.hash.replace("#", "");
  const valid = ["today", "decisions", "agents", "evidence", "memory", "showcase", "pilot", "profile"];
  state.view = valid.includes(initial) || initial.indexOf("brief:") === 0 ? initial : "today";
  render();
  openTimeGate();
})();
