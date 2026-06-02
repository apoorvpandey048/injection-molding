# Decisions — Component Mapping Workbench

Architectural decision record. Each entry: the decision, why, and trade-offs.

## D1 — Build as a standalone app, not inside the existing dashboard
**Decision:** New self-contained `workbench/` app rather than a route in the
sibling `web/` digital-twin dashboard.
**Why:** The spec frames this as a *standalone engineering tool* focused entirely
on discovery/inspection/classification/export. The dashboard is the future
*consumer* of this tool's output (Phase 9), with different concerns (live
WebSocket telemetry, raw Three.js, React 18). Keeping them separate avoids
entangling authoring with visualisation and lets the workbench adopt the
requested R3F stack cleanly.
**Trade-off:** A second `node_modules` / build. Acceptable for a focused tool; the
two apps communicate only through the portable `component-map.json` contract.

## D2 — Load the COLLADA (.dae) directly, not the converted .glb
**Decision:** The workbench loads `model.dae`; the dashboard's `injection_machine.glb`
is left untouched.
**Why:** Phase 1 explicitly requires verifying DAE + texture loading. The DAE is
the source of truth and preserves the SketchUp grouping and **material names**,
which are the only semantic hints available for classification. A GLB conversion
can flatten/rename and is a step removed from what the expert authored.
**Trade-off:** 8.6 MB XML parsed in-browser (~1–2 s) vs a smaller binary GLB. Worth
it for fidelity; a one-time cost behind a loading overlay.

## D3 — Visual-inspection-first UX (driven by model inspection, not assumptions)
**Decision:** Centre the tool on hover-identify, isolate, x-ray, focus, and a
hierarchy explorer rather than name search.
**Why:** Inspecting the model up front revealed nodes are named `group_0` /
`instance_42` with **no engineering meaning**; only material names hint at
function. Experts must therefore recognise components *visually*. This finding
(documented in IMPLEMENTATION_PLAN.md) made Phases 2–4 the backbone.
**Trade-off:** More 3D-interaction engineering than a name-list tool would need —
but a name-list tool would be useless on this model.

## D4 — Stable ids = deterministic node-name paths
**Decision:** Identify each mesh by its root-to-node name path with sibling
de-duplication (e.g. `SketchUp/group_0/instance_65/node#4`), not by Three.js
`uuid` (regenerated per load) or DAE numeric ids.
**Why:** The export must be re-importable and consumable by future systems across
reloads and machines. The source file is static and the loader deterministic, so
the path is reproducible *and* human-readable. Group ids fall out as path prefixes.
**Trade-off:** Ids break if the DAE is re-exported with a changed hierarchy — an
acceptable, explicit coupling to the asset version (recorded in the detailed
export's `model` field).

## D5 — Zustand + an imperative scene controller
**Decision:** Central Zustand store; a `SceneController` imperatively reconciles
the live Three.js graph via `applyVisuals()` over a single `<primitive>`.
**Why:** 660 meshes as individual React components would make selection/hover
re-renders expensive. One primitive + targeted imperative mutation is fast and
keeps visual state in exactly one place. Zustand gives selector-scoped subscriptions
so, e.g., the tree never re-renders on hover.
**Trade-off:** Visuals live outside React's declarative model. Contained to one
pure-ish function that is easy to reason about and re-run wholesale.

## D6 — Per-mesh material clones
**Decision:** Clone each mesh's authored material(s) at load; create flat
classification materials per mesh lazily.
**Why:** SketchUp shares materials across many meshes. Tinting/recolouring/
ghosting one component must not affect the others. Per-mesh materials make every
visual operation local and correct.
**Trade-off:** ~660 extra material instances (a few MB). Negligible; bought correct
isolation of highlight/overlay/x-ray.

## D7 — Postprocessing Outline for selection/hover (plus a subtle emissive)
**Decision:** Draw hover/selection highlights with an `Outline` postprocessing
pass (cyan = selection, white = hover, x-ray so it shows through), backed by a
faint emissive lift on the material.
**Why:** A crisp outline reads clearly against textured *and* flat-colour meshes
and never collides with the subsystem palette (unlike colour-tinting a mesh would).
The emissive is a zero-dependency fallback cue if postprocessing is unavailable.
**Trade-off:** Adds `postprocessing` + `@react-three/postprocessing` and requires
WebGL2. Fine for the target (modern browsers / DGX GPUs).

## D8 — Export: exact contract first, detailed second; Unknown is explicit
**Decision:** `component-map.json` is exactly `{ subsystem: [ids] }` and is a
*complete* partition — every mesh appears once, unassigned meshes go to `Unknown`.
A separate `component-map.detailed.json` adds metadata + derived group ids.
**Why:** Honour the Phase 7 contract literally so any consumer can rely on it,
while a downstream twin gets richer data without re-parsing the DAE. A complete
partition means a consumer can trust that every mesh is accounted for.
**Trade-off:** Two files. The simple one stays canonical; the detailed one is
additive and optional.

## D9 — Persist to localStorage
**Decision:** Auto-save assignments + view prefs to `localStorage`.
**Why:** Classification sessions are long and collaborative; a reload must not lose
work. Pairs with explicit JSON export for portability/sharing.
**Trade-off:** Per-browser, not multi-user. Sufficient for the single-instance,
shared-tunnel review model in Phase 8; explicit export covers handoff.

## D10 — React 19 + R3F 9 + drei 10
**Decision:** Adopt the current major versions for a fresh app.
**Why:** No legacy constraint; `use()` for clean suspense loading, latest drei
helpers (`Bounds`, `GizmoViewport`). Matches the spec's R3F preference.
**Trade-off:** Newer than the sibling app's React 18. Isolation (D1) makes this a
non-issue.

## D11 — Cloudflare-tunnel-friendly serving from day one
**Decision:** Vite dev + preview bind `0.0.0.0` with `allowedHosts: true`;
`run-workbench.sh --tunnel` opens a quick tunnel over http2.
**Why:** Phase 8 requires remote collaborative access; the common failure is
Vite's host check rejecting `*.trycloudflare.com` and QUIC being firewalled. Both
are pre-empted. Never assume localhost-only.
**Trade-off:** `allowedHosts: true` is permissive — acceptable for an internal
review tool serving a public, read-only static asset.
