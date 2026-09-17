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
