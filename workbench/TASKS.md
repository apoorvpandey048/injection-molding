# Tasks — Component Mapping Workbench

Task board for the workbench. Every feature moves Backlog → In Progress →
Completed (or Blocked). See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for
phase detail.

## Backlog

Future enhancements — not required by the current spec, captured for visibility.

- [ ] Box / lasso multi-select directly in the 3D view.
- [ ] Undo / redo stack for assignment actions.
- [ ] Material-driven auto-suggest (e.g. propose Heaters for heater-band materials).
- [ ] Per-subsystem visibility toggles (solo / mute a subsystem).
- [ ] Saved review sessions (named snapshots beyond the single localStorage state).
- [ ] Measurement / dimension readout for selected geometry.
- [ ] GLB consumption path so the same map binds to the twin's compressed model.

## In Progress

- _(none — all planned phases complete)_

## Blocked

- _(none)_

## Completed

### Phase 1 — Project setup
- [x] Vite + React 19 + TypeScript (strict) scaffold with path aliases.
- [x] Tailwind dark engineering theme + tokens.
- [x] Extract `model.dae` + textures into `public/models/`.
- [x] COLLADA load pipeline with relative texture resolution.
- [x] Single load + index pass: mesh map, hierarchy tree, per-mesh material clones.
- [x] Orbit / pan / zoom controls + scene lighting + orientation gizmo.
- [x] Loading + error overlays; suspense + error boundary.
- [x] Verified: 660 meshes, textures render, no console errors.

### Phase 2 — Inspection workbench
- [x] Pointer picking (hover + click) on the R3F scene.
- [x] Cursor-following hover label showing component name + material.
- [x] Click select, Shift/Ctrl-click extend, click-empty deselect; persisted.
- [x] Inspector panel: name, parent, material, triangles, vertices, assignment, id.
- [x] Multi-selection summary with subsystem breakdown.

### Phase 3 — Hierarchy explorer
- [x] Full node tree (groups + meshes) with mesh counts.
- [x] Search across names + material names with ancestor-preserving filter.
- [x] Expand / collapse per node and expand-all / collapse-all.
- [x] Tree → 3D selection.
- [x] 3D pick → auto-expand + scroll tree to the mesh.
- [x] Group rows show uniform-subsystem colour dot.

### Phase 4 — Component isolation
- [x] Isolate selection (hide others) + exit isolation.
- [x] Wireframe mode.
- [x] X-ray transparency mode (ghost everything except the selection).
- [x] Edge-line visibility toggle.
- [x] Fit-to-view, focus-camera-on-selection, reset view.

### Phase 5 — Subsystem classification
- [x] Assign single mesh.
- [x] Assign multiple meshes.
- [x] Assign entire group (group selection → assign).
- [x] Keyboard hotkeys 1–5 / 0.
- [x] Reset selection to Unknown.
- [x] State + localStorage persistence (survives reload).

### Phase 6 — Visual classification overlay
- [x] Original-materials vs classification-colours toggle.
- [x] Spec colour scheme (Blue/Orange/Green/Yellow/Purple/Gray).
- [x] Live recolour on assignment change.
- [x] Legend + per-subsystem counts + progress bar; click legend to select all.

### Phase 7 — Export system
- [x] `component-map.json` exact contract (complete lossless partition).
- [x] `component-map.detailed.json` with metadata + derived group ids.
- [x] Import either form back (stale ids skipped) with toast feedback.

### Phase 8 — Deployment workflow
- [x] `run-workbench.sh` (build + serve + `--tunnel`).
- [x] Cloudflare-tunnel-friendly server config (`host:true`, `allowedHosts:true`).
- [x] Reuse repo `bin/cloudflared`; http2 protocol for firewall traversal.

### Phase 9 — Future digital-twin compatibility
- [x] Deterministic, portable stable ids for every mesh.
- [x] Centralised, extensible subsystem taxonomy + colours.
- [x] Detailed export carries twin-ready metadata.
