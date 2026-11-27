# Propagation walkthrough update

## Changes

- Optional animation after Run; replay without reevaluating.
- Source initialization, directional moving edge dashes, and convergence aggregation.
- Play/pause, manual previous/next, speed, restart, and skip to final results.
- Backend result trace: no changes to the GBBRPM engine or numeric calculations.
- Step panel with the actual returned `S`, `tau`, `R_source`, `Q`, `B`, and risk.
- Final ranking hidden until the walkthrough finishes or is skipped.
- Stable graph instance while results and parameters update.
- Inspector shows actual backend susceptibility, including explicit imported `S`.
- Imported `S` can be edited without adding fake `L`/`C` fields.
- Node inspector includes incoming contributions and the aggregation formula.
- Ranking selection also selects and centers the graph node.
- Inspector remains available on narrow screens.
- Reduced-motion support; parameter edits and dataset changes cancel playback.
- Resizable step panel: VS Code-style drag grip on the top edge, focusable
  separator with arrow/Home/End keys, double-click reset, maximize chevron, and
  a height remembered in local storage. The panel is bottom-anchored and
  stretches upward until it covers the whole graph area like the VS Code
  terminal covers the editor; the graph collapses to nothing and Cytoscape
  reflows through the existing `ResizeObserver`, which now skips zero-height
  containers.

## Applying the update

Copy the contents of this folder into your existing project, replacing matching
source files. Keep your existing `.git`, backend `.venv`, frontend `node_modules`,
and local environment settings. No dependency changes are required. Restart both
servers; a frontend-only update will not receive the new backend trace.

Use **Animate evaluation after Run**, then **Run model**. Use **Next** for a
manual consultation walkthrough. Animation is calculation order, not physical
time. Independent branches advance in parallel on a continuous clock with live
panel values. The project
title has not been changed; resolve the manuscript's Blockage/Bounded naming
separately before renaming the prototype.

## Verification

- Backend: 9 tests passed, including the frozen N5 outlet risk and deterministic
  traces for every N1–N5 network.
- Frontend: 26 tests passed, covering saved-scenario compatibility, playback
  state, convergence reveal order, calculation-panel values, and panel-height
  clamping and persistence.
- Production TypeScript/Vite build: passed. Vite reports a non-blocking bundle
  size warning (main JavaScript chunk approximately 639 kB).
- Tests used the exact GBBRPM engine bundled in the uploaded Windows environment,
  with fresh Linux test dependencies. Your Windows virtual environment was not
  modified or executed.
- Browser visual/end-to-end verification was not completed: no local browser
  was installed and the browser download failed. Manual verification is still
  needed for graph motion, selection centering, and responsive layout.

## Quick manual check

1. Load N1; enable animation; Run. Pause and step forward/backward.
2. Skip to results; compare the ranking with animation disabled.
3. Load a converging network; confirm all incoming Q steps precede aggregation.
4. Replay, edit a parameter, and confirm playback stops and results become stale.
5. Import `examples/imported-network.json`; select an edge and verify explicit S.
6. Set OS/browser reduced motion; replay should start paused without moving dashes.
7. Check laptop and phone widths; inspector and playback controls should remain accessible.

The archive excludes dependencies, build output, caches, and Git history. It is
a source update, not a replacement for your local development environment.
