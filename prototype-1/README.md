# ProofLoop interactive prototype

A dependency-free, responsive prototype built from the ProofLoop V2 PRD. It demonstrates the capstone MVP's complete decision loop: detecting a build change, mapping its impact to confirmed project goals, running autonomous evidence work, applying an escalation gate, delivering a stakeholder-specific recommendation, and recording the decision.

## Run

Open `index.html` directly in a browser, or serve the folder locally:

```bash
python3 -m http.server 4173 --directory prototype-1
```

Then visit `http://localhost:4173`.

## Key interactions

- Select **Review brief** from the Overview.
- Inspect the recommendation, evaluation evidence, affected goals, and escalation reason.
- Choose **Approve with guardrail**, **Request revision**, or **Reject change**.
- Expand the requirement-to-evidence trace.
- Browse the Evidence map and Decision memory.
- Use **Add evidence** to exercise the manual upload interaction.

All content is synthetic. The prototype does not upload files or call a backend.
