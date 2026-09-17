export const meta = {
  name: 'proofloop-10-feature-build',
  description: 'Build all 10 in-design ProofLoop roadmap features with per-feature review gates (Architecture/QA/UX/Security), 3 dependency waves, worktree isolation, lead-owned integration.',
  phases: [
    { title: 'Conventions' },
    { title: 'Wave A Build' }, { title: 'Wave A Review' }, { title: 'Wave A Integrate' },
    { title: 'Wave B Build' }, { title: 'Wave B Review' }, { title: 'Wave B Integrate' },
    { title: 'Wave C Build' }, { title: 'Wave C Review' }, { title: 'Wave C Integrate' },
    { title: 'Cross-feature QA' }, { title: 'Consistency Check' },
  ],
}

const ROOT = '/Users/aaasen/WORK/AI Product Manager Bootcamp/Capstone'

const DRAFT_CONVENTIONS = `
PROJECT: ProofLoop Prototype 2 (${ROOT}/prototype-2). Vanilla HTML/CSS/JS, NO framework, NO build
step, NO ES modules. Scripts load as plain globals in strict order: data.js -> render.js -> app.js
(index.html script tags). Must keep working when opened directly over file://. No network calls.

FILE ROLES
- prototype-2/data.js -- 'window.PL = {...}' at line ~6. Seed content only: workspace, user, today,
  weights/weightMeta, confidenceWeights/confidenceWeightMeta, timeModes, people, agents[8],
  decisions[], rollout, evidenceMap, memory[]. Top-level keys are siblings inside one object literal.
- prototype-2/render.js -- pure 'data -> HTML string' functions. Exported via a single object literal
  'window.PLRender = { icon, score, today, decisions, agents, evidence, memory, brief, showcase,
  pilot, breakdown, whyLine, timePicker, confidenceScore, confidenceBreakdown };' at the end of the
  file (grep for 'window.PLRender ='). New view functions must be added to this SAME object literal.
- prototype-2/app.js -- state + delegated event handling + view routing + modals/toast. Has a
  whitelist: 'const valid = ["today", "decisions", "agents", "evidence", "memory", "showcase",
  "pilot"];' (grep for 'const valid ='). New routable views append a new string here. Also handles
  'data-view' (nav/push-view links) and 'data-decide' (approve/revise/reject on decisions) via
  delegated document click listeners -- REUSE these, do not invent a parallel action system.
- prototype-2/styles.css -- mobile-first, CSS variables at ':root' (--navy, --navy-2, --ink, --muted,
  --line, --bg, --white, --blue, --coral, --mint, --amber, --shadow, --radius, --mono, and *-soft
  tints). Reuse tokens, do not hardcode new hex colors.
- docs/roadmap.html and docs/presenter-cockpit-mockup.html -- already-approved, committed design
  reference artifacts. Read them for exact visual/content targets where cited.

ACCESSIBILITY GAPS (pre-existing, real -- do not silently extend them; flag if a feature would need
to touch this area):
- No shared ':focus-visible' convention exists yet. New interactive elements must not do
  'outline: none' without a visible focus replacement.
- Nav active-state has no 'aria-current="page"'. This is a known gap, not a new one to avoid.
- Icon-only controls need an 'aria-label'.
- Status colors follow an implicit semantic mapping: mint=confirmed, coral=risk, amber=attention,
  blue=neutral/informational. New status enums should reuse this mapping, not invent a 5th color.

HONEST-ARITHMETIC INVARIANT (never violate): Impact Score = round(0.35*value + 0.30*unblock +
0.20*reach + 0.15*urgency), computed live from each decision's 'impact' sub-scores via render.js's
existing score()/contributions()/provenance() functions. NEVER hand-author a displayed score or
percentage that isn't a direct, reproducible function of underlying data fields. Sub-scores live
within an observable-signal-derived band (see valueBand/unblockBand/reachBand/urgencyBand in
render.js) -- treat the band as the grounded claim, do not invent new banding logic.

RACI HONESTY: raci.a renders as "You" only if it equals PL.user.id ('maya-okonkwo'); otherwise the
real person's short name. Approve/Revise/Reject buttons show for every blocking 'decision'-type item
regardless of who raci.a is -- do not add new gating logic to the decide pipeline.

TWO SEPARATE AGENT NAMESPACES -- do not conflate:
  1. Watch-floor ProofLoop agents (decision.agentId): chief-of-staff, impact-analyst, eval-runner,
     evidence-steward, requirements-analyst, risk-sentinel, rollout-manager, dependency-tracker.
  2. Delivery-crew agents / build items (feature.agentId): e.g. 'billing-resolver' (already used at
     PL.rollout.agentId), plus newly minted ids for other build items. A decision's agentId always
     points at namespace (1); a feature's agentId always points at namespace (2).

RUNTIME VS SEED DATA: app.js never writes back into data.js. Runtime changes (decide/toggle actions)
go through override maps -- state.types and state.resolved -- keyed by decision id, merged onto
PL.decisions at read time via Object.assign inside state.all()/decisionFor() (see app.js:22-25,
125, 223). state.memory is shallow-cloned separately. There is no deep-cloned mutable PL tree.
Features that need new runtime-mutable behavior (e.g. a localStorage-backed feature) should extend
this override-map pattern, not assume a full clone exists. Features whose job IS to add or edit seed
content (copy revamp, new decisions, features[] model) edit data.js's static literal directly --
that is expected and correct for those features.

COMMIT HYGIENE: each builder commits its own worktree/branch (git add + git commit, no push, no
merge to main). Additive changes only to shared literals (the 'valid' array, the 'window.PLRender'
export object, the top-level 'window.PL' object) -- append new entries/keys, never remove or reorder
existing ones. Do not touch files outside your feature's stated scope.
`.trim()

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    worktreePath: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    verification: { type: 'string' },
    previewInstructions: { type: 'string' },
    limitations: { type: 'string' },
    acceptanceCriteriaSelfCheck: {
      type: 'array',
      items: { type: 'object', properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, note: { type: 'string' } }, required: ['criterion', 'met'] },
    },
  },
  required: ['branch', 'worktreePath', 'filesChanged', 'summary', 'verification'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['Pass', 'Changes required', 'Blocked'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          summary: { type: 'string' },
          evidence: { type: 'string' },
          requiredFix: { type: 'boolean' },
        },
        required: ['severity', 'summary', 'evidence', 'requiredFix'],
      },
    },
    evidenceNotes: { type: 'string' },
  },
  required: ['verdict', 'findings', 'evidenceNotes'],
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  properties: {
    mergedBranches: { type: 'array', items: { type: 'string' } },
    conflicts: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, resolution: { type: 'string' } }, required: ['file', 'resolution'] } },
    finalCommit: { type: 'string' },
    mergeLog: { type: 'string' },
    anyFailures: { type: 'boolean' },
    details: { type: 'string' },
  },
  required: ['mergedBranches', 'finalCommit', 'anyFailures', 'details'],
}

const CONVENTIONS_SCHEMA = { type: 'object', properties: { notes: { type: 'string' } }, required: ['notes'] }

const ROLE_META = {
  architecture: { label: 'Technical Architect', focus: 'system boundaries, API/data-model contracts, state management, dependency choices, performance, failure handling, maintainability; challenge unnecessary complexity, duplicated logic, and implementation choices incompatible with other features or the existing architecture.' },
  qa: { label: 'QA & Integration Engineer', focus: 'independently verify acceptance criteria, critical user journeys, edge cases, and regressions; check interactions with other features; match testing depth to the scope and risk of the change.' },
  ux: { label: 'UX/UI & Accessibility Lead', focus: 'user journeys, visual hierarchy, component consistency, responsive layouts, copy clarity, loading/empty/success/error states, keyboard navigation, focus management, contrast, and accessible labels against WCAG 2.2 AA. You MUST inspect the running interface and exercise the key interaction described below -- screenshots alone, or code-reading alone, are not sufficient.' },
  security: { label: 'Security & Reliability Engineer', focus: 'authentication, authorization, input validation, secrets handling, sensitive data, dependencies, external integrations, timeouts, retries, and recovery where applicable. Report concrete findings with severity, evidence, and reproduction steps.' },
}

const FEATURES = [
  {
    id: 'foundation-features-model', title: 'Features data model', wave: 'A',
    files: ['prototype-2/data.js', 'worker/index.js'],
    spec: `Add a new top-level 'features' array to window.PL in prototype-2/data.js (grep 'window.PL = {'
and add 'features:' as a new sibling key alongside 'decisions', 'rollout', etc. -- do not touch any
existing key). Shape per item: { id, name, agentId, status, summary, progress, decisionIds: [],
jiraKey: null, blockers: [] }. status is one of 'backlog' | 'in-progress' | 'build-complete' |
'piloting' | 'live'. agentId values are DELIVERY-CREW ids (a new namespace distinct from the 8
watch-floor agents) -- reuse 'billing-resolver' (already present at PL.rollout.agentId, grep it to
confirm), and mint three new ids: 'escalation-service', 'intent-router', 'refund-knowledge'.
Create exactly these 4 feature entries:
  1. id 'feat-billing-resolver', name 'Billing Resolution Agent', agentId 'billing-resolver',
     status 'build-complete', summary 'Waiting on pilot go/no-go', progress 90,
     decisionIds: the id of the billing-pilot-go/no-go decision, plus the two NEW decisions about
     order-history read access and refund auto-approval (these two new decisions do not exist yet in
     this wave -- use the ids 'd-order-history-access' and 'd-refund-autonomy' literally; they will
     be added by a later feature and these ids are already fixed/reserved).
  2. id 'feat-escalation-service', name 'Service Agent -- Escalation', agentId 'escalation-service',
     status 'in-progress', summary 'Needs decision inputs to raise value and clear partial blockers',
     progress 55, decisionIds: the id of the escalation-response-v2.4 decision, the id of the
     repeat-escalation-threshold decision, plus the reserved literal id 'd-password-reset'.
  3. id 'feat-intent-router', name 'Intent Router', agentId 'intent-router', status 'live',
     summary 'Classifier update passed every check', progress 100,
     decisionIds: the id of the intent-routing-patch-v1.3 decision (grep prototype-2/data.js's
     decisions array for the one about intent routing / classifier to find its real id).
  4. id 'feat-refund-knowledge', name 'Knowledge / Refunds', agentId 'refund-knowledge',
     status 'in-progress', summary 'Fresh refund examples added, source-linked', progress 70,
     decisionIds: the id of the billing-refund-knowledge-update decision (grep for it).
For decisionIds you must locate real ids already present in prototype-2/data.js's decisions array by
reading the file -- do not guess ids for decisions that already exist; only 'd-order-history-access',
'd-refund-autonomy', and 'd-password-reset' are literal reserved ids for decisions that do not exist
yet (another feature adds them later; referencing their id now is correct and intentional).
Also open worker/index.js (small file, has a 501 stub for /api/*) and add ONLY a one-line comment
near the API stub noting that '/api/jira' is the future landing spot for the read-only Jira sync --
no functional code change to the worker.`,
    acceptanceCriteria: [
      "PL.features is a new array; no existing PL key was removed, renamed, or reordered.",
      'Each feature object has all required fields; status values are from the allowed enum.',
      'agentId values are the 4 delivery-crew ids listed, never a watch-floor agent id.',
      'decisionIds reference either real existing decision ids (verified by reading data.js) or the 3 literal reserved ids.',
      'worker/index.js has at most a one-line comment added; no functional/behavioral change.',
    ],
    reviewers: ['architecture', 'qa', 'security'],
    naReasons: { ux: 'Pure data-model addition with no rendered UI surface of its own.' },
  },
  {
    id: 'presenter-entry-point', title: 'Presenter Mode time-picker entry point', wave: 'A',
    files: ['prototype-2/app.js', 'prototype-2/render.js', 'prototype-2/styles.css'],
    spec: `On the existing open-the-app time picker (zero / some / lots of time choices -- find it via
the 'timePicker' function exported from render.js), add a 4th, visually GREY/secondary affordance
labelled "Presenter Mode". Grey signals this is a different mode switch, not a 4th time choice --
give it a distinct muted style (do not reuse the mint/blue/amber time-choice colors; use --muted /
a neutral grey background). Add 'presenter' to app.js's 'valid' whitelist array (grep 'const valid =').
Wire the click so selecting "Presenter Mode" routes to a NEW render.js view function named
'presenter' (add it as a new key to the 'window.PLRender' export object literal -- do not remove
existing keys). For THIS feature, 'presenter(state)' only needs to be a minimal, honest placeholder:
render a simple page with a heading "Presenter Mode" and one sentence noting the full cockpit is
coming -- a later feature (presenter-cockpit) will replace this function's body with the real
cockpit. Do not attempt to build the cockpit yourself. Add a back-to-Today affordance.`,
    acceptanceCriteria: [
      "Time picker shows a 4th, visually distinct grey 'Presenter Mode' option alongside the 3 existing time choices, not styled as a peer/4th time choice.",
      "'presenter' is in app.js's valid[] whitelist; selecting it navigates there and back.",
      'window.PLRender exports a working presenter(state) function (placeholder content is acceptable and expected for this feature).',
      'No existing time-picker behavior (zero/some/lots) regressed.',
    ],
    reviewers: ['architecture', 'qa', 'ux'],
    naReasons: { security: 'Adds a client-side route and button only; no new data exposure, permission, or external-call surface.' },
    uxScript: 'Open prototype-2/index.html, trigger the time picker, confirm the grey Presenter Mode option is visually distinct (not a 4th equal time choice), click it, confirm you land on a presenter placeholder view with a working back action, and confirm keyboard focus lands sensibly and the option has an accessible label/role.',
  },
  {
    id: 'decisions-copy-revamp', title: 'Decisions copy revamp', wave: 'A',
    files: ['prototype-2/data.js'],
    spec: `Edit ONLY the 'title', 'one_liner', and (if present) 'recommendation.headline' text fields
on 6 EXISTING decision objects in prototype-2/data.js's decisions array. Do not touch impact,
signals, raci, confidenceInputs, evidence, type, agentId, or any other field. Locate each decision by
matching its current subject matter (read the file to find the real object), then apply this exact
new copy:
  1. Decision about escalation response v2.4 / friendlier retry wording -> title "Friendlier
     escalation replies (v2.4)"; one_liner "Warmer wording is clearer in 23 of 24 cases -- but one
     path risks breaking our 30-second handoff promise."
  2. Decision about the Billing Resolution Agent pilot go/no-go -> title "Billing Agent -- launch the
     pilot?"; one_liner "Six weeks of shadow data beat the human baseline. Approve a limited 5% pilot,
     or hold."
  3. Decision about the repeat-escalation / retry threshold -> title "How many retries before a human
     takes over?"; one_liner "There's no agreed limit yet -- and 3 build tasks are blocked until we
     set one."
  4. Decision about the intent-routing / classifier patch v1.3 -> title "Intent-routing tune-up
     (v1.3)"; one_liner "Classifier update passed every check and stayed within policy -- advancing
     on its own."
  5. Decision about the billing refund knowledge update -> title "New refund examples added";
     one_liner "Fresh refund cases, every one source-linked -- advancing on its own."
  6. Decision about tone & style refinement -> title "Warmer tone, same rules"; one_liner "Phrasing
     softened; no change to policy or claims -- advancing on its own."
If a decision's 'recommendation' has a short headline-like leading field, you may lightly tighten its
wording to match the new title's plain-language register, but do not change its underlying
recommendation/action. When done, print (in your summary) the real decision id you matched to each of
the 6 rows above so downstream features can reference them correctly.`,
    acceptanceCriteria: [
      'Exactly 6 existing decision objects have updated title/one_liner text matching the copy above verbatim.',
      'No other field on any decision object changed.',
      'No decision objects added or removed.',
      'The 6 matched decision ids are reported in the summary.',
    ],
    reviewers: ['architecture', 'qa', 'ux'],
    naReasons: { security: 'Text-only content edits to existing decisions; no structural, permission, or data-exposure change.' },
    uxScript: 'Open prototype-2/index.html, browse to Today and Decisions, and read the 6 updated titles/one-liners for clarity, tone consistency with the rest of the app, and that stakes are named plainly; confirm no layout regressions from longer/shorter copy.',
  },
  {
    id: 'profile-shell', title: 'Clickable profile shell (A1)', wave: 'A',
    files: ['prototype-2/app.js', 'prototype-2/render.js', 'prototype-2/styles.css'],
    spec: `Make the existing '.user-card' / '.user-ava' element (find it in index.html/app.js, near
where 'setAll(".user-ava", PL.user.initials)' runs) clickable, navigating via 'data-view="profile"'.
Add 'profile' to app.js's 'valid' whitelist array. Add a new 'profile(state)' function to render.js,
added as a new key on the 'window.PLRender' export object literal. It is a push view with a back
button to Today (reuse the existing push-view/back-button idiom already used elsewhere in the app --
grep for how other push views like brief/showcase/pilot implement their back navigation). Content for
THIS feature only:
  - Avatar, name (PL.user.name -- Maya Okonkwo), title/role (PL.user.role), workspace
    (PL.workspace.name), and one line of scope-of-authority copy: "Accountable for customer-service
    behavior & rollout gates; consulted on revenue and compliance."
  - Reuse the existing '.choice' row idiom for any list-like content -- no new component system.
IMPORTANT -- you are building a SHARED SHELL two other features will extend. Leave two clearly marked
extension seams: add two stub functions/sections, e.g. a placeholder call/comment marking where
"Value Focus" content will render and where "Recent decisions log" content will render, so those
later features can add their own rendering without needing to touch your header code. Make these
seams obvious (e.g. an HTML comment '<!-- VALUE_FOCUS_SEAM -->' and '<!-- RECENT_DECISIONS_SEAM -->'
or equivalent named stub functions) and describe exactly how to use them in your summary.`,
    acceptanceCriteria: [
      'Clicking the user avatar/card navigates to a profile view with a working back-to-Today action.',
      "'profile' is in app.js's valid[] whitelist.",
      'Profile view shows avatar, name, role, workspace, and the scope-of-authority line verbatim.',
      'Two clearly documented extension seams exist for Value Focus and Recent-decisions log content, described in the build summary.',
    ],
    reviewers: ['architecture', 'qa', 'ux'],
    naReasons: { security: 'Static identity header over already-visible in-app user data; no new access path.' },
    uxScript: 'Open prototype-2/index.html, click the user avatar/card, confirm a profile view opens with correct identity info and scope-of-authority copy, confirm the back button returns to Today, and check keyboard reachability/focus of the avatar trigger and back button.',
  },
  {
    id: 'integrations-jira-spike', title: 'Jira integration spike (findings memo)', wave: 'A',
    files: ['docs/jira-integration-spike-findings.md', 'worker/index.js'],
    spec: `This feature's deliverable is a WRITTEN FINDINGS MEMO, not application code (this was
already decided: "written findings memo now"). Create docs/jira-integration-spike-findings.md
covering, under the hard constraint stated in docs/roadmap.html's Integrations appendix ("no
extensive configuration in either tool, no ongoing maintenance burden"):
  1. Auth model recommendation: API token vs OAuth -- recommend a single Jira API token (simplest,
     lowest maintenance), with the concrete tradeoff vs OAuth noted.
  2. Whether JQL-by-label is sufficient to find relevant issues -- recommend a single label (e.g.
     'proofloop') applied to relevant Jira issues, with an example JQL query.
  3. The shape of a status-map config: Jira status -> ProofLoop feature status, e.g.
     Done -> build-complete, In Progress -> in-progress, To Do -> backlog, plus how 'piloting' and
     'live' map (propose a reasonable convention, e.g. a second label or a specific status name).
  4. A staged recommendation matching the roadmap's own staging: (1) this spike, (2) read-only
     label-driven sync as the very next step, (3) an optional push-based Jira Automation webhook to
     /api/jira, (4) two-way sync explicitly NOT recommended now (parked, high maintenance risk).
  5. Read docs/roadmap.html's Integrations appendix (id 'appendix-integrations') first and make sure
     your recommendations are consistent with it, not a reinvention.
Also add ONE short comment in worker/index.js near its /api/* 501 stub pointing at this memo as the
landing spot's design reference -- no functional code change.`,
    acceptanceCriteria: [
      'docs/jira-integration-spike-findings.md exists and directly answers all 3 confirm-before-build questions from the roadmap appendix (auth model, JQL-by-label sufficiency, status-map shape).',
      'Recommendations are consistent with the "no extensive configuration, no ongoing maintenance" constraint and with the staged plan already described in docs/roadmap.html.',
      'worker/index.js has at most a one-line comment added; no functional change.',
    ],
    reviewers: ['architecture', 'security'],
    naReasons: {
      qa: 'Deliverable is a written findings memo, not executable code or a user journey -- there is no acceptance-test surface to run.',
      ux: 'No UI surface in this deliverable.',
    },
  },
  {
    id: 'decisions-new', title: 'New decisions (4 additions)', wave: 'B', dependsOn: ['decisions-copy-revamp'],
    files: ['prototype-2/data.js'],
    spec: `Append exactly 4 NEW decision objects to prototype-2/data.js's decisions array (append at
the end -- do not touch the 6 existing decisions revised by the copy-revamp feature that landed in
Wave A; read the current file state first). Match the existing decision object shape exactly (id,
title, agentId, type, one_liner, impact{value,unblock,reach,urgency}, signals, raci, and any other
fields present on existing decisions such as recommendation/confidenceInputs/evidence -- mirror the
existing shape closely, do not invent a divergent schema). Use these ids literally (other features
already reference them): 'd-password-reset', 'd-order-history-access', 'd-refund-autonomy',
'd-model-upgrade'. type is "decision" for all four (blocking, needs Approve/Revise/Reject). Content:

1. id 'd-password-reset', title "Let Atlas handle password resets?", one_liner "Adding a new
   self-service action the agent can take end-to-end.", impact { value:52, unblock:40, reach:60,
   urgency:58 } (this computes to Impact Score 51 via the existing 0.35/0.30/0.20/0.15 weights --
   verify your math). agentId should point at the watch-floor 'risk-sentinel' agent. raci.a should be
   PL.user.id ('maya-okonkwo'). Recommendation: approve with mandatory identity verification before
   any reset.

2. id 'd-order-history-access', title "Give Atlas read access to order history?", one_liner "Broader
   data access improves answers but widens the exposure surface.", impact { value:46, unblock:35,
   reach:84, urgency:62 } (Impact Score 53). agentId should point at the watch-floor
   'evidence-steward' agent. raci.a should be the real person id matching short name "Sam Tan" in
   PL.people (look up the correct id -- do not invent one); include a consulted party matching short
   name related to Risk/Compliance if the schema supports a consulted list. Recommendation: approve,
   scoped to read-only order status/history only.

3. id 'd-refund-autonomy', title "Auto-approve refunds under $50?", one_liner "Where the
   human-in-the-loop line sits -- speed for customers vs. spend control for the business.", impact {
   value:68, unblock:60, reach:58, urgency:58 } (Impact Score 62). agentId should point at the
   watch-floor 'rollout-manager' agent (consistent with the existing billing-pilot decision). raci.a
   is 'maya-okonkwo'; include a consulted party matching short name "Diego A." in PL.people (look up
   the real id). Recommendation: approve auto-approval up to $50 with a running weekly cap and full
   audit log.

4. id 'd-model-upgrade', title "Move Atlas to the newer model?", one_liner "Better reasoning across
   every conversation -- but every eval needs re-baselining first.", impact { value:48, unblock:18,
   reach:68, urgency:34 } (Impact Score 41). agentId should point at the watch-floor 'eval-runner'
   agent. raci.a is 'maya-okonkwo'; include a consulted party matching short name "Sam T." in
   PL.people. Recommendation: approve a staged upgrade gated on a full eval re-baseline.

Look up every referenced PL.people id by reading the file -- never invent a person id. Recompute and
double check each Impact Score from the given impact sub-scores and the 0.35/0.30/0.20/0.15 weights
before finalizing; report the 4 computed scores in your summary.`,
    acceptanceCriteria: [
      'Exactly 4 new decision objects appended, using the 4 literal ids specified, matching the existing decision schema shape.',
      'No existing decision object (including the 6 revised in copy-revamp) was modified or reordered.',
      'All impact sub-scores exactly as specified; computed Impact Scores verified as 51, 53, 62, 41 respectively and reported in the summary.',
      'Every raci/consulted person id is a real id looked up from PL.people, not invented.',
      'agentId values point at real watch-floor agent ids, never a delivery-crew id.',
    ],
    reviewers: ['architecture', 'qa', 'ux', 'security'],
  },
  {
    id: 'profile-value-focus', title: 'Value Focus section (A2)', wave: 'B', dependsOn: ['profile-shell'],
    files: ['prototype-2/render.js', 'prototype-2/app.js', 'prototype-2/data.js', 'prototype-2/styles.css'],
    spec: `Build into the VALUE_FOCUS_SEAM left by the profile-shell feature inside render.js's
'profile(state)' view (read that function first to find the seam and follow its stated usage). Add a
new top-level 'valueFocusTaxonomy' array to window.PL in data.js with these 9 entries (fields:
key, label, framing, primaryKpi, supportingKpis[]):
  1. grow-revenue / "Grow revenue" / "Every interaction is a chance to expand the relationship." /
     "Cross-sell / up-sell attach rate" / ["Wallet share","Market share","Revenue per interaction / AOV","Assisted-conversion","Net Revenue Retention"]
  2. cut-cost-to-serve / "Cut cost to serve" / "Resolve more without adding headcount." /
     "Deflection / self-service containment rate" / ["Cost per contact","Average Handle Time (AHT)","First-Contact Resolution","Escalation/transfer rate"]
  3. operational-efficiency / "Operational efficiency" / "Less swivel-chair, faster complex work." /
     "Time-to-resolution for complex task X" / ["# systems touched per task","Straight-through / automation rate","Throughput per FTE","Rework rate"]
  4. personalization-experience / "Personalization & experience" / "The right next action, tailored." /
     "Recommendation adoption / acceptance rate" / ["Relevance rating","Task-success / goal-completion","CSAT/NPS lift","Repeat/retention"]
  5. data-quality-trust / "Data quality & trust" / "Grounded answers you can defend." /
     "Data completeness (% required fields)" / ["Data accuracy vs. ground truth","Freshness/latency","Source coverage %","Groundedness/citation rate"]
  6. trust-safety-compliance / "Trust, safety & compliance" / "Answers we can stand behind and audit." /
     "Policy-adherence rate" / ["Groundedness / hallucination rate","Safe-escalation rate","PII/exposure incidents","Audit-readiness"]
  7. human-agent-experience / "Human-agent experience" / "AI that lifts our people, not replaces them." /
     "Rep ramp time" / ["After-call-work reduction","Agent CSAT","Attrition/burnout","Concurrency per rep"]
  8. ai-adoption-autonomy / "AI adoption & autonomy" / "How far the AI program has actually spread." /
     "% interactions AI-handled" / ["Containment / autonomy rate","Topic/intent coverage","Active adoption","Fallback-to-human rate"]
  9. speed-to-value / "Speed-to-value / velocity" / "How fast we ship new agent capability." /
     "Time to launch a new topic/skill" / ["Iteration cycle time","Eval-to-prod lead time","Deployment frequency"]
Render these as selectable cards in the profile view's Value Focus seam; the stakeholder picks 2-3.
On selection, persist the chosen keys to localStorage (this is the FIRST use of persistence anywhere
in this prototype -- call this out explicitly in your build summary as a new precedent, and make it
degrade gracefully with a try/catch if localStorage is unavailable). Selected focuses must re-rank
the Decisions queue using a TWO-TIER sort: (1) decisions whose feature/topic matches a selected focus
sort first, (2) within and across that grouping, sort by the EXISTING, UNMODIFIED Impact Score --
never alter the underlying score computation itself. To tag decisions with a focus without touching
already-finalized decision objects from other features, add a small local mapping table (e.g. by
decision id or agentId -> valueFocusTags[]) rather than editing every decision object's own fields.`,
    acceptanceCriteria: [
      'PL.valueFocusTaxonomy has exactly the 9 categories specified with correct framing/KPI text.',
      'Profile view renders selectable Value Focus cards inside the seam left by profile-shell, without modifying profile-shell code.',
      '2-3 selections persist across a page reload via localStorage, with graceful fallback if unavailable.',
      'Decisions queue re-ranks by focus-match-first then unmodified Impact Score; the score() function itself is unchanged and still produces identical numbers as before this feature.',
    ],
    reviewers: ['architecture', 'qa', 'ux', 'security'],
  },
  {
    id: 'profile-recent-decisions-log', title: 'Recent-decisions log (A3)', wave: 'B', dependsOn: ['profile-shell', 'decisions-copy-revamp'],
    files: ['prototype-2/render.js', 'prototype-2/app.js', 'prototype-2/data.js', 'prototype-2/styles.css'],
    spec: `Build into the RECENT_DECISIONS_SEAM left by the profile-shell feature inside render.js's
'profile(state)' view (read that function first). Add a new top-level 'decisionLog' array to
window.PL in data.js with exactly these 4 seed rows (fields: decisionTitle, decidedBy, conditional,
impactSummary):
  1. "Billing Agent -- pilot approved (5%)" / "Maya Okonkwo" / "with rollback triggers armed" /
     "$18k/mo projected savings, +12% deflection"
  2. "Escalation replies v2.4 -- approved" / "Maya Okonkwo" / "hard 30-second handoff guardrail" /
     "Clarity up in 23/24 scenarios; commitment protected"
  3. "Repeat-escalation limit -- set to 2 retries" / "Nadia Chen (delegated)" / null /
     "Unblocked 3 routing tasks; covers 96% of self-resolutions"
  4. "Intent-routing v1.3 -- auto-advanced" / "System (approved policy)" / null /
     "Passed all evals; no policy change"
(Use the exact revamped decision titles from the decisions-copy-revamp feature that already landed in
Wave A where they overlap -- read data.js's current decisions to confirm exact current wording rather
than retyping from memory.) Render each row with decider, the conditional-approval note if present,
the impact summary, and a "Raise a concern" action per row. "Raise a concern" only needs to be a
lightweight, local UI action (e.g. a confirm/toast acknowledging the concern was flagged and who it
notifies) -- do not build a new backend or persistence for it; reuse the existing toast pattern from
app.js if one exists.`,
    acceptanceCriteria: [
      'PL.decisionLog has exactly the 4 specified rows with correct decider/conditional/impact text.',
      'Recent-decisions log renders inside the seam left by profile-shell without modifying profile-shell code.',
      'Every row has a working "Raise a concern" action using the existing toast/notification pattern, not a new one.',
      'Log titles match the actual current (post-copy-revamp) decision titles where they refer to existing decisions.',
    ],
    reviewers: ['architecture', 'qa', 'ux'],
    naReasons: { security: 'Read-only log over already-existing decision fields; "Raise a concern" is local UI state only, no new write path or external call.' },
  },
  {
    id: 'presenter-cockpit', title: 'Desktop decision cockpit', wave: 'C',
    dependsOn: ['presenter-entry-point', 'foundation-features-model', 'decisions-copy-revamp', 'decisions-new'],
    files: ['prototype-2/render.js', 'prototype-2/app.js', 'prototype-2/styles.css'],
    spec: `Replace the placeholder body of render.js's 'presenter(state)' function (added by the
presenter-entry-point feature -- read it first, then implement the REAL cockpit in its place; do not
change its registration in the valid[] whitelist or window.PLRender export, only its body/implementation).
Build EXACTLY the approved design in docs/presenter-cockpit-mockup.html (open and read that file
closely -- it is the source of truth for structure, copy, and visual treatment) as a real, working
view wired to live app state, not static markup:
  1. Decision Dashboard: one row per blocking decision (type "decision"), CSS-grid columns matching
     the mockup (decision+one-liner, surfacing agent chip, decides/who-chip using the existing raci()
     honesty behavior, recommendation, build item via reverse lookup on PL.features[].decisionIds,
     unblocks via signals.blocksToday), sorted by Impact Score descending using the EXISTING
     score()/contributions() functions -- never hand-author a score. The Impact Score number is a
     real clickable control that opens a modal showing that decision's honest sub x weight =
     contribution breakdown (reuse render.js's existing breakdown()/provenance() functions -- do not
     reimplement the math), its recommendation/rationale, and key evidence, mirroring the mockup's
     modal. The modal also carries working Approve/Revise/Reject actions that call the SAME
     'data-decide' handler already used elsewhere in app.js -- no new decision engine.
  2. "Value from today's decisions" panel styled per the mockup (dark panel, white/near-white large
     stat numbers, minimal dead space) -- values must be derived from actually-decided vs
     actually-open decisions in current state, not hardcoded.
  3. Build items list at the bottom, one row per PL.features entry with its status and a short
     description referencing its decisionIds count/open-vs-total.
  Inline Approve/Revise/Reject buttons per dashboard row reuse the existing decide/confirm flow.
  Actioning a blocking decision must update its linked build item's displayed state live (no full
  page reload). Reuse existing renderers (brief/compactCard/scoreBadge-equivalents) wherever the
  mockup content overlaps with an existing component rather than inventing new HTML structures from
  scratch.`,
    acceptanceCriteria: [
      'Presenter Mode cockpit visually and structurally matches docs/presenter-cockpit-mockup.html: Decision Dashboard on top, Value panel in the middle, Build items at the bottom (no momentum-strip/hero-card pattern).',
      'Impact Score numbers are real links; clicking one opens a modal with a live, honest breakdown computed via the existing score/contributions/provenance functions -- verified against at least one decision by hand in the QA pass.',
      'Approve/Revise/Reject in the dashboard rows and in the modal both drive the existing data-decide pipeline and visibly update state (toast + row/build-item update), with no duplicate/divergent decide logic.',
      'Build items row reflects real PL.features data (added by foundation-features-model), not static mockup text.',
      'No regression to the existing Today/Decisions views or decide flow.',
    ],
    reviewers: ['architecture', 'qa', 'ux', 'security'],
    uxScript: 'Open prototype-2/index.html, enter Presenter Mode via the time picker, verify the Decision Dashboard/Value panel/Build items layout and ordering matches the approved mockup, click an Impact Score to open the breakdown modal and verify the math and evidence render correctly, exercise Approve/Revise/Reject from both a dashboard row and from inside the modal, and check keyboard reachability, focus return after modal close, and contrast of the dark Value panel text.',
  },
  {
    id: 'buildview-placeholder', title: 'Build View placeholder + feature cards', wave: 'C',
    dependsOn: ['foundation-features-model', 'decisions-copy-revamp', 'decisions-new'],
    files: ['prototype-2/render.js', 'prototype-2/app.js', 'prototype-2/styles.css'],
    spec: `Add a new tab/view named "build" positioned in the nav between the existing Evidence and
Memory tabs (find the nav rendering and the 'valid' whitelist array in app.js; add 'build' to the
whitelist in the correct position and add the corresponding nav entry). Add a new 'buildView(state)'
function to render.js, added as a new key on the window.PLRender export object. Render one static
card per PL.features entry (added by foundation-features-model -- read that array, do not hardcode a
parallel copy of it) showing: name, status, one-line summary, and its mapped decisions split into
"blocking" (type "decision") vs "informing" (type "informative"), each decision linking to its
existing brief/decision-detail view (reuse the existing decision brief navigation -- do not build a
new decision-detail component). No live Jira data yet -- this is explicitly static/read-only per the
roadmap's staging.`,
    acceptanceCriteria: [
      "'build' tab appears in the nav positioned between Evidence and Memory and is in app.js's valid[] whitelist.",
      'buildView(state) renders one card per real PL.features entry (4 cards), not hardcoded duplicate content.',
      'Each card correctly splits its mapped decisions into blocking vs informing and each decision links to the existing brief view.',
      'No regression to Evidence or Memory tabs/ordering.',
    ],
    reviewers: ['architecture', 'qa', 'ux'],
    naReasons: { security: 'Static read-only cards over existing feature/decision seed data; no new access path.' },
    uxScript: 'Open prototype-2/index.html, confirm the new Build tab sits between Evidence and Memory in the nav, open it, verify all 4 feature cards render with correct status/summary and correctly split blocking vs informing decisions, click through to a decision brief from a card, and check keyboard/tab order and focus visibility across the new tab and cards.',
  },
]

const WAVES = [
  { label: 'Wave A', ids: ['foundation-features-model', 'presenter-entry-point', 'decisions-copy-revamp', 'profile-shell', 'integrations-jira-spike'] },
  { label: 'Wave B', ids: ['decisions-new', 'profile-value-focus', 'profile-recent-decisions-log'] },
  { label: 'Wave C', ids: ['presenter-cockpit', 'buildview-placeholder'] },
]

function conventionsReviewPrompt(role) {
  const roleLabel = role === 'ux' ? 'UX/UI & Accessibility Lead' : 'Technical Architect'
  return `You are acting as the ${roleLabel} on a 10-feature parallel build of the ProofLoop
prototype (vanilla HTML/CSS/JS at ${ROOT}/prototype-2). Below is the lead orchestrator's DRAFT of
shared conventions, interface contracts, and file-ownership rules that all 10 feature builders and
all reviewers will follow. Read the actual current files (data.js, render.js, app.js, styles.css,
README.md) in ${ROOT}/prototype-2 to confirm the draft's claims about anchors/exports/whitelist are
accurate RIGHT NOW, then either confirm it as correct or flag concrete corrections/additions from
your role's perspective (${role === 'ux' ? 'naming/visual/accessibility consistency conventions worth adding' : 'architectural risks, additive-only-edit safety, sequencing/dependency concerns'}).
Be concise -- a short confirmation or a short list of concrete corrections, not a rewrite.

DRAFT CONVENTIONS:
${DRAFT_CONVENTIONS}`
}

function buildPrompt(feature, conventions, depNotes) {
  return `You are the sole builder for ONE feature in a 10-feature parallel build of the ProofLoop
prototype. You are working in your own isolated git worktree/branch, created fresh off the current
state of the main repository at ${ROOT}. Another agent (a reviewer) will independently inspect your
work afterward and can reject it -- you do not review or approve your own work.

SHARED CONVENTIONS (must follow):
${conventions}

YOUR FEATURE: ${feature.title} (id: ${feature.id})
FILES IN SCOPE: ${feature.files.join(', ')}
${depNotes || ''}

SPEC:
${feature.spec}

ACCEPTANCE CRITERIA (self-check every one before finishing, report status honestly for each):
${feature.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Read the CURRENT actual contents of every file in scope before editing -- do not rely on assumed line
numbers, they will have shifted. Make only the additive, in-scope changes described. When finished,
'git add' and 'git commit' your changes in your current worktree (you are already on your own branch
-- do not create additional branches, do not push, do not merge, do not touch any other worktree).
Then run 'pwd' and 'git rev-parse --abbrev-ref HEAD' and report their exact output as worktreePath and
branch. List every file you actually changed. Write a clear summary of what you built, how you
verified it (what you read/ran/checked -- this is a static HTML/JS app with no test runner, so
"verification" means concrete manual checks, e.g. opening index.html and exercising the flow, or
reasoning through the exact code path), any known limitations, and preview instructions (e.g. "open
prototype-2/index.html, do X"). Self-check each acceptance criterion honestly -- do not claim one is
met if you are not sure.`
}

function fixPrompt(feature, build, findings, conventions) {
  const groups = {}
  findings.forEach(f => { groups[f.role] = groups[f.role] || []; groups[f.role].push(f) })
  const findingsText = Object.keys(groups).map(role => {
    const label = (ROLE_META[role] && ROLE_META[role].label) || role
    return `${label} findings:\n` + groups[role].map(f => `  - [${f.severity}${f.requiredFix ? ', MUST FIX' : ', optional'}] ${f.summary}\n    Evidence: ${f.evidence}`).join('\n')
  }).join('\n\n')
  return `You are continuing work on an EXISTING feature branch/worktree (NOT a fresh one) as part of
a 10-feature parallel build of the ProofLoop prototype. Before doing anything else, run 'cd "${build.worktreePath}"'
then confirm with 'pwd' and 'git rev-parse --abbrev-ref HEAD' that you are on branch "${build.branch}"
in worktree "${build.worktreePath}" -- if that does not match, STOP and report the mismatch instead of
editing anything.

SHARED CONVENTIONS (must follow):
${conventions}

YOUR FEATURE: ${feature.title} (id: ${feature.id})
ORIGINAL SPEC:
${feature.spec}

Independent reviewers found the following issues with the current state of this branch. Items marked
"MUST FIX" are required before this feature can be approved; items marked "optional" are minor
suggestions you may address opportunistically but must not let block or distract from the required
fixes:

${findingsText}

Apply the required fixes precisely, re-verify, commit the changes on the SAME branch (git add + git
commit -- do not create a new branch, do not push, do not merge). Report the same information as
before: branch, worktreePath (should be identical to before), every file changed (cumulative, including
this fix), an updated summary reflecting the fixes, how you verified each fix, any remaining known
limitations, preview instructions, and an updated acceptance-criteria self-check.`
}

function reviewPrompt(feature, build, conventions, role) {
  const meta = ROLE_META[role]
  const uxNote = role === 'ux' ? `\n\nSPECIFIC INTERACTION TO EXERCISE: ${feature.uxScript || 'Open the relevant view in prototype-2/index.html and exercise the feature\'s primary interaction end to end.'}
Use ToolSearch (query like "browser navigate click screenshot") to load browser automation tools, then
navigate to 'file://${build.worktreePath}/prototype-2/index.html' and actually click through the
interaction above, taking at least one screenshot as evidence. If browser tools are truly unavailable
in your environment, you must say so explicitly in evidenceNotes and treat that as a real limitation
on your confidence -- an unperformed check is NOT a pass; lean toward "Changes required" or "Blocked"
rather than silently assuming the UI is fine from code alone.` : ''
  return `You are the ${meta.label} performing an INDEPENDENT review of one feature in a 10-feature
parallel build of the ProofLoop prototype. You did NOT build this feature and must not defer to the
builder's own self-assessment -- inspect the actual current implementation yourself.

YOUR REVIEW FOCUS: ${meta.focus}

SHARED CONVENTIONS the build should follow:
${conventions}

FEATURE UNDER REVIEW: ${feature.title} (id: ${feature.id})
SPEC:
${feature.spec}

ACCEPTANCE CRITERIA:
${feature.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

BUILDER'S SELF-REPORTED RESULT (verify this yourself, do not take it on faith):
Branch: ${build.branch}
Worktree path: ${build.worktreePath}
Files changed: ${(build.filesChanged || []).join(', ')}
Summary: ${build.summary}
Verification claimed: ${build.verification}
Limitations noted: ${build.limitations || 'none noted'}

Run 'cd "${build.worktreePath}"' (read-only -- do not edit or commit anything there) and inspect the
actual files on branch "${build.branch}" (e.g. 'git diff main...HEAD -- <files>' and reading the
current file contents) to verify the claims above against reality.${uxNote}

Return a verdict of exactly one of "Pass", "Changes required", or "Blocked". "Pass" means every
acceptance criterion in your focus area is actually met, verified by you, with no unresolved
required-fix-level finding. Distinguish required fixes (requiredFix: true, blocks completion) from
optional/stylistic suggestions (requiredFix: false, must not block completion). Every finding needs a
concrete summary and evidence (a file/line, an observed behavior, a screenshot description, etc.) --
do not report vague concerns. If you could not actually perform a check that your role requires (e.g.
no way to run the UI), do not default to Pass -- say so in evidenceNotes and reflect that in your
verdict.`
}

function integratorPrompt(waveLabel, approved) {
  const list = approved.map(a => `- ${a.id}: branch "${a.build.branch}" (worktree ${a.build.worktreePath})`).join('\n')
  return `You are the LEAD ORCHESTRATOR's integration agent for ${waveLabel} of a 10-feature parallel
build of the ProofLoop prototype at ${ROOT}. The following feature branches have been independently
reviewed and APPROVED by all required reviewers and are ready to merge into main:
${list}

Run 'cd "${ROOT}"' and confirm you are on branch 'main' with a clean working tree ('git status'). For
each branch listed above, in order, run 'git merge --no-edit <branch>'. Known likely conflict
hotspots and how to resolve them (always keep the UNION of both sides -- never drop an existing entry
or key from either side):
  - prototype-2/app.js: the 'const valid = [...]' whitelist array -- keep every string from both sides.
  - prototype-2/render.js: the 'window.PLRender = { ... }' export object literal -- keep every key from
    both sides.
  - prototype-2/data.js: the 'window.PL = { ... }' top-level object literal -- keep every key from both
    sides (this is where 'features', 'valueFocusTaxonomy', 'decisionLog', and new decisions all land).
If a conflict resolution is not obviously a clean union (e.g. two features edited the exact same
line), resolve it by preserving BOTH intents as literally as possible and note it as a conflict in
your report rather than guessing and staying silent. After each successful merge, 'git add' any
resolved files and 'git commit --no-edit' (or 'git merge --continue' if mid-merge). After all branches
are merged, optionally clean up with 'git worktree remove <path> --force' and 'git branch -d <branch>'
for each merged branch (skip cleanup silently if it fails, just note it -- do not force-delete
anything uncommitted). Finish by running 'git log --oneline -15' and 'git status' and confirming you
are still on 'main'. Report exactly which branches merged cleanly, any conflicts encountered and how
you resolved them, the final HEAD commit hash/message, the git log output, whether ANY merge failed
outright (anyFailures), and full details.`
}

async function runReviews(feature, build, conventions, roles, waveLabel) {
  const settled = await parallel(roles.map(role => async () => {
    try {
      const result = await agent(reviewPrompt(feature, build, conventions, role), {
        label: `review:${role}:${feature.id}`, phase: `${waveLabel} Review`, schema: REVIEW_SCHEMA,
      })
      return [role, result]
    } catch (e) {
      return [role, null]
    }
  }))
  const out = {}
  roles.forEach((role, i) => {
    const pair = settled[i]
    const result = (pair && pair[1]) ? pair[1] : {
      verdict: 'Blocked',
      findings: [{ severity: 'high', summary: 'Reviewer agent did not return a usable result (unavailable or failed).', evidence: 'agent() returned null/threw', requiredFix: true }],
      evidenceNotes: 'Check not performed -- treated as not passing per policy (an unperformed check is not a pass).',
    }
    out[role] = result
  })
  return out
}

async function runFeaturePipeline(feature, conventions, waveLabel, depNotes) {
  const build = await agent(buildPrompt(feature, conventions, depNotes), {
    label: `build:${feature.id}`, phase: `${waveLabel} Build`, schema: BUILD_SCHEMA, isolation: 'worktree',
  })
  if (!build) {
    log(`${feature.id}: builder agent failed to return a result -- marking BLOCKED.`)
    return { id: feature.id, title: feature.title, status: 'BLOCKED', build: null, reviews: {}, naReasons: feature.naReasons || {}, blockers: ['Builder agent did not return a result.'] }
  }
  let currentBuild = build
  let reviews = await runReviews(feature, currentBuild, conventions, feature.reviewers, waveLabel)
  let failingRoles = Object.keys(reviews).filter(r => reviews[r].verdict !== 'Pass')
  if (failingRoles.length) {
    log(`${feature.id}: ${failingRoles.join(', ')} required changes -- dispatching one fix round.`)
    const findings = failingRoles.flatMap(r => (reviews[r].findings || []).map(f => ({ ...f, role: r })))
    const fixed = await agent(fixPrompt(feature, currentBuild, findings, conventions), {
      label: `fix:${feature.id}`, phase: `${waveLabel} Review`, schema: BUILD_SCHEMA,
    })
    if (fixed) {
      currentBuild = fixed
      const retryReviews = await runReviews(feature, currentBuild, conventions, failingRoles, waveLabel)
      reviews = { ...reviews, ...retryReviews }
      failingRoles = Object.keys(reviews).filter(r => reviews[r].verdict !== 'Pass')
    } else {
      log(`${feature.id}: fix agent failed to return a result -- remains BLOCKED on original findings.`)
    }
  }
  const status = failingRoles.length ? 'BLOCKED' : 'APPROVED'
  log(`${feature.id}: ${status}${failingRoles.length ? ' (' + failingRoles.join(', ') + ' still failing)' : ''}`)
  return { id: feature.id, title: feature.title, status, build: currentBuild, reviews, naReasons: feature.naReasons || {}, failingRoles }
}

async function integrateWave(waveLabel, pipelineResults) {
  const approved = pipelineResults.filter(r => r.status === 'APPROVED' && r.build)
  const blocked = pipelineResults.filter(r => r.status !== 'APPROVED')
  if (blocked.length) log(`${waveLabel}: NOT merging ${blocked.map(b => b.id).join(', ')} -- did not pass review.`)
  if (!approved.length) return { mergedBranches: [], anyFailures: false, details: 'Nothing approved to merge this wave.', finalCommit: '' }
  const integration = await agent(integratorPrompt(waveLabel, approved), {
    label: `integrate:${waveLabel}`, phase: `${waveLabel} Integrate`, schema: INTEGRATE_SCHEMA,
  })
  return integration || { mergedBranches: [], anyFailures: true, details: 'Integrator agent failed to return a result -- nothing confirmed merged.', finalCommit: '' }
}

function depNotesFor(ids, statusById) {
  if (!ids || !ids.length) return ''
  const lines = ids.map(id => {
    const s = statusById[id]
    if (!s) return `- ${id}: not yet built in this run.`
    return `- ${id}: ${s.status}${s.status !== 'APPROVED' ? ' (NOT merged to main -- treat its output as unavailable/best-effort; note this explicitly as a limitation)' : ' (merged to main)'}`
  })
  return `DEPENDENCIES (already attempted earlier in this build):\n${lines.join('\n')}\nIf a dependency is not merged, work from the spec text above rather than assuming its code exists in main yet, and flag the gap in your limitations.`
}

// ---- Conventions ----
phase('Conventions')
const conventionNotes = await parallel([
  () => agent(conventionsReviewPrompt('ux'), { label: 'conventions:ux', phase: 'Conventions', schema: CONVENTIONS_SCHEMA }),
  () => agent(conventionsReviewPrompt('architecture'), { label: 'conventions:architecture', phase: 'Conventions', schema: CONVENTIONS_SCHEMA }),
])
const FINAL_CONVENTIONS = DRAFT_CONVENTIONS +
  '\n\nUX/UI LEAD SIGN-OFF NOTES:\n' + ((conventionNotes[0] && conventionNotes[0].notes) || 'No response received; proceeding with lead-authored draft as-is.') +
  '\n\nTECHNICAL ARCHITECT SIGN-OFF NOTES:\n' + ((conventionNotes[1] && conventionNotes[1].notes) || 'No response received; proceeding with lead-authored draft as-is.')
log('Conventions finalized.')

// ---- Waves ----
const statusById = {}
const integrationByWave = {}
for (const wave of WAVES) {
  const features = FEATURES.filter(f => wave.ids.includes(f.id))

  phase(`${wave.label} Build`)
  const results = await parallel(features.map(f => async () => {
    const depNotes = depNotesFor(f.dependsOn, statusById)
    return runFeaturePipeline(f, FINAL_CONVENTIONS, wave.label, depNotes)
  }))
  results.filter(Boolean).forEach(r => { statusById[r.id] = r })

  phase(`${wave.label} Integrate`)
  const integration = await integrateWave(wave.label, results.filter(Boolean))
  integrationByWave[wave.label] = integration
  log(`${wave.label} integration: merged [${(integration.mergedBranches || []).join(', ')}], anyFailures=${integration.anyFailures}`)
}

// ---- Cross-feature QA + consistency ----
phase('Cross-feature QA')
const crossQA = await agent(`You are the QA & Integration Engineer performing a final CROSS-FEATURE
verification pass on the ProofLoop prototype at ${ROOT} after all 10 features have been merged into
'main'. Run 'cd "${ROOT}"', confirm you are on 'main', and inspect the actual current state of
prototype-2/. Exercise these end-to-end cross-feature workflows by reading the relevant code paths and,
where practical, opening prototype-2/index.html via browser tools (ToolSearch for browser navigate/click):
  1. Today -> decide a decision -> confirm its linked build item (Build tab) reflects the update.
  2. Profile -> select 2-3 Value Focus areas -> confirm Decisions queue re-ranks per the two-tier sort
     without changing any individual Impact Score.
  3. Presenter Mode entry from the time picker -> Decision Dashboard -> open an Impact Score modal ->
     approve from inside the modal -> confirm the dashboard row and the Build tab both reflect it.
  4. Decisions tab shows all 6 revamped + 4 new decisions with correct copy and no duplicate/missing ids.
  5. Build tab sits between Evidence and Memory and its 4 cards' decision links resolve to real briefs.
Report concrete pass/fail findings with evidence for each workflow, not a generic summary.`,
  { schema: REVIEW_SCHEMA, phase: 'Cross-feature QA' })

phase('Consistency Check')
const consistency = await parallel([
  () => agent(`You are the UX/UI & Accessibility Lead doing a final CONSISTENCY pass across the whole
combined ProofLoop prototype at ${ROOT} (branch main, all 10 features merged). Open prototype-2/index.html
via browser tools where possible and review Today, Decisions, Profile, Presenter Mode, and the new Build
tab together. Check: consistent visual language/CSS-token usage across all new views, consistent
copy/tone, consistent component reuse (no two features reinventing the same pattern differently),
consistent keyboard/focus/contrast behavior. Report concrete findings with evidence, severity, and
whether each is required or optional.`, { schema: REVIEW_SCHEMA, phase: 'Consistency Check' }),
  () => agent(`You are the Technical Architect doing a final CONSISTENCY pass across the whole combined
ProofLoop prototype at ${ROOT} (branch main, all 10 features merged). Read prototype-2/data.js,
render.js, app.js, and worker/index.js in full as they now stand. Check: no duplicated logic across
features, no incompatible implementation choices, the 'valid' whitelist / 'window.PLRender' export /
'window.PL' object are all internally consistent with no leftover merge artifacts, honest-arithmetic
invariant still holds everywhere scores are displayed, and the two agentId namespaces (watch-floor vs
delivery-crew) were not conflated by any feature. Report concrete findings with evidence, severity, and
whether each is required or optional.`, { schema: REVIEW_SCHEMA, phase: 'Consistency Check' }),
])

return {
  conventions: FINAL_CONVENTIONS,
  features: FEATURES.map(f => {
    const s = statusById[f.id] || { status: 'NOT RUN' }
    return {
      id: f.id, title: f.title, wave: f.wave, owner: `build:${f.id}`,
      buildStatus: s.build ? 'built' : 'not built',
      reviewStatus: Object.fromEntries(Object.entries(s.reviews || {}).map(([k, v]) => [k, v.verdict])),
      naReasons: f.naReasons || {},
      blockers: (s.failingRoles || []).flatMap(role => ((s.reviews && s.reviews[role] && s.reviews[role].findings) || []).filter(x => x.requiredFix).map(x => `[${role}] ${x.summary}`)),
      overallStatus: s.status || 'NOT RUN',
      branch: s.build ? s.build.branch : null,
    }
  }),
  integrationByWave,
  crossFeatureQA: crossQA,
  consistency: { ux: consistency[0], architecture: consistency[1] },
}
