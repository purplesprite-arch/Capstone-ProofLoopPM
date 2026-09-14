# Resume here — ProofLoop

_Last session: reorganized the repo (see [README](README.md)) and reviewed Prototype 2 end to end._

## Status

**Prototype 2 is the current build** and is in good shape at the code level: clean
`data → render → app` split, the Impact Score is computed live (re-ranking is real, not faked),
event delegation keeps interactions robust, and it serves cleanly (`200 OK`). It has **not** yet
been seen rendered on a real phone — that's the first thing tomorrow.

## Step 1 tomorrow — serve it & test on your phone

From the `Capstone/` folder:

```bash
python3 -m http.server 4173 --directory prototype-2
```

- On the **phone** (same Wi-Fi as the Mac), open: `http://<mac-lan-ip>:4173`
  - Get the current IP: `ipconfig getifaddr en0` (yesterday it was `192.168.1.125`, but DHCP can change it).
- macOS may pop a firewall prompt the first time — **Allow** incoming connections.
- Best at phone width. Walk the 2-minute script in [prototype-2/README.md](prototype-2/README.md#L21).

## Best first task (easiest + most impactful)

**Do the phone test above first.** It's the cheapest validation and it *generates* the real
backlog — you can't prioritize polish you haven't seen. Fix whatever visibly breaks on-device
(tap-target sizes, the score gauge, the mobile bottom-sheet modal, animations).

**Most impactful substantive change, once it's validated:** ground the **Impact Score inputs**
(see skepticism below). Everything else is polish; this is the credibility gap.

## What I'm most skeptical about / least confident about

- **Most skeptical (product):** the Impact Score's *inputs*. The demo shows honest arithmetic
  (`sub × weight = contribution`) and live re-ranking — but the four sub-scores per decision
  (`value: 84, unblock: 88, …` in [data.js](prototype-2/data.js#L73)) are hand-authored magic
  numbers with no visible provenance, and the confidence % is asserted, not computed. Deriving
  those reliably from a real build change is the hard, unsolved part of the whole thesis. A
  skeptical evaluator will ask "how does the agent get `value = 84`?" — and today there's no
  answer. This is the biggest gap between the demo's polish and the product's believability.
- **Least confident (my own blind spot):** I judged "looks good" from the *code*, not from
  pixels — I never saw it rendered. The 574-line stylesheet, responsive breakpoints, the mobile
  modal-as-bottom-sheet, and the gauge visuals are all unverified by eye. That's exactly why the
  phone test is Step 1.

## Small backlog found during review (nice-to-haves, not blockers)

- **Accessibility:** the agent chip is a clickable `<span>` ([render.js:86](prototype-2/render.js#L86)),
  so it isn't keyboard-focusable; the modal doesn't trap focus or restore it on close
  ([app.js:211](prototype-2/app.js#L211)). Easy wins for a portfolio piece.
- **Dead code:** `billingDecision()` / the `decisionFor` fallback ([app.js:19](prototype-2/app.js#L19),
  [app.js:37](prototype-2/app.js#L37)) is redundant — `d-billing-golive` is already in `PL.decisions`.
- **Prototype 1's `styles.css` is minified** onto 5 lines — un-minify if you ever edit P1 again.
- **Offline demos:** fonts load from Google Fonts; they fall back gracefully if the phone is offline.
