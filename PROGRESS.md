# ProofLoop — Eval-Driven Build Roadmap (IN PROGRESS)

**Context:** `eval/report/eval-report.html` (real Phase A+B data, not draft) surfaced a ranked
set of defects. Full plan (approved, still the source of truth for what's left):
`~/.claude/plans/help-me-create-a-iterative-book.md`. Two steering decisions baked into that
plan: (1) add a real derivation layer for escalation/RACI instead of just fixing literals, (2)
optimize sequencing for demo credibility.

**Note on paths:** this project's folder has been renamed/moved twice mid-session by something
outside this session (`.../AI Product Manager Bootcamp/Capstone` → `.../AI Product Bootcamp
Capstone`, under `/Users/aaasen/PROJECTS/WORK/`). Nothing was lost — git history and working-tree
edits survived both moves — but if a path in this doc or the plan file 404s, `find /Users/aaasen
-maxdepth 4 -iname "Capstone*"` first before assuming anything's missing.

## Status

- **Wave 0 (stop the bleeding) — DONE.**
  - Fixed the 87-vs-98 confidence conflict: `data.js`'s hardcoded `rollout.confidence: 87`
    literal removed; `render.js`'s `showcase()` now calls `confidenceScore(d-billing-golive)`
    directly (renders 98 everywhere).
  - Chief-of-Staff briefing's "routed N to you, M advancing" line is now computed live in
    `render.js`'s `agents(state)` from `state.blocking()/informative()` (was a hardcoded "3/4" in
    `data.js`; real split is 7/3). `app.js`'s render() now passes `state` into `R.agents(state)`.
  - Updated `eval/run.js`'s two linter checks (`confidence-conflict`,
    `chief-of-staff-narrative-drift`) to detect the fix instead of assuming the old bug.

- **Wave 1 (derivation layer) — mostly done, unverified in a real browser.**
  - Added `classifyEscalation(d)` and `routeOwner(d)` to `render.js`. Classifier derives
    decision-vs-informative from `signals.commitmentAtStake`, `isRollout`, `gate`, `severity`
    (score/confidence are surfaced in the reason text, not used as gating thresholds — no
    calibrated cutoff exists to set one against). Matches all 10 seed decisions' authored type
    exactly (verified via Node smoke test). `routeOwner` derives the accountable owner: anything
    the classifier flags as a decision routes to `PL.user.id` (the exec); informative items keep
    their authored owner. This fixes `d-order-history-access`'s wrong `sam-tan` owner (now derives
    to `maya-okonkwo`, matching the eval's independent-panel ground truth) **without editing the
    seed data**.
  - Wired `app.js`'s `state.decisionFor()`/`state.all()` to read `classifyEscalation(d).type`
    instead of the raw `d.type` literal (manual toggle override in `state.types` still wins).
  - Added the commitment guardrail: the `[data-set]` toggle handler in `app.js` now refuses to
    demote a decision to informative when `signals.commitmentAtStake === true`, with a toast
    explaining why. This is exactly what the eval's `adv-commitment-mislabeled-informative`
    scenario is built to catch.
  - Wired `render.js`'s `raci(d)` to show the derived owner (with a "routed here because"
    tooltip) instead of reading `d.raci.a` directly. Added an escalation-reason line ("Needs you
    because: ..." / "Advancing on its own because: ...") to the top of `breakdown()`'s modal.
  - Updated `eval/run.js`'s `escalation-gate-is-authored` check to detect the new classifier
    (was checking for a code pattern that no longer matches how the fix was actually built) and
    confirm its output matches all 10 anchors.
  - Re-ran the full eval pipeline (`run.js` → `aggregate-panel.js` → `apply-phase-b.js` →
    `render-report.js`). Tier 1 integrity linter confirmed findings: **11 → 7** (confidence-conflict,
    chief-of-staff-narrative-drift, escalation-gate-is-authored, missing-commitment-guardrail all
    now show `confirmed: false` / "fixed"). Report regenerated at
    `eval/report/eval-report.html`.
  - **Not done yet:**
    - `routeOwner`'s fix is not reflected in the Tier 3 `raciRoutingMismatches` deterministic
      check — that check compares the raw authored `d.raci.a` against ground truth (by design,
      it's measuring the seed data as shipped). Consider whether to add a second check that
      verifies `routeOwner()`'s *derived* output against the same ground truth, to show the
      derivation layer's fix working, alongside the existing "as authored" check.
    - **Never verified in an actual browser.** Tried via the browser MCP tool
      (`browser_navigate` to `http://localhost:4173`) but it can't reach `localhost` from this
      sandbox. Only verified via Node smoke tests (`node -e "..."` loading `data.js`+`render.js`
      directly) — confirmed `classifyEscalation`/`routeOwner`/`breakdown()`/`raci()` all produce
      correct output for every seed decision, and `node --check` passed on all three edited files.
      **Next session should serve `prototype-2/` locally
      (`python3 -m http.server 4173 --directory prototype-2`) and manually click through it** on
      a real machine/browser: open Decisions, confirm the RACI "A" badge shows "You" with a
      tooltip on `d-order-history-access`; try toggling `d-escalation` (commitment-breaking) to
      Informative and confirm the guardrail toast blocks it; open its breakdown modal and confirm
      the new "Needs you because:" line renders correctly (no broken HTML/CSS — `.bd-escalation`
      has no explicit stylesheet rule yet, so check it doesn't look broken against
      `styles.css`'s existing `.bd-*` rules).

- **Wave 2 (honesty under inspection) — not started.** Value-Model-override UI disclosure,
  recommendation-grounding content pass on the ~9 flagged scenarios, watch-floor coverage
  closure. See plan file for specifics.
- **Wave 3 (hygiene) — not started.** Only do if time remains; none are demo-blocking.

## Next steps (in order)

1. Manually verify Wave 1 in a real browser (see "Not done yet" above) — this is the one thing
   standing between "looks right in Node" and "actually demo-ready."
2. Decide whether to add the Tier 3 derived-RACI check mentioned above (optional, but it's the
   most direct way to *prove* the RACI fix in the eval report itself rather than just asserting
   it in this doc).
3. Wave 2, then Wave 3 if time remains, per the plan file. Re-run
   `node eval/run.js && node eval/aggregate-panel.js && node eval/apply-phase-b.js && node
   eval/render-report.js` after each wave (all four steps, in that order — `run.js` alone
   regenerates Phase-A illustrative placeholders and wipes the real Phase B numbers back out).

---

# ProofLoop — 10-feature build

**Status: DONE.** All 10 features are merged into `main`. `docs/roadmap.html`'s 10
feature cards are marked "Built."

## What shipped (in merge order)

| # | Feature | Commit(s) |
|---|---|---|
| 1 | `foundation-features-model` | `0fc9594` |
| 2 | `presenter-entry-point` | `90abf33` |
| 3 | `decisions-copy-revamp` | `7a22cef` |
| 4 | `profile-shell` | `1b4c8a1` |
| 5 | `integrations-jira-spike` | `2620f74` |
| 6 | `decisions-new` | `12bcdf5` |
| 7 | `profile-value-focus` | `fc2acea` (+ fix `d7a46ae`) |
| 8 | `profile-recent-decisions-log` | `6603897` (+ fix `77db995`) |
| 9 | `presenter-cockpit` | `d884fad` |
| 10 | `buildview-placeholder` | `d884fad` |

Roadmap statuses updated to "Built" for all 10 cards in the same pass (added a
`.status-dot.is-built` legend entry alongside the existing "In design"/"Planned" ones).

## How this actually got built (worth remembering)

This started as a fully-orchestrated `Workflow()` run (10 builder agents + 4 reviewer
roles + per-wave integrators), per the originally-requested process in
`docs/orchestration/proofloop-10-feature-build.workflow.js`. It stalled twice:

1. First run: the Wave A integrator agent stalled mid-merge-conflict on `render.js`'s
   `window.PLRender` export line after ~160 min. Fixed by hand, resumed for the rest.
2. Second run: 37/54 agent calls done, 17 errors, ~9.5 hours elapsed, still not through
   Wave B. At that point the user said, verbatim: *"how's it going? we need to get this
   done- strip down the process however needed to avoid timeouts and errors. this is
   pathetic."*

From there, everything was finished by hand — direct `Edit`/`Read`/`Bash` in this
session, no more `Workflow()` calls:
- Manually merged the 2 already-built Wave B branches (`profile-value-focus`,
  `profile-recent-decisions-log`) into `main`, resolving the conflicts a git line-based
  merge doesn't catch on its own (see "Recurring bug class" below).
- Cleaned up all the stale worktrees/branches from both aborted Workflow runs.
- Built the last 2 features (`presenter-cockpit`, `buildview-placeholder`) directly
  against `main` — no worktree, no reviewer agents. Verified with `node --check` on
  every edited JS file, a small headless Node smoke test that runs `render.js`'s new
  functions against every real decision in `data.js` (catches runtime exceptions no
  static check would), and Chrome-headless DOM dumps of both new routes plus a
  regression check on Today/Decisions/Profile.

**Lesson for next time:** the multi-agent build is the right call for genuinely
independent, reviewable chunks of work, but it does not degrade gracefully — when an
integrator or builder agent stalls, it stalls hard (multi-hour timeouts) rather than
failing fast. Two features left at that point were faster to just write by hand than
to debug or re-run the orchestration a third time.

## Recurring bug class: silent duplicate insertions

Several merges hit the same failure mode, and it's worth naming since it'll recur if
this pattern (many branches independently extending the same shared scaffold) comes up
again: two branches that both add real content to the same shared seam (a function body,
a CSS block) *before* that seam existed on `main` yet will each write their own
non-overlapping copy. Git's line-based merge sees no overlapping lines, so it doesn't
flag a conflict — it just silently keeps both copies. Caught and fixed by hand three
times (`render.js`'s `profileValueFocusSeam`/`profileRecentDecisionsSeam`, `styles.css`'s
`.profile-view`/`.profile-head` block, `app.js`'s `render()` routing chain gaining a dead
duplicate `else if (v === "profile")` branch). Verified clean afterward each time via
`rg` for duplicate function/selector names and `sort | uniq -d` on the CSS.

## Where things live

- Roadmap + design appendix: `docs/roadmap.html` (now shows "Built" on all 10 cards).
- Presenter cockpit reference mockup: `docs/presenter-cockpit-mockup.html`.
- The original full orchestration script (spec + acceptance criteria for all 10
  features, kept as historical record): `docs/orchestration/proofloop-10-feature-build.workflow.js`.
- The app itself: `prototype-2/` (`data.js` → `render.js` → `app.js`, vanilla, no build
  step, works over `file://`).

## Not done / intentionally out of scope

- No cross-feature QA pass or UX/Architecture consistency pass was run by dedicated
  reviewer agents (that part of the original process was dropped along with the rest of
  the Workflow orchestration). The manual verification described above (syntax checks,
  smoke test, headless browser DOM checks, nav/regression spot-checks) stood in for it.
- The Jira integrations beyond the spike (`Jira read-only sync`, `Jira two-way sync`,
  `Live status (Jira-fed)`) are correctly still "Planned" on the roadmap — never part of
  this 10-feature list.
