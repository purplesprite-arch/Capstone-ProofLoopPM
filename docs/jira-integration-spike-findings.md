# Jira Integration Spike — Findings Memo

**Status:** Spike complete (Stage 1 of the Integrations lane). **Deliverable:** this memo — no
code shipped, per the roadmap's own staging (see `docs/roadmap.html#appendix-integrations`,
"Confirm auth model, JQL-by-label, and the status-map shape... before committing to any sync
build.").

**Hard constraint (from the brief, restated in the roadmap appendix):** *no extensive
configuration in either tool, no ongoing maintenance burden.* Every recommendation below is
scored against that constraint first — if an option is more "correct" but adds recurring setup
or upkeep, it loses to the simpler option.

**Reference read:** `docs/roadmap.html`, Appendix D ("Jira & agile-board integration",
`#appendix-integrations`) and Appendix E ("Foundation", `#appendix-foundation`, which already
proposes the `features[]` shape this memo assumes: `id, name, agentId, status, summary,
progress, decisionIds[], jiraKey?, blockers[]`, with `status ∈ backlog | in-progress |
build-complete | piloting | live`). This memo does not reinvent that shape — it fills in the
three specific unknowns the roadmap flagged as needing confirmation before Stage 2 (read-only
sync) can be built.

---

## 1. Auth model: single Jira API token (recommended)

**Recommendation: a single Jira Cloud API token, scoped to a read-only "integration" account (or
the operator's own account if a dedicated service account isn't available), stored as a Cloudflare
Worker secret.**

| | API token | OAuth 2.0 (3LO) |
|---|---|---|
| Setup | One token, generated once in Jira Atlassian account settings, pasted into `wrangler secret put JIRA_API_TOKEN`. No app registration. | Register an OAuth app in the Atlassian developer console, configure redirect URIs, implement an authorization-code flow, handle consent screens. |
| Ongoing maintenance | None, until the token is rotated or revoked (operator-controlled, infrequent). | Access tokens expire (typically ~1 hour) and must be refreshed via a stored refresh token — the Worker would need to persist and rotate refresh tokens, and handle refresh failures. |
| Fits "no ongoing maintenance burden"? | Yes — this is exactly a "set it and forget it" credential. | No — refresh-token lifecycle management is itself an ongoing maintenance burden, for a prototype/internal tool that doesn't need per-user delegated identity. |
| Appropriate when... | The integration always acts as one fixed identity (a bot/service account) doing read-only lookups. This is our case: ProofLoop is reading issue status on behalf of the whole team, not "as" any individual user. | Multiple end users need the integration to act with *their own* individual Jira permissions/identity, or the vendor requires OAuth (Jira Cloud does still support API tokens for this use case, so that's not a blocker here). |

**Tradeoff being accepted:** the token belongs to one Jira identity, so Jira's audit log will
show all ProofLoop reads as that one account rather than per-viewing-user. For a read-only status
poll this is an acceptable and standard tradeoff (it's exactly what most lightweight Jira
integrations do), and it avoids the token-refresh machinery OAuth would require inside the
Worker. If ProofLoop later needs to *write* to Jira on behalf of distinct human users (which
Stage 4, two-way sync, would require), OAuth becomes the right call at that point — see §4.

**Storage:** Cloudflare Worker secret (`wrangler secret put`), never checked into `data.js` or any
client-side file — the token must never reach the browser bundle. The token is used server-side
only, inside the Worker's `/api/jira` handler (see §4 and the `worker/index.js` comment added by
this spike).

---

## 2. Finding relevant issues: JQL by a single label — sufficient

**Recommendation: apply one Jira label — `proofloop` — to every issue that should surface in
ProofLoop's Build view.** No custom fields, no new Jira project, no component/epic-link scheme to
maintain. This matches the roadmap's own Stage 2 description verbatim ("In Jira: add one label...
to relevant issues — no custom fields").

**Why a label (and not a JQL built from project/component/epic filters):** a label is the lowest
per-issue cost for a Jira user (two clicks, no admin permissions needed, works across any
project/board), and it produces a JQL query that is trivial to keep correct even as the underlying
project structure changes:

```
project in (PROJ1, PROJ2) AND labels = "proofloop" ORDER BY updated DESC
```

or, if we don't even want to hard-code project keys (simplest possible query, favored for the
"no configuration" constraint):

```
labels = "proofloop" ORDER BY updated DESC
```

**Is a single label sufficient?** Yes, for the read-only sync's actual job: *find the subset of
Jira issues that map 1:1 to a ProofLoop `feature`, and read their status.* The label answers "is
this issue relevant to ProofLoop at all" — the finer-grained "which specific ProofLoop feature
does this issue belong to" is answered per-issue by the `jiraKey` field already proposed on the
`features[]` shape (Appendix E), which stores the exact issue key (e.g. `PROJ-482`) once a human
links a feature to its Jira issue. So the label is the *discovery* filter (bulk JQL search, cheap,
low-maintenance) and `jiraKey` is the *binding* (per-feature, set once, no ongoing upkeep). Two
mechanisms, but both are one-time/low-frequency setup actions, not recurring configuration — this
still respects the constraint.

**One nuance worth flagging, not a blocker:** a label search only finds issues *someone remembered
to label*. That's an acceptable, low-stakes failure mode for a read-only status mirror (worst case:
a feature's Jira link is stale until someone applies the label) — it is not acceptable for a
system of record, which is one more reason two-way sync (§4, Stage 4) stays parked.

---

## 3. Status-map shape

**Recommendation: a small, static, hand-maintained object literal — not a UI, not a Jira-side
custom field — mapping Jira status names to the five ProofLoop feature statuses already defined
in Appendix E (`backlog | in-progress | build-complete | piloting | live`).**

```js
// Illustrative shape only — this spike does not ship this file.
// Lives wherever Stage 2 (read-only sync) reads config from; e.g. a small object
// in the Worker or in data.js, whichever the Stage 2 build settles on.
const jiraStatusMap = {
  "To Do":        "backlog",
  "In Progress":  "in-progress",
  "In Review":    "in-progress",   // fold any review-ish column into in-progress; keep the map small
  "Done":         "build-complete"
};
```

This covers three of the five ProofLoop statuses directly, exactly as named in the roadmap
appendix (`Done→build-complete`, `In Progress→in-progress`). `backlog` covers everything Jira
calls "To Do" (or whatever the team's default first column is named).

**`piloting` and `live` do not exist as concepts in a standard Jira workflow** — they are
ProofLoop-specific lifecycle stages that happen *after* a Jira issue is already "Done" (dev work
finished, but the feature isn't rolled out to real users yet, and later is fully live). Mapping
them from Jira status alone isn't possible without adding custom workflow statuses to Jira (which
violates the "no extensive configuration" constraint — that's exactly the kind of Jira-side setup
the brief warns against). Two low-maintenance options were considered:

- **Option A (recommended): two additional labels — `proofloop-piloting` and `proofloop-live`.**
  Applied manually by whoever owns the rollout, once at pilot start and once at go-live (the same
  two moments a human is already updating the Rollout/pilot views elsewhere in ProofLoop). The
  sync checks these labels *in addition to* status: if `proofloop-live` is present, status is
  `live` regardless of the Jira status-map result; else if `proofloop-piloting` is present, status
  is `piloting`; else fall through to the `jiraStatusMap` table above. This is two more labels,
  applied twice per feature over its whole lifecycle (not per-sprint, not recurring) — well within
  the "no ongoing maintenance burden" bar.
- **Option B (rejected for now): a specific Jira status name** (e.g. add "Piloting" and "Live" as
  real workflow statuses in Jira). More semantically "correct" but requires editing the Jira
  project's workflow — exactly the kind of admin-level, ongoing-maintenance Jira configuration the
  brief rules out. Revisit only if a team already has richer post-Done statuses in their existing
  workflow (some do) — in that case, map those existing statuses directly and skip the extra
  labels.

Net status-map shape actually needed by Stage 2:

```js
{
  statusMap: { "To Do": "backlog", "In Progress": "in-progress", "Done": "build-complete" },
  pilotingLabel: "proofloop-piloting",
  liveLabel: "proofloop-live"
}
```

Small enough to hard-code as a constant; does not need to be user-editable UI, which keeps Stage 2
itself small and avoids adding a settings surface just for this.

---

## 4. Staged recommendation

Matches the roadmap's own staging (`docs/roadmap.html#appendix-integrations`) exactly — this memo
does not propose a different sequence, only confirms the unknowns inside Stage 1:

1. **This spike (done).** Findings memo only, no code. Confirms auth model, label sufficiency, and
   status-map shape (this document).
2. **Read-only, label-driven, status-mapped sync — recommended next step.** In Jira: apply the
   `proofloop` label (plus `proofloop-piloting` / `proofloop-live` at the two rollout milestones).
   In ProofLoop: set `jiraKey` on each `features[]` entry once. The Worker's `/api/jira` route
   (currently a `501` stub in `worker/index.js`, per Appendix E's "Worker `/api` groundwork")
   calls Jira's REST search API with the single API token (§1) and the label-scoped JQL (§2), and
   maps the result through the status-map (§3) to overwrite the seed `status`/`progress` on the
   matching feature at read time — following the same override-map pattern already used elsewhere
   in `prototype-2/app.js` (`state.types`/`state.resolved` merged via `Object.assign`), not a
   rewrite of `data.js`. This is genuinely small — one route, one token, one label, one status
   table — and is the recommended next build item for the Integrations lane.
3. **Optional: push-based sync via a Jira Automation webhook to `/api/jira`.** A single Jira
   Automation rule (configured once, inside Jira's existing no-code Automation UI — not a plugin,
   not a new app) POSTs on issue transition to `/api/jira`. This removes polling latency and,
   notably, needs *no* ProofLoop-side Jira credentials for the push direction itself (Jira is
   calling us). Worth doing once Stage 2 is live and stable, but explicitly optional — Stage 2's
   polling-on-read is sufficient on its own and this is a latency nicety, not a prerequisite.
4. **Two-way sync — explicitly NOT recommended now; parked.** ProofLoop creating or transitioning
   Jira issues. This is the scenario the brief's constraint was written to prevent: it would mean
   maintaining write credentials with elevated Jira permissions, handling Jira-side validation/
   transition-guard failures, and reconciling conflicting edits from both systems — "now managing
   two tools instead of one." No concrete need for this has surfaced; revisit only if one does.

---

### Summary table

| Question | Answer |
|---|---|
| Auth model | Single Jira API token (Worker secret), not OAuth |
| Sufficient issue discovery? | Yes — one label (`proofloop`) + per-feature `jiraKey` binding |
| Status-map shape | Small static object: 3-entry Jira-status→ProofLoop-status table + 2 milestone labels for `piloting`/`live` |
| Next build step | Stage 2 — read-only label-driven sync into the existing `/api/jira` stub |
| Two-way sync | Not now — parked, high maintenance risk |
