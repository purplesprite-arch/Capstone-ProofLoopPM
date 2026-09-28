/* ProofLoop AI Eval — Node engine loader.
   Loads the REAL prototype-2 scoring engines into Node via a minimal window shim, so every
   number this eval computes reuses the exact functions the shipped app runs at runtime —
   never a parallel reimplementation that could quietly drift from prototype-2/render.js.

   Mechanics (verified against the actual source, not assumed):
     - prototype-2/data.js line 6 does `window.PL = {...}` — a bare global assignment, no
       IIFE, no module wrapper. In Node's CommonJS module wrapper, an undeclared bare
       identifier (`window`) falls through to the outer scope, so setting `global.window`
       before requiring the file makes `window` resolve there.
     - prototype-2/render.js is an IIFE: `(function () { const PL = window.PL; ...
       window.PLRender = {...}; })();`. It reads window.PL at call time and writes
       window.PLRender at the bottom — so data.js MUST load first.
     - prototype-2/app.js is NOT loaded here. It expects a live DOM (document, location,
       history, window.localStorage) that this harness doesn't provide, and the eval has no
       need to execute it — only to read its source text (see `source.app` below) for the
       integrity linter's static checks (e.g. the dead [data-score] handler, the absent
       commitmentAtStake guardrail).

   Nothing in prototype-2/ is modified by this file or by anything that calls it. */

const path = require("path");
const fs = require("fs");

function loadEngines() {
  const dataPath = path.join(__dirname, "..", "prototype-2", "data.js");
  const renderPath = path.join(__dirname, "..", "prototype-2", "render.js");
  const appPath = path.join(__dirname, "..", "prototype-2", "app.js");

  // Fresh window per call, and bust the require cache for the two files we execute — Node
  // caches modules by resolved path, so without this a second loadEngines() call in the same
  // process would silently reuse the FIRST call's window.PL/window.PLRender instead of
  // re-running data.js/render.js against the fresh window object above.
  global.window = {};
  delete require.cache[require.resolve(dataPath)];
  delete require.cache[require.resolve(renderPath)];

  require(dataPath);
  require(renderPath);

  const PL = global.window.PL;
  const PLRender = global.window.PLRender;
  if (!PL || !PLRender) {
    throw new Error(
      "Window shim failed — expected window.PL and window.PLRender after loading " +
      "prototype-2/data.js then prototype-2/render.js. Check load order and that neither " +
      "file's structure has changed (e.g. window.PL assignment, or the render.js IIFE)."
    );
  }

  // Raw source text of all three prototype-2 files — used by the Tier 1 integrity linter for
  // checks that are about the SOURCE (a dead click handler, a missing guardrail reference, a
  // stale comment), not about computed output. Read once here so eval/run.js never re-reads
  // prototype-2/ directly.
  const source = {
    data: fs.readFileSync(dataPath, "utf8"),
    render: fs.readFileSync(renderPath, "utf8"),
    app: fs.readFileSync(appPath, "utf8")
  };

  return { PL, PLRender, source, paths: { dataPath, renderPath, appPath } };
}

module.exports = { loadEngines };
