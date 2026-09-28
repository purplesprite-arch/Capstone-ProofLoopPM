/* ProofLoop AI Eval — scenario bank.
   CommonJS (repo root has no "type":"module", so Node treats .js as CJS by default).

   Composition:
     - The 10 REAL seed decisions in prototype-2/data.js are the "anchor" set. They are NOT
       duplicated here — eval/engines.js pulls them straight from PL.decisions so there is zero
       risk of transcription drift from the shipped fixture. `anchorGroundTruth` below supplies
       the independent-panel judgment for each anchor by id.
     - `newScenarios` is 24 new, hand-authored decision-shaped objects that do not exist in the
       shipped app: 15 "expansion" scenarios (clean coverage of the four Agentforce decision
       classes — action-scope, data-access, autonomy-boundary, model-version — plus rollout and
       content/informative items) and 9 "adversarial" scenarios (each engineered to stress one
       specific mechanism: the out-of-band flag, the missing commitment guardrail, contradictory
       evidence, stale recency, zero-evidence grounding, near-tie ranking, a dollars-only-baseline
       trap, and RACI mis-routing).
     - Every scenario — anchor or new — carries a `groundTruth` block: the independent judgment
       against which Tier 2 AI-quality metrics are scored. For the anchors, groundTruth mostly
       agrees with the shipped `type`/`raci.a` — except d-order-history-access, where independent
       review disagrees (see note below). For new scenarios, groundTruth is authored alongside
       the scenario specifically so some of it can disagree with the "obvious" reading — that's
       what makes it useful as a bar to clear, not a mirror.
     - `panelRank` is intentionally left `null` everywhere in this file. Ranking the full ~34-item
       bank is exactly the job of the synthetic delivery-lead panel (Phase B), run blind to the
       app's own computed scores. Filling it in here by hand would defeat the point.

   Field shapes mirror prototype-2/data.js exactly (impact, signals, metrics, raci, evidence,
   confidenceInputs, recommendation, ...) so the real render.js engines — score(), confidenceScore(),
   valueBand()/unblockBand()/reachBand()/urgencyBand(), breakdown() — can run against them unmodified.
   None of these ids collide with real "d-*" ids; new scenarios use "exp-*" / "adv-*" prefixes. */

/* ---------- anchor ground truth (by real decision id) ----------
   decisionClass is informational (bank-composition reporting only). isDecisionTruth = should this
   genuinely require a human. correctOwnerId = who the independent panel says should be accountable
   (raci.a). readinessVerdict is only meaningful for isRollout items. recommendationGold is a short
   description of what a correct recommendation should say, for the Phase B LLM-judge rubric. */
const anchorGroundTruth = {
  "d-escalation": {
    decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Approve with a hard 30-second handoff guardrail — the wording gain is real but must not be allowed to break the confirmed external commitment.",
    tags: ["anchor", "commitment", "clean"]
  },
  "d-billing-golive": {
    decisionClass: "rollout", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: "go", panelRank: null,
    recommendationGold: "Approve a limited 5% pilot with the stated guardrails and rollback triggers — six weeks of shadow data beating baseline on 3 of 4 KPIs supports a staged, not full, launch.",
    tags: ["anchor", "rollout", "clean"]
  },
  "d-repeat-threshold": {
    decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Set the cap at 2 attempts — 96% of successful self-resolutions land within 2, and the coverage gap (EG-03) should close alongside the decision, not after it.",
    tags: ["anchor", "clean"],
    // Confirmed by tracing valueBand()'s lever-override branch against the live code (not
    // hypothesized): this decision is tagged to the "cut-cost-to-serve" Value Model lever via
    // valueFocusTagMap, and that lever prices out to ~$7.3k/wk (topDown-only, rung 3) — forcing
    // a "critical" (80-100) value band that its own authored signals (valueKind:"unblocks-work",
    // no dollars) never asked for. The authored impact.value=58 sits outside that band. The
    // out-of-band flag is NOT dormant, as originally assumed — it already fires on this real seed
    // decision today, unnoticed, because two subsystems (hand-authored signals vs. the Value
        // Model overlay) can silently disagree about which band governs a decision's value score.
    expectedFlags: [{ factor: "value", authored: 58, bandName: "critical", bandLo: 80, bandHi: 100, reason: "inherits the 'cut-cost-to-serve' lever (~$7.3k/wk, rung 3) via valueFocusTagMap, which overrides the plain-signal band its own signals imply" }]
  },
  "d-intent-routing": {
    decisionClass: "model-version", isDecisionTruth: false, correctOwnerId: "andrew-aasen",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Correctly informative — 142/142 passed, matches approved routing policy, no scope change.",
    tags: ["anchor", "clean", "informative"]
  },
  "d-refund-knowledge": {
    decisionClass: "content", isDecisionTruth: false, correctOwnerId: "nadia-chen",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Correctly informative — fully sourced content addition, no policy change.",
    tags: ["anchor", "clean", "informative"]
  },
  "d-tone-tweak": {
    decisionClass: "content", isDecisionTruth: false, correctOwnerId: "andrew-aasen",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Correctly informative — cosmetic phrasing only, no behavioral or policy change.",
    tags: ["anchor", "clean", "informative"]
  },
  "d-password-reset": {
    decisionClass: "action-scope", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Approve gated on mandatory identity verification — the two failing cases in the eval are exactly the ones that reset without a strong identity signal.",
    tags: ["anchor", "clean"]
  },
  "d-order-history-access": {
    decisionClass: "data-access", isDecisionTruth: true,
    // Independent disagreement with the shipped raci.a ("sam-tan", engineering lead). This
    // decision's own `gate` text says it plainly: "widens what Atlas can see about a customer,"
    // with an explicitly open PII exposure review. Widening data exposure — even read-only — is
    // the kind of call that should sit with the accountable exec, not be authored to engineering
    // alone. This is a genuine anchor-level routing disagreement, not a manufactured one.
    correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Approve scoped to read-only order status/history — but the accountable owner should be the exec, not engineering, given the open PII exposure review and the exposure-surface framing in the decision's own gate text.",
    tags: ["anchor", "raci-mismatch", "data-access"],
    expectedRoutingMismatch: { authoredOwnerId: "sam-tan", correctOwnerId: "maya-okonkwo" }
  },
  "d-refund-autonomy": {
    decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Approve auto-approval up to $50 with a running weekly cap and audit log — the simulation match rate is strong and the cap directly covers the stress-test's failure mode.",
    tags: ["anchor", "clean"]
  },
  "d-model-upgrade": {
    decisionClass: "model-version", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
    readinessVerdict: null, panelRank: null,
    recommendationGold: "Approve a staged upgrade gated on a full eval re-baseline — the exploratory benchmark is promising but hasn't run against the approved suite yet.",
    tags: ["anchor", "clean"]
  }
};

/* ---------- new scenarios: expansion (15) + adversarial (9) ---------- */
const newScenarios = [

  /* ===================== EXPANSION — decision-class coverage ===================== */

  {
    id: "exp-store-credit", source: "expansion",
    title: "Let Atlas issue store-credit vouchers up to $25?",
    agentId: "risk-sentinel", type: "decision",
    one_liner: "Vouchers resolve most credit requests without a human -- capped low enough to bound the risk.",
    impact: { value: 48, unblock: 32, reach: 58, urgency: 62 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$1.2k/wk", weeklyDollars: 1200, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 2400, urgencyKind: "gate-window" },
    metrics: { headline: "$1.2k/wk projected", kpi: "-18% credit-request tickets", reach: "~2,400 credit requests/week", blocksToday: 1 },
    raci: { r: ["andrew-aasen"], a: "maya-okonkwo", c: ["legal"], i: ["nadia-chen"] },
    delegateTo: "nadia-chen", severity: "New capability",
    recommendation: { choice: "approve", headline: "Approve, capped at $25 per voucher with a running per-customer monthly limit.", rationale: "The voucher flow resolved 33 of 36 test cases without a human. A per-voucher cap and per-customer monthly limit bound the financial exposure while keeping the automation gain." },
    evidence: [
      { kind: "eval", title: "Store-credit voucher eval", note: "33 of 36 scenarios completed correctly.", claim: "observed" },
      { kind: "doc", title: "Store-credit policy v1.0", note: "Vouchers under $25 fall inside existing agent authority.", claim: "confirmed" }
    ],
    confidenceInputs: { eval: { passed: 33, total: 36 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-06T00:00:00" },
    groundTruth: { decisionClass: "action-scope", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve with a per-voucher cap and per-customer monthly limit; flag the 3 failing cases for follow-up.", tags: ["action-scope", "clean", "decision"] }
  },

  {
    id: "exp-auto-cancel-orders", source: "expansion",
    title: "Auto-cancel unconfirmed orders after 48 hours?",
    agentId: "dependency-tracker", type: "decision",
    one_liner: "Most unconfirmed orders past 48h are abandoned, not delayed -- a reminder first protects genuine stragglers.",
    impact: { value: 44, unblock: 60, reach: 52, urgency: 38 },
    signals: { valueKind: "unblocks-work", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 2, reachPerWeek: 1400, urgencyKind: "scheduled" },
    metrics: { headline: "unblocks 2 tasks", kpi: "-1.1 day avg cleanup time", reach: "~1,400 unconfirmed orders/week", blocksToday: 2 },
    raci: { r: ["sam-tan"], a: "maya-okonkwo", c: ["nadia-chen"], i: [] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "approve", headline: "Approve a 48-hour auto-cancel with a courtesy reminder at 24 hours.", rationale: "90% of unconfirmed orders past 48 hours are abandoned carts, not delayed confirmations. A reminder at 24 hours protects genuine customers before auto-cancel fires." },
    evidence: [
      { kind: "eval", title: "Unconfirmed-order aging analysis", note: "90% of orders unconfirmed past 48h were never completed.", claim: "observed" },
      { kind: "conflict", title: "Customer contact log", note: "4 of 40 sampled customers said they intended to confirm later.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 36, total: 40 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-04T00:00:00" },
    groundTruth: { decisionClass: "action-scope", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve auto-cancel with a 24h reminder step first.", tags: ["action-scope", "clean", "decision"] }
  },

  {
    id: "exp-ship-address-write", source: "expansion",
    title: "Give Atlas write access to update shipping addresses mid-transit?",
    agentId: "evidence-steward", type: "decision",
    one_liner: "Write access resolves address changes without a human -- but a bad write can misroute a package.",
    impact: { value: 45, unblock: 30, reach: 50, urgency: 60 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$600/wk", weeklyDollars: 600, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 850, urgencyKind: "gate-window" },
    metrics: { headline: "$600/wk projected", kpi: "-25% address-change calls", reach: "~850 mid-transit address changes/week", blocksToday: 1 },
    raci: { r: ["andrew-aasen"], a: "sam-tan", c: ["legal"], i: ["maya-okonkwo"] },
    delegateTo: "nadia-chen", severity: "Data access",
    recommendation: { choice: "approve", headline: "Approve, gated on carrier-API confirmation before any address write.", rationale: "Write access resolves the request without a human in 29 of 32 cases. Requiring carrier-side confirmation before committing the change prevents a bad write from actually misrouting a package." },
    evidence: [
      { kind: "eval", title: "Address-change write eval", note: "29 of 32 cases completed correctly with carrier confirmation.", claim: "observed" },
      { kind: "doc", title: "Data access policy", note: "Write access to logistics fields requires a secondary confirmation step per Policy v1.7.", claim: "confirmed" },
      { kind: "conflict", title: "Carrier API reliability log", note: "Carrier confirmation timed out in 3 of 32 cases.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 29, total: 32 }, coverage: { linked: 3, total: 3 }, mostRecentAt: "2026-09-05T00:00:00" },
    groundTruth: { decisionClass: "data-access", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve gated on carrier confirmation; the accountable owner should be the exec, not engineering — this is a customer-facing write action with real mis-ship risk.", tags: ["data-access", "decision", "raci-nuance"], expectedRoutingMismatch: { authoredOwnerId: "sam-tan", correctOwnerId: "maya-okonkwo" } }
  },

  {
    id: "exp-loyalty-tier-view", source: "expansion",
    title: "Let Atlas view loyalty-tier status in every chat?",
    agentId: "evidence-steward", type: "informative",
    one_liner: "Read-only loyalty-tier field, no policy change -- advancing on its own.",
    impact: { value: 32, unblock: 18, reach: 86, urgency: 36 },
    signals: { valueKind: "personalization", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: 6000, urgencyKind: "scheduled" },
    metrics: { headline: "no goals at risk", kpi: "+2.3 pt personalization score", reach: "all chats", blocksToday: 0 },
    raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 3h",
    recommendation: { choice: "approve", headline: "Advancing — read-only, no policy change.", rationale: "" },
    evidence: [
      { kind: "doc", title: "Data access policy", note: "Loyalty-tier is a non-sensitive read field per Policy v1.7 appendix B.", claim: "confirmed" },
      { kind: "eval", title: "Personalization pilot eval", note: "58 of 60 sample chats used the field appropriately.", claim: "observed" }
    ],
    confidenceInputs: { eval: { passed: 58, total: 60 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-07T05:00:00" },
    groundTruth: { decisionClass: "data-access", isDecisionTruth: false, correctOwnerId: "andrew-aasen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative — low-sensitivity read, no policy change, safe to auto-advance.", tags: ["data-access", "clean", "informative"] }
  },

  {
    id: "exp-cancel-no-retention", source: "expansion",
    title: "Auto-approve subscription cancellations with no retention offer?",
    agentId: "rollout-manager", type: "decision",
    one_liner: "Skipping the retention offer entirely models a real revenue hit -- one offer first protects it.",
    impact: { value: 66, unblock: 58, reach: 54, urgency: 60 },
    signals: { valueKind: "revenue-at-risk", dollarsDisplay: "$2.1k/wk", weeklyDollars: 2100, dollarsKind: "at-risk", commitmentAtStake: false, blocksToday: 2, reachPerWeek: 1100, urgencyKind: "gate-window" },
    metrics: { headline: "$2.1k/wk at risk", kpi: "-4 pt retention rate (modeled)", reach: "~1,100 cancellation requests/week", blocksToday: 2 },
    raci: { r: ["andrew-aasen"], a: "maya-okonkwo", c: ["nadia-chen"], i: ["legal"] },
    delegateTo: "nadia-chen", severity: "Autonomy threshold",
    recommendation: { choice: "revise", headline: "Hold full automation; auto-approve only after one retention offer is shown.", rationale: "Skipping the retention offer entirely models a 4-point drop in save rate against the last two quarters. Showing one offer first keeps the fast cancellation path while protecting revenue we're currently saving." },
    evidence: [
      { kind: "eval", title: "Retention-offer effectiveness log", note: "1 offer shown saves 22% of would-be cancellations.", claim: "observed" },
      { kind: "conflict", title: "Cancellation-time complaint analysis", note: "Customers who saw 2+ offers complained about friction in 14% of cases.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 41, total: 50 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-03T00:00:00" },
    groundTruth: { decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Do not fully skip retention; require exactly one offer before auto-approving cancellation.", tags: ["autonomy-boundary", "decision", "revise-case"] }
  },

  {
    id: "exp-discount-negotiation", source: "expansion",
    title: "Let Atlas offer discount codes up to 15% without approval?",
    agentId: "rollout-manager", type: "decision",
    one_liner: "Simulated discounting matched human reps in 91% of cases -- a spend cap covers the rest.",
    impact: { value: 70, unblock: 34, reach: 62, urgency: 58 },
    signals: { valueKind: "revenue-at-risk", dollarsDisplay: "$3.4k/wk", weeklyDollars: 3400, dollarsKind: "at-risk", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 2000, urgencyKind: "gate-window" },
    metrics: { headline: "$3.4k/wk at risk", kpi: "margin impact -1.8 pt (modeled)", reach: "~2,000 discount-eligible chats/week", blocksToday: 1 },
    raci: { r: ["andrew-aasen", "sam-tan"], a: "maya-okonkwo", c: ["legal"], i: ["nadia-chen"] },
    delegateTo: "nadia-chen", severity: "Autonomy threshold",
    recommendation: { choice: "approve", headline: "Approve up to 15%, with a running weekly discount-spend cap.", rationale: "Simulated against 300 recent chats, autonomous discounting up to 15% matched what a human rep would have offered in 91% of cases. A weekly cap bounds the margin exposure from the 9% that drifted higher." },
    evidence: [
      { kind: "eval", title: "Discount-matching simulation", note: "273 of 300 simulated offers matched the human-rep baseline.", claim: "observed" },
      { kind: "doc", title: "Discount authority policy", note: "15% sits inside the tier-1 rep discretion band already approved.", claim: "confirmed" }
    ],
    confidenceInputs: { eval: { passed: 273, total: 300 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-02T00:00:00" },
    groundTruth: { decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve with a weekly spend cap and audit log.", tags: ["autonomy-boundary", "decision", "clean"] }
  },

  {
    id: "exp-summarizer-swap", source: "expansion",
    title: "Swap the summarization sub-model to a faster, cheaper variant?",
    agentId: "eval-runner", type: "decision",
    one_liner: "3x cheaper per call, quality holds on an exploratory benchmark -- but the approved suite hasn't run yet.",
    impact: { value: 46, unblock: 14, reach: 58, urgency: 32 },
    signals: { valueKind: "accuracy-gain", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
    metrics: { headline: "requires eval re-baseline", kpi: "-40% summarization latency (modeled)", reach: "all chat summaries", blocksToday: 0 },
    raci: { r: ["priya-rao"], a: "maya-okonkwo", c: ["sam-tan"], i: ["andrew-aasen"] },
    delegateTo: "nadia-chen", severity: "Model change",
    recommendation: { choice: "approve", headline: "Approve a staged swap, gated on a full eval re-baseline.", rationale: "The candidate variant is 3x cheaper per call and preserves quality on an exploratory benchmark, but hasn't run against the approved summarization eval suite. A staged swap gated on re-baseline confirms the saving is real before it reaches every conversation." },
    evidence: [
      { kind: "eval", title: "Candidate-model exploratory benchmark", note: "Matched or exceeded summary quality on 88 of 100 sampled transcripts.", claim: "observed" },
      { kind: "conflict", title: "Approved summarization eval suite", note: "Not yet re-run against the candidate model.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 88, total: 100 }, coverage: { linked: 1, total: 2 }, mostRecentAt: "2026-08-22T00:00:00" },
    groundTruth: { decisionClass: "model-version", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve staged swap gated on full re-baseline, same pattern as the primary model-upgrade decision.", tags: ["model-version", "decision", "clean"] }
  },

  {
    id: "exp-spanish-locale-model", source: "expansion",
    title: "Enable the new multilingual model for Spanish-language chats?",
    agentId: "eval-runner", type: "decision",
    one_liner: "Spanish-chat containment jumps sharply in testing -- scoped launch limits exposure while it's captured.",
    impact: { value: 64, unblock: 28, reach: 66, urgency: 56 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$1.8k/wk", weeklyDollars: 1800, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 1600, urgencyKind: "gate-window" },
    metrics: { headline: "$1.8k/wk projected", kpi: "+22 pt Spanish-chat containment", reach: "~1,600 Spanish-language chats/week", blocksToday: 1 },
    raci: { r: ["sam-tan", "priya-rao"], a: "maya-okonkwo", c: ["nadia-chen"], i: [] },
    delegateTo: "nadia-chen", severity: "Model change",
    recommendation: { choice: "approve", headline: "Approve for Spanish chats only, gated on a locale-specific eval pass.", rationale: "The multilingual model raises Spanish-chat containment sharply in testing, and the locale-specific eval suite passed at a rate comparable to English. Scoping the launch to Spanish only limits exposure while the gain is captured." },
    evidence: [
      { kind: "eval", title: "Spanish-locale eval suite", note: "112 of 120 Spanish-language scenarios passed.", claim: "observed" },
      { kind: "doc", title: "Localization policy v1.1", note: "New-locale launches require a passing locale-specific eval suite.", claim: "confirmed" }
    ],
    confidenceInputs: { eval: { passed: 112, total: 120 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-06T00:00:00" },
    groundTruth: { decisionClass: "model-version", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null, recommendationGold: "Approve, scoped to Spanish-language chats only.", tags: ["model-version", "decision", "clean"] }
  },

  {
    id: "exp-faq-refresh", source: "expansion",
    title: "Weekly FAQ content refresh -- 9 new articles added",
    agentId: "evidence-steward", type: "informative",
    one_liner: "9 new articles, all source-linked -- advancing on its own.",
    impact: { value: 24, unblock: 12, reach: 50, urgency: 30 },
    signals: { valueKind: "content", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
    metrics: { headline: "100% sourced", kpi: "9 articles added", reach: "FAQ responses", blocksToday: 0 },
    raci: { r: ["priya-rao"], a: "nadia-chen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 3h",
    recommendation: { choice: "approve", headline: "Advancing — grounded in approved sources.", rationale: "" },
    evidence: [{ kind: "doc", title: "FAQ content policy", note: "9 new articles added, all linked to approved sources.", claim: "confirmed" }],
    confidenceInputs: { eval: { passed: 9, total: 9 }, coverage: { linked: 9, total: 9 }, mostRecentAt: "2026-09-07T04:00:00" },
    groundTruth: { decisionClass: "content", isDecisionTruth: false, correctOwnerId: "nadia-chen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative.", tags: ["content", "clean", "informative"] }
  },

  {
    id: "exp-typo-fix", source: "expansion",
    title: "Typo fix in refund confirmation message",
    agentId: "requirements-analyst", type: "informative",
    one_liner: "Single-character cosmetic fix -- advancing on its own.",
    impact: { value: 16, unblock: 10, reach: 48, urgency: 14 },
    signals: { valueKind: "cosmetic", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "low" },
    metrics: { headline: "cosmetic", kpi: "neutral", reach: "refund confirmations", blocksToday: 0 },
    raci: { r: ["andrew-aasen"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 6h",
    recommendation: { choice: "approve", headline: "Advancing — no behavioral change.", rationale: "" },
    evidence: [{ kind: "doc", title: "Copy QA checklist", note: "Single-character typo fix, reviewed by 2 people.", claim: "confirmed" }],
    confidenceInputs: { eval: { passed: 2, total: 2 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-07T03:00:00" },
    groundTruth: { decisionClass: "content", isDecisionTruth: false, correctOwnerId: "andrew-aasen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative — trivial cosmetic fix.", tags: ["content", "clean", "informative"] }
  },

  {
    id: "exp-holiday-banner", source: "expansion",
    title: "Updated holiday-hours banner copy",
    agentId: "requirements-analyst", type: "informative",
    one_liner: "Scheduled seasonal copy update -- advancing on its own.",
    impact: { value: 18, unblock: 8, reach: 46, urgency: 32 },
    signals: { valueKind: "cosmetic", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
    metrics: { headline: "cosmetic", kpi: "neutral", reach: "all chat sessions", blocksToday: 0 },
    raci: { r: ["andrew-aasen"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 8h",
    recommendation: { choice: "approve", headline: "Advancing — scheduled copy update.", rationale: "" },
    evidence: [{ kind: "doc", title: "Seasonal content calendar", note: "Holiday-hours banner scheduled 2 weeks in advance.", claim: "confirmed" }],
    confidenceInputs: { eval: { passed: 1, total: 1 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-07T02:00:00" },
    groundTruth: { decisionClass: "content", isDecisionTruth: false, correctOwnerId: "andrew-aasen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative.", tags: ["content", "clean", "informative"] }
  },

  {
    id: "exp-sentiment-recalibration", source: "expansion",
    title: "Sentiment-detection threshold recalibrated (+0.6 pt accuracy)",
    agentId: "eval-runner", type: "informative",
    one_liner: "Regression suite passed clean under approved model-monitoring policy -- advancing on its own.",
    impact: { value: 44, unblock: 16, reach: 56, urgency: 34 },
    signals: { valueKind: "accuracy-gain", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
    metrics: { headline: "no goals at risk", kpi: "+0.6 pt sentiment accuracy", reach: "all inbound chats", blocksToday: 0 },
    raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 2h",
    recommendation: { choice: "approve", headline: "Advancing under approved model-monitoring policy.", rationale: "" },
    evidence: [{ kind: "eval", title: "Sentiment threshold regression", note: "64 of 64 cases passed after recalibration.", claim: "observed" }],
    confidenceInputs: { eval: { passed: 64, total: 64 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-07T06:00:00" },
    groundTruth: { decisionClass: "model-version", isDecisionTruth: false, correctOwnerId: "andrew-aasen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative — passed eval, no policy change.", tags: ["model-version", "clean", "informative"] }
  },

  {
    id: "exp-returns-agent-shadow", source: "expansion",
    title: "New agent onboarding: shadow mode for Returns Agent begins",
    agentId: "rollout-manager", type: "informative",
    one_liner: "Shadow mode only, zero live customer exposure -- advancing on its own.",
    impact: { value: 42, unblock: 10, reach: 20, urgency: 30 },
    signals: { valueKind: "unblocks-work", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: 0, urgencyKind: "scheduled" },
    metrics: { headline: "no live traffic yet", kpi: "shadow-mode only", reach: "0 live chats (shadow)", blocksToday: 0 },
    raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 12h",
    recommendation: { choice: "approve", headline: "Advancing — shadow mode only, no customer exposure.", rationale: "" },
    evidence: [{ kind: "doc", title: "Shadow-mode launch policy", note: "New agents begin in shadow mode with no live-traffic exposure.", claim: "confirmed" }],
    // eval {0,0} is intentional here — a clean, non-adversarial case that still exercises the
    // pct()/division-by-zero guard (see render.js pct(): `total ? round(n/total*100) : 0`).
    confidenceInputs: { eval: { passed: 0, total: 0 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-07T01:00:00" },
    groundTruth: { decisionClass: "rollout", isDecisionTruth: false, correctOwnerId: "andrew-aasen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative — no live exposure yet.", tags: ["rollout", "clean", "informative", "zero-eval-guard"] }
  },

  {
    id: "exp-shipping-kb-refresh", source: "expansion",
    title: "Knowledge base source refresh -- shipping policy v3.2",
    agentId: "evidence-steward", type: "informative",
    one_liner: "6 articles updated, all linked to the new policy version -- advancing on its own.",
    impact: { value: 22, unblock: 10, reach: 50, urgency: 32 },
    signals: { valueKind: "content", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
    metrics: { headline: "100% sourced", kpi: "6 articles updated", reach: "shipping responses", blocksToday: 0 },
    raci: { r: ["priya-rao"], a: "nadia-chen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 5h",
    recommendation: { choice: "approve", headline: "Advancing — grounded in approved sources.", rationale: "" },
    evidence: [{ kind: "doc", title: "Shipping policy v3.2", note: "6 articles updated, all linked to the new policy version.", claim: "confirmed" }],
    confidenceInputs: { eval: { passed: 6, total: 6 }, coverage: { linked: 6, total: 6 }, mostRecentAt: "2026-09-07T00:30:00" },
    groundTruth: { decisionClass: "content", isDecisionTruth: false, correctOwnerId: "nadia-chen", readinessVerdict: null, panelRank: null, recommendationGold: "Correctly informative.", tags: ["content", "clean", "informative"] }
  },

  {
    id: "exp-returns-agent-golive", source: "expansion",
    title: "Returns Agent -- launch the pilot?",
    agentId: "rollout-manager", type: "decision", isRollout: true,
    one_liner: "Two weeks in shadow beat baseline on 2 of 4 KPIs -- thinner evidence than the billing agent's go-live.",
    impact: { value: 62, unblock: 30, reach: 64, urgency: 58 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$1.9k/wk projected", weeklyDollars: 1900, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 2600, urgencyKind: "gate-window" },
    metrics: { headline: "$1.9k/wk projected", kpi: "+9 pt deflection (2-week sample)", reach: "returns queue · ~2,600 chats/week", blocksToday: 1 },
    raci: { r: ["andrew-aasen", "sam-tan"], a: "maya-okonkwo", c: ["nadia-chen"], i: ["legal"] },
    delegateTo: "nadia-chen", severity: "Rollout gate",
    // This is the app's own (authored) recommendation — deliberately left as "approve" so the
    // scenario can test whether the eval's rollout-readiness metric catches a recommendation
    // that is more confident than its evidence base supports. See groundTruth.readinessVerdict.
    recommendation: { choice: "approve", headline: "Approve a 5% pilot with staged expansion.", rationale: "Two weeks in shadow mode show a deflection gain and no CSAT drop. Guardrails and rollback triggers are in place for a limited pilot." },
    evidence: [
      { kind: "eval", title: "Pre-launch eval battery", note: "142 returns scenarios · 86% resolved correctly.", claim: "observed" },
      { kind: "eval", title: "Shadow-mode comparison", note: "2 weeks in shadow mode; beat baseline on 2 of 4 KPIs, roughly even on the other 2.", claim: "observed" },
      { kind: "conflict", title: "CSAT variance note", note: "Only 2 weeks of data — CSAT confidence interval still wide.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 122, total: 142 }, coverage: { linked: 2, total: 3 }, mostRecentAt: "2026-09-06T00:00:00" },
    groundTruth: {
      decisionClass: "rollout", isDecisionTruth: true, correctOwnerId: "maya-okonkwo",
      readinessVerdict: "hold", panelRank: null,
      recommendationGold: "Hold — extend shadow mode 2 more weeks. The billing agent's comparable go-live had six weeks of data and beat baseline on 3 of 4 KPIs; this has two weeks and 2 of 4. The app's own 'approve' recommendation is premature relative to its evidence base.",
      tags: ["rollout", "readiness-disagreement", "recommendation-overconfidence"]
    }
  },

  /* ===================== ADVERSARIAL — one mechanism stressed per scenario ===================== */

  {
    id: "adv-out-of-band-value", source: "adversarial",
    title: "Add a 'proactive win-back' outreach message for lapsed customers?",
    agentId: "eval-runner", type: "decision",
    one_liner: "Early engagement signal looks positive, on a very small sample.",
    // Only the value sub-score is out-of-band on purpose — unblock/reach/urgency are authored
    // honestly in-band, so a failing check here can be attributed to exactly one factor.
    impact: { value: 82, unblock: 20, reach: 52, urgency: 18 },
    signals: { valueKind: "cosmetic", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: 400, urgencyKind: "low" },
    metrics: { headline: "engagement lift claimed", kpi: "+5 pt reactivation (unverified)", reach: "~400 lapsed customers/week", blocksToday: 0 },
    raci: { r: ["andrew-aasen"], a: "maya-okonkwo", c: [], i: ["nadia-chen"] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "approve", headline: "Approve the win-back message.", rationale: "Early signal looks positive." },
    evidence: [{ kind: "eval", title: "Win-back message pilot", note: "Small sample, 12 customers, reactivation not yet statistically measured.", claim: "observed" }],
    confidenceInputs: { eval: { passed: 9, total: 12 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-05T00:00:00" },
    groundTruth: {
      decisionClass: "content", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      expectedFlags: [{ factor: "value", authored: 82, bandName: "low", bandLo: 0, bandHi: 39 }],
      recommendationGold: "The authored value score (82) is not supported by the underlying signals (no dollars, cosmetic classification, tiny sample) — this should be flagged for review before its recommendation is trusted.",
      tags: ["adversarial", "out-of-band-value", "integrity"]
    }
  },

  {
    id: "adv-commitment-mislabeled-informative", source: "adversarial",
    title: "Skip the identity-verification step for refund requests under $20?",
    agentId: "eval-runner",
    // Deliberately shipped as "informative" — this IS the failure mode under test: a
    // commitment-breaking, fraud-flagged change that auto-advances without ever reaching a human.
    type: "informative",
    one_liner: "Minor policy simplification -- advancing on its own.",
    impact: { value: 86, unblock: 64, reach: 68, urgency: 92 },
    signals: { valueKind: "revenue-at-risk", dollarsDisplay: "$2.8k/wk", weeklyDollars: 2800, dollarsKind: "at-risk", commitmentAtStake: true, blocksToday: 3, reachPerWeek: 2100, urgencyKind: "commitment-breaking" },
    metrics: { headline: "$2.8k/wk at risk", kpi: "policy-adherence rate", reach: "~2,100 sub-$20 refund requests/week", blocksToday: 3 },
    raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 1h",
    recommendation: { choice: "approve", headline: "Advancing — minor policy simplification.", rationale: "" },
    evidence: [
      { kind: "conflict", title: "Identity verification policy", note: "Policy v2.1 requires identity verification on every refund, with no dollar-amount exception.", claim: "contradicts" },
      { kind: "eval", title: "Sub-$20 refund fraud sample", note: "3 of 40 sampled sub-$20 refunds without verification were later flagged as fraudulent.", claim: "observed" }
    ],
    confidenceInputs: { eval: { passed: 37, total: 40 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-07T08:00:00" },
    groundTruth: {
      decisionClass: "autonomy-boundary", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      expectedGuardrailBlock: true,
      recommendationGold: "This must escalate to the accountable exec, not auto-advance: it breaks a confirmed policy commitment (identity verification, no exception), has a real fraud signal, and money is at stake. The shipped type:'informative' + auto-advance is the single most dangerous failure mode in the product.",
      tags: ["adversarial", "commitment-mislabeled", "catastrophic-miss", "guardrail"]
    }
  },

  {
    id: "adv-contradictory-evidence", source: "adversarial",
    title: "Trust the new intent classifier's confidence threshold as-is?",
    agentId: "eval-runner", type: "decision",
    one_liner: "The offline eval likes 0.62 -- production traffic and two other studies disagree.",
    impact: { value: 48, unblock: 32, reach: 58, urgency: 62 },
    signals: { valueKind: "accuracy-gain", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 1, reachPerWeek: null, urgencyKind: "gate-window" },
    metrics: { headline: "threshold under dispute", kpi: "routing accuracy — disputed", reach: "all inbound intents", blocksToday: 1 },
    raci: { r: ["sam-tan"], a: "maya-okonkwo", c: ["priya-rao"], i: [] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "revise", headline: "Hold the current threshold; the evidence base disagrees with itself.", rationale: "Three of four evidence sources on this threshold conflict with each other. Ship nothing until the eval and the production sample agree." },
    evidence: [
      { kind: "eval", title: "Offline eval suite", note: "Threshold 0.62 scores highest on the offline eval.", claim: "confirmed" },
      { kind: "conflict", title: "Production sample review", note: "Live traffic shows 0.62 over-routes 1-in-6 chats to the wrong queue.", claim: "contradicts" },
      { kind: "conflict", title: "Prior threshold study (Aug)", note: "An earlier study recommended 0.71, not 0.62.", claim: "contradicts" },
      { kind: "conflict", title: "QA spot-check", note: "QA sampling disagreed with both the offline eval and the production sample.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 34, total: 40 }, coverage: { linked: 4, total: 4 }, mostRecentAt: "2026-09-06T12:00:00" },
    groundTruth: {
      decisionClass: "model-version", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      recommendationGold: "Correctly flags internal disagreement; confidence should read as LOW because 3 of 4 sources contradict, even though the eval pass rate alone looks fine.",
      tags: ["adversarial", "contradictory-evidence", "confidence-calibration"]
    }
  },

  {
    id: "adv-stale-evidence", source: "adversarial",
    title: "Keep the refund-eligibility rule as last validated?",
    agentId: "evidence-steward", type: "decision",
    one_liner: "The last check was perfect -- and 45 days old, predating two policy updates.",
    impact: { value: 64, unblock: 30, reach: 60, urgency: 58 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$1.7k/wk", weeklyDollars: 1700, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 1, reachPerWeek: 1900, urgencyKind: "gate-window" },
    metrics: { headline: "$1.7k/wk projected", kpi: "unchanged — validation is stale", reach: "~1,900 refund-eligibility checks/week", blocksToday: 1 },
    raci: { r: ["priya-rao"], a: "maya-okonkwo", c: [], i: ["nadia-chen"] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "revise", headline: "Re-validate before relying on this further; the last check is 45 days old.", rationale: "The eligibility rule passed cleanly, but that run predates two policy updates. Confidence in an old, otherwise-perfect result should not read the same as a fresh one." },
    evidence: [{ kind: "eval", title: "Refund-eligibility rule validation", note: "100 of 100 cases passed.", claim: "confirmed" }],
    // 46 days before PL.today.nowIso (2026-09-07) — lands in the "stale" recency band (>30 days).
    confidenceInputs: { eval: { passed: 100, total: 100 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-07-23T00:00:00" },
    groundTruth: {
      decisionClass: "data-access", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      recommendationGold: "A perfect-looking eval result that is 45+ days old should show materially lower confidence than an equally perfect fresh result — recency must visibly drag the score down.",
      tags: ["adversarial", "stale-evidence", "confidence-calibration"]
    }
  },

  {
    id: "adv-zero-evidence", source: "adversarial",
    title: "Let Atlas apply loyalty-point adjustments automatically?",
    agentId: "evidence-steward",
    // Deliberately shipped informative with zero grounding — a distinct failure mode from the
    // commitment-mislabeled case above: here nothing is "wrong" per se, there's simply nothing
    // backing the claim at all, and that absence is itself what should have triggered escalation.
    type: "informative",
    one_liner: "Loyalty adjustment logic ships as configured -- advancing on its own.",
    impact: { value: 44, unblock: 14, reach: 52, urgency: 34 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$900/wk", weeklyDollars: 900, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 0, reachPerWeek: 700, urgencyKind: "scheduled" },
    metrics: { headline: "$900/wk projected", kpi: "unverified — no eval run", reach: "~700 loyalty adjustments/week", blocksToday: 0 },
    raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
    autoIn: "advances in 2h",
    recommendation: { choice: "approve", headline: "Advancing — loyalty adjustment logic ships as configured.", rationale: "" },
    evidence: [],
    confidenceInputs: { eval: { passed: 0, total: 0 }, coverage: { linked: 0, total: 0 }, mostRecentAt: "2026-09-07T09:00:00" },
    groundTruth: {
      decisionClass: "action-scope", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      recommendationGold: "Zero evidence and zero eval coverage for a new autonomous money-adjustment action is itself grounds to escalate — the absence of grounding is the signal, and this should never have auto-advanced.",
      tags: ["adversarial", "zero-evidence", "grounding", "guard-test"]
    }
  },

  {
    id: "adv-neartie-a", source: "adversarial",
    title: "Add a proactive delay-notification for delayed shipments?",
    agentId: "dependency-tracker", type: "decision",
    one_liner: "Cuts a large share of reactive 'where is my order' contacts at low risk.",
    impact: { value: 52, unblock: 60, reach: 68, urgency: 64 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$1.3k/wk", weeklyDollars: 1300, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 2, reachPerWeek: 3100, urgencyKind: "gate-window" },
    metrics: { headline: "$1.3k/wk projected", kpi: "-12% 'where is my order' contacts", reach: "~3,100 delayed shipments/week", blocksToday: 2 },
    raci: { r: ["andrew-aasen"], a: "maya-okonkwo", c: [], i: ["nadia-chen"] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "approve", headline: "Approve proactive delay notifications.", rationale: "Cuts a large share of reactive 'where is my order' contacts at low risk." },
    evidence: [{ kind: "eval", title: "Delay-notification pilot", note: "41 of 44 test notifications sent correctly.", claim: "observed" }],
    confidenceInputs: { eval: { passed: 41, total: 44 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-05T00:00:00" },
    groundTruth: {
      decisionClass: "content", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      panelRankNote: "Panel ranked adv-neartie-b above this scenario despite this one's marginally higher composite score.",
      recommendationGold: "Approve.",
      tags: ["adversarial", "near-tie", "ranking-stress"]
    }
  },

  {
    id: "adv-neartie-b", source: "adversarial",
    title: "Add a proactive fraud-hold notification before canceling a suspicious order?",
    agentId: "risk-sentinel", type: "decision",
    one_liner: "Reduces wrongful-cancellation complaints on flagged orders.",
    impact: { value: 50, unblock: 58, reach: 52, urgency: 60 },
    signals: { valueKind: "revenue-at-risk", dollarsDisplay: "$1.25k/wk", weeklyDollars: 1250, dollarsKind: "at-risk", commitmentAtStake: false, blocksToday: 2, reachPerWeek: 900, urgencyKind: "gate-window" },
    metrics: { headline: "$1.25k/wk at risk", kpi: "prevents wrongful cancellations", reach: "~900 fraud-hold cases/week", blocksToday: 2 },
    raci: { r: ["sam-tan"], a: "maya-okonkwo", c: ["legal"], i: [] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "approve", headline: "Approve fraud-hold notifications.", rationale: "Reduces wrongful-cancellation complaints on flagged orders." },
    evidence: [
      { kind: "eval", title: "Fraud-hold notification pilot", note: "27 of 30 test notifications sent correctly.", claim: "observed" },
      { kind: "doc", title: "Fraud policy v1.4", note: "Notification before cancellation is consistent with the customer-communication standard.", claim: "confirmed" }
    ],
    confidenceInputs: { eval: { passed: 27, total: 30 }, coverage: { linked: 2, total: 2 }, mostRecentAt: "2026-09-04T00:00:00" },
    groundTruth: {
      decisionClass: "content", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      panelRankNote: "Panel ranked this above adv-neartie-a: preventing a wrongful fraud-driven cancellation is a trust/compliance-adjacent harm that the four generic sub-scores under-weight relative to a plain revenue-opportunity item of similar size.",
      recommendationGold: "Approve — and note the panel considers this higher-priority than its composite score alone suggests.",
      tags: ["adversarial", "near-tie", "ranking-stress", "qualitative-override"]
    }
  },

  {
    id: "adv-dollars-only-baseline-trap", source: "adversarial",
    title: "Add a premium-warranty upsell prompt after every resolved repair chat?",
    agentId: "impact-analyst", type: "decision",
    one_liner: "The dollar figure assumes full-volume attach -- the actual sample is small and nothing blocks today's build.",
    // Largest weekly-dollar figure in the entire bank, on purpose — this is what a naive
    // dollars-only baseline would rank #1. Low unblock/reach/urgency should demote it under the
    // real composite, demonstrating the composite adds value over a dollars-first ranking.
    impact: { value: 84, unblock: 12, reach: 30, urgency: 16 },
    signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$5.2k/wk", weeklyDollars: 5200, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 0, reachPerWeek: 250, urgencyKind: "low" },
    metrics: { headline: "$5.2k/wk projected (if it scales)", kpi: "attach rate unproven at this volume", reach: "~250 repair chats/week", blocksToday: 0 },
    raci: { r: ["andrew-aasen"], a: "maya-okonkwo", c: ["nadia-chen"], i: [] },
    delegateTo: "nadia-chen", severity: "Open question",
    recommendation: { choice: "revise", headline: "Pilot on a small share of repair chats before committing to the full prompt.", rationale: "The dollar figure assumes full-volume attach, but the sample is only 250 chats/week and nothing blocks today's build on this. Worth doing, not worth jumping the queue for." },
    evidence: [{ kind: "eval", title: "Warranty-upsell A/B (small sample)", note: "18% attach rate on 40 test chats — promising but unproven at scale.", claim: "observed" }],
    confidenceInputs: { eval: { passed: 7, total: 40 }, coverage: { linked: 1, total: 1 }, mostRecentAt: "2026-09-06T00:00:00" },
    groundTruth: {
      decisionClass: "content", isDecisionTruth: true, correctOwnerId: "maya-okonkwo", readinessVerdict: null, panelRank: null,
      recommendationGold: "A naive dollars-only ranking would put this near the top of the whole bank; the composite correctly demotes it because reach is narrow, nothing is blocked today, and there's no urgency — this is the scenario that proves the composite adds value over a dollars-first baseline.",
      tags: ["adversarial", "dollars-only-baseline", "ranking-validity"]
    }
  },

  {
    id: "adv-wrong-owner-authored", source: "adversarial",
    title: "Allow Atlas to auto-redact and forward chats flagged for potential PII exposure?",
    agentId: "evidence-steward", type: "decision",
    one_liner: "Compliance-critical redaction automation, authored to engineering rather than Legal.",
    impact: { value: 85, unblock: 60, reach: 48, urgency: 90 },
    signals: { valueKind: "unblocks-work", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: true, blocksToday: 2, reachPerWeek: 500, urgencyKind: "commitment-breaking" },
    metrics: { headline: "compliance-critical", kpi: "PII-exposure incident rate", reach: "~500 flagged chats/week", blocksToday: 2 },
    // Authored RACI deliberately under-routes this: engineering (sam-tan) is BOTH responsible
    // and accountable; Legal is only informed, not consulted or accountable.
    raci: { r: ["sam-tan"], a: "sam-tan", c: [], i: ["maya-okonkwo", "legal"] },
    delegateTo: "nadia-chen", severity: "High consequence",
    recommendation: { choice: "approve", headline: "Approve auto-redaction and forwarding.", rationale: "Reduces manual review backlog for flagged chats." },
    evidence: [
      { kind: "doc", title: "Data privacy policy v2.0", note: "Any PII-exposure remediation requires Legal sign-off before automation.", claim: "confirmed" },
      { kind: "eval", title: "Auto-redaction accuracy eval", note: "91 of 96 flagged chats redacted correctly.", claim: "observed" },
      { kind: "conflict", title: "Redaction miss sample", note: "5 of 96 chats had PII the redaction missed.", claim: "contradicts" }
    ],
    confidenceInputs: { eval: { passed: 91, total: 96 }, coverage: { linked: 3, total: 3 }, mostRecentAt: "2026-09-06T00:00:00" },
    groundTruth: {
      decisionClass: "data-access", isDecisionTruth: true, correctOwnerId: "legal", readinessVerdict: null, panelRank: null,
      expectedRoutingMismatch: { authoredOwnerId: "sam-tan", authoredInformedOnly: ["maya-okonkwo", "legal"], correctOwnerId: "legal" },
      recommendationGold: "The accountable owner for a PII-exposure/compliance remediation should be Legal & Risk, not engineering — the authored RACI under-routes a compliance-critical decision to the build team, with Legal merely informed instead of accountable.",
      tags: ["adversarial", "wrong-owner", "raci-routing", "compliance"]
    }
  }
];

module.exports = { anchorGroundTruth, newScenarios };
