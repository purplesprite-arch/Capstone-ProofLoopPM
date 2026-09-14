/* ProofLoop Prototype 2 — synthetic data.
   Loaded as a plain global (window.PL) BEFORE render.js and app.js.
   No modules / no imports, so the app opens straight from file:// on a double-click.
   All content is fictional and safe to demo. */

window.PL = {
  workspace: { name: "Atlas Voice AI", context: "Customer support agents", env: "Shadow mode", synced: "2 min ago" },

  // The person opening this on their phone in the morning: the accountable exec.
  user: { id: "maya-okonkwo", name: "Maya Okonkwo", role: "Chief Delivery Officer", initials: "MO" },
  today: { label: "Monday, September 7", greetingName: "Maya" },

  // Impact Score weights. score = 0.35·value + 0.30·unblock + 0.20·reach + 0.15·urgency
  weights: { value: 0.35, unblock: 0.30, reach: 0.20, urgency: 0.15 },
  weightMeta: {
    value:   { label: "Production value", hint: "KPI or revenue at stake in production" },
    unblock: { label: "Unblocks today",   hint: "How much of today's build this clears" },
    reach:   { label: "Reach",            hint: "Users or volume affected" },
    urgency: { label: "Urgency",          hint: "Time until a gate or window closes" }
  },

  // Time-available gate: asked once per open (never persisted). Drives how much of
  // the Today view surfaces — see timeAvailable branching in render.js's today().
  timeModes: [
    { id: "zero",   label: "Zero Time",     tagline: "You're lucky I got the app open — I have time for one decision, max." },
    { id: "little", label: "Little Time",    tagline: "I want to help with decisions, but I don't have all the time in the world." },
    { id: "lots",   label: "Lots of Time",   tagline: "I surprisingly have lots of time right now — let's dive deep into multiple decisions and their effects." }
  ],

  // People referenced across RACI strips.
  people: {
    "maya-okonkwo": { name: "Maya Okonkwo", short: "You",         initials: "MO", role: "Chief Delivery Officer" },
    "nadia-chen":   { name: "Nadia Chen",   short: "Nadia Chen",  initials: "NC", role: "Product owner" },
    "andrew-aasen": { name: "Andrew Aasen", short: "Andrew Aasen",initials: "AA", role: "Delivery lead" },
    "priya-rao":    { name: "Priya Rao",    short: "Priya Rao",   initials: "PR", role: "Eval & QA lead" },
    "sam-tan":      { name: "Sam Tan",      short: "Sam Tan",     initials: "ST", role: "Engineering lead" },
    "legal":        { name: "Risk & Legal", short: "Risk & Legal",initials: "RL", role: "Compliance" }
  },

  // The delivery crew. Most stay behind the scenes; only escalated agents appear in the briefing.
  agents: [
    { id: "chief-of-staff",     name: "Chief of Staff",          icon: "compass",  status: "orchestrating",
      monitors: "Routing, RACI, the day's plan",
      finding: "Assembled today's briefing — routed 3 to you, 4 advancing on their own." },
    { id: "impact-analyst",     name: "Impact Analyst",          icon: "gauge",    status: "watching",
      monitors: "Feature-level ROI and ranking",
      finding: "Scored 7 changes. Escalation v2.4 ranks #1 at 85." },
    { id: "eval-runner",        name: "Eval Runner",             icon: "pulse",    status: "watching",
      monitors: "Eval suite on every build change",
      finding: "Ran 24 escalation scenarios — 23 passed, 1 regression." },
    { id: "evidence-steward",   name: "Evidence Steward",        icon: "nodes",    status: "watching",
      monitors: "Requirement-to-evidence coverage",
      finding: "47 of 47 claims source-linked. 1 coverage gap open." },
    { id: "requirements-analyst",name: "Requirements Analyst",   icon: "file",     status: "watching",
      monitors: "SOW & PRD to testable behavior",
      finding: "Turned v2.4 release notes into 6 acceptance checks." },
    { id: "risk-sentinel",      name: "Risk & Compliance Sentinel", icon: "shield", status: "escalated",
      monitors: "Guardrails, grounding, scope, policy",
      finding: "1 case handed off at 47s — over the 30-second customer promise.",
      escalatedTo: "d-escalation" },
    { id: "rollout-manager",    name: "Rollout Manager",         icon: "rocket",   status: "escalated",
      monitors: "Go/no-go readiness and pilot health",
      finding: "Billing Resolution Agent reached go/no-go readiness.",
      escalatedTo: "d-billing-golive" },
    { id: "dependency-tracker", name: "Dependency Tracker",      icon: "layers",   status: "escalated",
      monitors: "Blockers, open questions, false progress",
      finding: "Repeat-escalation threshold still undefined — blocks 3 tasks.",
      escalatedTo: "d-repeat-threshold" }
  ],

  /* Decisions. type "decision" = needs the exec; type "informative" = advancing on its own.
     impact sub-scores are 0–100; the composite is computed live so the breakdown is honest.
     raci.a is the single accountable decider; delegateTo is who inherits it if downgraded to informative. */
  decisions: [
    {
      id: "d-escalation",
      title: "Escalation response v2.4",
      agentId: "risk-sentinel",
      type: "decision",
      one_liner: "A friendlier retry can push human handoff past the promised 30 seconds.",
      impact: { value: 84, unblock: 88, reach: 76, urgency: 90 },
      // Observable signals behind the sub-scores. The rubric (render.js) maps these to a band;
      // each authored sub-score sits inside the band its signals imply — provenance, not recomputation.
      signals: { valueKind: "revenue-at-risk", dollarsDisplay: "$3.2k/wk", weeklyDollars: 3200, dollarsKind: "at-risk", commitmentAtStake: true, blocksToday: 4, reachPerWeek: 1900, urgencyKind: "commitment-breaking" },
      metrics: { headline: "$3.2k/wk at risk", kpi: "+3.2 pt containment", reach: "~1,900 tier-1 chats / week", blocksToday: 4 },
      raci: { r: ["andrew-aasen", "priya-rao"], a: "maya-okonkwo", c: ["nadia-chen"], i: ["legal"] },
      delegateTo: "nadia-chen",
      severity: "High consequence",
      recommendation: {
        choice: "approve",
        headline: "Approve with a 30-second handoff guardrail.",
        rationale: "v2.4 improves escalation clarity in 23 of 24 scenarios. One edge case delays human transfer past the promise. A hard 30-second timeout keeps the clarity gains without breaking the commitment.",
        confidence: 92
      },
      diff: {
        before: "I'm connecting you with a specialist now.",
        after: "I want to get this right. Let me try one more step before I connect you.",
        source: "Release notes v2.4 · prompt policy line 148"
      },
      goals: [
        { title: "Human handoff within 30 seconds", note: "1 of 24 tests exceeded the limit by 17 seconds.", dir: "risk" },
        { title: "Contain 65% of tier-1 requests", note: "Projected containment improves 3.2 points.", dir: "up" },
        { title: "No unsupported policy claims", note: "New wording stays grounded in the approved knowledge base.", dir: "flat" }
      ],
      evidence: [
        { kind: "doc",      title: "Atlas Voice AI — product requirements", note: "AC-14 · escalate within 30 seconds after a second failed attempt.", claim: "confirmed" },
        { kind: "eval",     title: "Escalation regression suite", note: "23 of 24 cases passed · run Sep 7, 09:42.", claim: "observed" },
        { kind: "conflict", title: "Release v2.4 test result", note: "1 case transferred at 47 seconds under identity uncertainty.", claim: "contradicts" },
        { kind: "decision", title: "Decision DL-007", note: "Nadia confirmed this promise is externally committed.", claim: "confirmed" }
      ],
      trace: [
        { label: "Confirmed fact", body: "PRD acceptance criterion AC-14 sets a 30-second maximum." },
        { label: "Observed result", body: "Evaluation EV-024 recorded a 47-second handoff." },
        { label: "Inference", body: "A hard timeout preserves the commitment without losing the clarity gains." }
      ],
      gate: "This change touches a confirmed external commitment. ProofLoop can test and recommend, but only an accountable owner can authorize a release condition.",
      openedMinsAgo: 18
    },

    {
      id: "d-billing-golive",
      title: "Billing Resolution Agent — pilot go/no-go",
      agentId: "rollout-manager",
      type: "decision",
      one_liner: "Evidence supports a limited launch. Approve the pilot plan or hold.",
      impact: { value: 90, unblock: 60, reach: 82, urgency: 64 },
      signals: { valueKind: "revenue-opportunity", dollarsDisplay: "$18k/mo", weeklyDollars: 4150, dollarsKind: "opportunity", commitmentAtStake: false, blocksToday: 2, reachPerWeek: 9000, urgencyKind: "gate-window" },
      metrics: { headline: "$18k/mo projected", kpi: "+17 pt deflection", reach: "billing queue · ~9k chats / week", blocksToday: 2 },
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

    {
      id: "d-repeat-threshold",
      title: "Repeat-escalation threshold",
      agentId: "dependency-tracker",
      type: "decision",
      one_liner: "No agreed limit on repeat escalations. Three build tasks are waiting on it.",
      impact: { value: 58, unblock: 74, reach: 55, urgency: 58 },
      signals: { valueKind: "unblocks-work", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 3, reachPerWeek: null, urgencyKind: "gate-window" },
      metrics: { headline: "unblocks 3 tasks", kpi: "closes 1 evidence gap", reach: "all escalation paths", blocksToday: 3 },
      raci: { r: ["priya-rao"], a: "maya-okonkwo", c: ["nadia-chen", "sam-tan"], i: [] },
      delegateTo: "nadia-chen",
      severity: "Open question",
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
      trace: [
        { label: "Observed result", body: "Resolution rate drops sharply after the second attempt." },
        { label: "Inference", body: "A cap of 2 balances containment against customer frustration." }
      ],
      gate: "This defines a behavioral limit that will govern every escalation path, so it needs an accountable owner before the routing work can proceed.",
      openedMinsAgo: 65
    },

    {
      id: "d-intent-routing",
      title: "Intent routing patch v1.3",
      agentId: "eval-runner",
      type: "informative",
      one_liner: "Classifier update passed every check and stayed within policy.",
      impact: { value: 42, unblock: 36, reach: 60, urgency: 40 },
      signals: { valueKind: "accuracy-gain", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
      metrics: { headline: "no goals at risk", kpi: "+1.1 pt routing accuracy", reach: "all inbound intents", blocksToday: 0 },
      raci: { r: ["sam-tan"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 2h",
      recommendation: { choice: "approve", headline: "Advancing under approved routing policy.", rationale: "", confidence: 96 }
    },
    {
      id: "d-refund-knowledge",
      title: "Billing refund knowledge update",
      agentId: "evidence-steward",
      type: "informative",
      one_liner: "New refund examples added and fully source-linked.",
      impact: { value: 35, unblock: 30, reach: 52, urgency: 34 },
      signals: { valueKind: "content", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "scheduled" },
      metrics: { headline: "100% sourced", kpi: "12 examples added", reach: "billing responses", blocksToday: 0 },
      raci: { r: ["priya-rao"], a: "nadia-chen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 4h",
      recommendation: { choice: "approve", headline: "Advancing — grounded in approved sources.", rationale: "", confidence: 94 }
    },
    {
      id: "d-tone-tweak",
      title: "Tone & style refinement",
      agentId: "requirements-analyst",
      type: "informative",
      one_liner: "Warmer phrasing, no change to policy or claims.",
      impact: { value: 28, unblock: 22, reach: 48, urgency: 26 },
      signals: { valueKind: "cosmetic", dollarsDisplay: null, weeklyDollars: null, dollarsKind: null, commitmentAtStake: false, blocksToday: 0, reachPerWeek: null, urgencyKind: "low" },
      metrics: { headline: "cosmetic", kpi: "neutral", reach: "all responses", blocksToday: 0 },
      raci: { r: ["andrew-aasen"], a: "andrew-aasen", c: [], i: ["maya-okonkwo"] },
      autoIn: "advances in 6h",
      recommendation: { choice: "approve", headline: "Advancing — no behavioral change.", rationale: "", confidence: 91 }
    }
  ],

  // Second agent's rollout package: the go/no-go value showcase + the pilot plan the Rollout Manager drafted.
  rollout: {
    agentId: "billing-resolver",
    agentName: "Billing Resolution Agent",
    subtitle: "6 weeks in shadow mode · benchmarked against the human baseline",
    confidence: 87,
    dollarsSaved: "$18k / month",
    dollarsNote: "projected at full rollout",
    kpis: [
      { label: "Ticket deflection", before: 41, after: 58, unit: "%",   delta: "+17 pt", dir: "up" },
      { label: "Avg handle time",   before: 6.4, after: 3.9, unit: "min", delta: "−2.5 min", dir: "up" },
      { label: "CSAT",              before: 4.2, after: 4.4, unit: "/5",  delta: "+0.2", dir: "up" },
      { label: "Escalations",       before: 22, after: 14, unit: "%",   delta: "−8 pt", dir: "up" }
    ],
    evidence: [
      { kind: "eval", title: "Pre-launch eval battery", note: "412 billing scenarios · 94% resolved correctly.", claim: "observed" },
      { kind: "doc",  title: "Refund policy grounding", note: "All refund logic linked to approved policy v2.1.", claim: "confirmed" },
      { kind: "eval", title: "Shadow-mode comparison", note: "Beat human baseline on 3 of 4 KPIs over 6 weeks.", claim: "observed" }
    ],
    designedBy: "rollout-manager",
    cohorts: [
      { pct: "5%",  label: "Internal & low-risk queues", status: "proposed", gate: "CSAT ≥ 4.3 across 200 chats", window: "Week 1" },
      { pct: "25%", label: "Tier-1 billing",             status: "locked",   gate: "Deflection ≥ 50%",           window: "Week 2–3" },
      { pct: "100%",label: "All billing traffic",        status: "locked",   gate: "No SEV-1 incident for 72h",  window: "Week 4" }
    ],
    guardrails: [
      "No refund over $50 without a human approval",
      "Answers grounded to the approved knowledge base only",
      "Any legal or dispute language hands off immediately"
    ],
    rollbackTriggers: [
      "CSAT drops more than 3 points within a cohort",
      "Hallucination rate exceeds 0.5%",
      "Escalation volume rises above the human baseline"
    ]
  },

  // Evidence map: goals → requirements tree + a detail for the selected node.
  evidenceMap: {
    tree: [
      { id: "cost", label: "Reduce service operating cost", meta: "Business outcome · SOW §2.1", dot: "business", count: 5, open: true,
        children: [
          { id: "handoff", label: "Human escalation within 30 sec", meta: "Confirmed requirement · PRD AC-14", dot: "requirement", count: 4, selected: true },
          { id: "contain", label: "Contain 65% of tier-1 requests", meta: "Confirmed KPI · SOW §2.3", dot: "requirement", count: 6 }
        ] },
      { id: "trust", label: "Maintain customer trust", meta: "Business outcome · OKR 3", dot: "business", count: 8 },
      { id: "safety", label: "Safety & compliance controls", meta: "Risk controls · Policy v1.7", dot: "risk", count: 9 }
    ],
    detail: {
      badge: "Confirmed requirement",
      title: "Human escalation within 30 seconds",
      body: "When the agent detects a high-risk intent or fails twice, it must transfer the customer to a human queue within 30 seconds.",
      owner: "Nadia Chen", confidence: "High · 96%", verified: "Sep 7, 2026",
      sources: [
        { kind: "doc",      title: "Atlas Voice AI — product requirements", note: "AC-14 · escalate within 30 seconds after a second failed attempt.", claim: "confirmed" },
        { kind: "eval",     title: "Escalation regression suite", note: "23 of 24 cases passed · run Sep 7, 09:42.", claim: "observed" },
        { kind: "conflict", title: "Release v2.4 test result", note: "1 case transferred at 47 seconds under identity uncertainty.", claim: "contradicts" },
        { kind: "decision", title: "Decision DL-007", note: "Nadia confirmed this promise is externally committed.", claim: "confirmed" }
      ]
    }
  },

  // Seed decision-memory timeline. Resolved decisions get prepended here at runtime.
  memory: [
    { day: "Today", items: [
      { icon: "pulse", title: "Autonomous evaluation completed", body: "Ran 24 escalation scenarios and found one requirement conflict.", meta: "11:38 AM · escalation regression suite" },
      { icon: "git-branch", title: "Build change detected", body: "Prompt policy updated from v2.3 to v2.4.", meta: "11:24 AM · GitHub release log" }
    ] },
    { day: "September 6", items: [
      { icon: "check", tone: "approved", title: "Decision DL-008 approved", body: "Intent routing patch advanced with no added conditions.", meta: "4:18 PM · resolved in 2m 14s", status: "Approved" }
    ] }
  ]
};
