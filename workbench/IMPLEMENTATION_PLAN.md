# Implementation Plan — Machine Component Mapping Workbench

A standalone engineering tool to inspect, classify, and export the components of
an injection-molding machine 3D model into predictive-maintenance subsystems. It
is the foundational data-authoring step for a future digital twin: domain experts
visually identify geometry and assign each mesh to a subsystem; the tool exports a
portable `component-map.json` that downstream health / RUL / fault dashboards
consume.

> Living document — kept in step with the code. See [TASKS.md](TASKS.md) for the
> task board, [ARCHITECTURE.md](ARCHITECTURE.md) for structure, and
> [DECISIONS.md](DECISIONS.md) for the rationale behind key choices.

## The model reality that shaped this tool

The supplied COLLADA model (`model.dae`, exported from SketchUp) was inspected
before any code was written. The decisive finding:

- **660 renderable meshes**, ~95k triangles, grouped under generic SketchUp nodes.
- **Node names carry no engineering meaning** — they are `group_0`, `instance_42`,
  etc. There is no "Hydraulic pump" node to search for.
- The **only semantic hints live in material names** — `hopper`, `Metal_Seamed`,
  `Translucent_Glass_Safety`, `_0106_DarkBlue`, etc.

Consequence: classification cannot be name-driven. The workbench is therefore
**visual-inspection-first** — hover/identify, isolate, x-ray, focus, and a
hierarchy explorer are the primary tools for an expert to recognise a component by
its shape, position, and material, then assign it. This insight drove the emphasis
on Phases 2–4.

## Stack

React 19 · TypeScript (strict) · Three.js · React Three Fiber · @react-three/drei
· @react-three/postprocessing · Zustand · Tailwind · Vite. See DECISIONS.md for
why each was chosen.

## Phase plan & status

| Phase | Goal | Status |
|------|------|--------|
| 1 | Project setup — scaffold, DAE + texture loading pipeline, orbit controls | ✅ Done |
| 2 | Inspection workbench — hover identify, click select, metadata panel | ✅ Done |
| 3 | Hierarchy explorer — tree, search, expand/collapse, bidirectional sync | ✅ Done |
| 4 | Component isolation — isolate, hide, transparency (x-ray), wireframe, focus | ✅ Done |
| 5 | Subsystem classification — assign single / multiple / whole group | ✅ Done |
| 6 | Visual classification overlay — class colours vs original materials | ✅ Done |
| 7 | Export system — `component-map.json` (+ detailed) and import round-trip | ✅ Done |
| 8 | Deployment — local serve + Cloudflare Tunnel for remote sessions | ✅ Done |
| 9 | Future digital-twin compatibility — stable ids + extensible schema | ✅ Foundations in place |

### Phase 1 — Project setup
- Vite + React 19 + TS scaffold, Tailwind theme, path aliases.
- COLLADA loaded via `ColladaLoader`; textures resolved relative to the `.dae`.
- Single-load + index pipeline ([src/lib/model.ts](src/lib/model.ts)) building the
  mesh map and hierarchy tree, cloning per-mesh materials, and tagging edge lines.
- **Acceptance:** app starts, model + textures render, orbit/pan/zoom work, no
  console errors. ✔ Verified via headless render (660 meshes, textures visible).

### Phase 2 — Inspection workbench
- Pointer picking on the R3F scene; cursor-following hover label with mesh name.
- Click to select, Shift/Ctrl-click to extend; selection persists in state.
- Inspector panel: mesh name, parent node, material, triangle & vertex counts,
  current assignment, stable id.
- **Acceptance:** any mesh can be inspected/identified. ✔

### Phase 3 — Hierarchy explorer
- Tree view of the full node graph; search over names + material names.
- Expand/collapse (per-node and all); group rows show descendant mesh counts and a
  uniform-subsystem colour dot.
- Bidirectional sync: tree → 3D selection, and 3D pick → auto-expand + scroll the
  tree to the mesh.
- **Acceptance:** the model can be navigated entirely from the tree. ✔

### Phase 4 — Component isolation
- Isolate selection (hide all others), wireframe mode, x-ray transparency mode,
  edge-line toggle, fit-to-view, focus-camera-on-selection, reset view.
- **Acceptance:** complex geometry can be inspected without clutter. ✔

### Phase 5 — Subsystem classification
- Assign the current selection to Hydraulic / ScrewCheckRing / Drive / Heaters /
  Mold / Unknown via buttons or hotkeys `1–5`,`0`.
- Single mesh, multi-selection, and whole-group assignment (selecting a group
  selects all its meshes). Assignments persist in state + localStorage.
- **Acceptance:** any geometry can be classified. ✔

### Phase 6 — Visual classification overlay
- Two view modes: original materials, or flat subsystem colours
  (Blue/Orange/Green/Yellow/Purple/Gray). Live recolour as assignments change.
- **Acceptance:** assignments are visually obvious. ✔

### Phase 7 — Export system
- `component-map.json` — the exact `{ subsystem: [ids] }` contract; a complete,
  lossless partition (every mesh appears once; unassigned → Unknown).
- `component-map.detailed.json` — adds per-mesh metadata + derived group ids.
- Import either file back (stale ids skipped) for resumable sessions.
- **Acceptance:** exported file can be imported by future systems. ✔

### Phase 8 — Deployment workflow
- `run-workbench.sh` builds + serves; `--tunnel` opens a Cloudflare quick tunnel.
- Vite dev + preview servers bind `0.0.0.0` with `allowedHosts: true` so rotating
  `*.trycloudflare.com` hosts work — no localhost-only assumptions.
- **Acceptance:** the same instance is reachable remotely by developer + client. ✔

### Phase 9 — Future digital-twin compatibility
- **Stable, portable ids** (deterministic node-name paths) keep `component-map.json`
  valid across reloads and machines — the contract a twin binds health/RUL to.
- Subsystem taxonomy + colours are centralised ([src/subsystems.ts](src/subsystems.ts));
  adding a subsystem is a one-line change.
- The detailed export already carries the metadata a twin needs (material,
  triangle counts, parentage) without re-parsing the DAE.

## Verification approach

Each phase was exercised in a real headless Chromium render (Playwright): asset
HTTP probes, mesh-count assertion, pointer pick → select → hotkey-assign →
overlay → export round-trip, and screenshots of every display mode. Zero console
or page errors.
