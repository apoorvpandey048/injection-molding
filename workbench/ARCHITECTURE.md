# Architecture — Component Mapping Workbench

## Overview

A single-page React app. One Three.js scene is loaded from the COLLADA model,
indexed once into immutable lookup structures, and then driven entirely by a
central Zustand store. UI panels read/write the store; an imperative controller
reconciles the live Three.js graph to match store state. There is no backend —
the app is fully static and runs from any file server (Phase 8).

```
┌─────────────────────────────── App.tsx ───────────────────────────────┐
│  Toolbar        (camera · display modes · overlay · isolate · import)  │
│ ┌──────────┬───────────────────────────────────┬───────────────────┐  │
│ │ Hierarchy │           Viewport (R3F)          │  Inspector        │  │
│ │  Panel    │   Canvas → ModelScene             │  Classification   │  │
│ │ (tree +   │     · <primitive> machine graph   │  Panel            │  │
│ │  search)  │     · pointer pick (hover/click)   │  (assign · legend │  │
│ │           │     · Bounds camera + OrbitCtrls   │   · export)       │  │
│ │           │     · EffectComposer Outline       │                   │  │
│ │           │     · SceneController (applyVisuals)│                   │  │
│ └──────────┴───────────────────────────────────┴───────────────────┘  │
│  StatusBar      (counts · hovered · modes)            Toast            │
└────────────────────────────────────────────────────────────────────────┘
                              ▲          │
                       reads  │          │  actions
                              │          ▼
                    ┌──────────────────────────────┐
                    │   Zustand store (store.ts)    │
                    │  index · assignments ·        │
                    │  selection · hovered ·        │
                    │  isolated · view/display ·    │
                    │  camera commands · toast      │
                    └──────────────────────────────┘
```

## Data flow

1. **Load & index (once).** `lib/model.ts::loadModel()` runs `ColladaLoader`, then
   `indexModel()` walks the scene graph producing a `ModelIndex`:
   - `meshes: Map<id, MeshInfo>` — every classifiable mesh.
   - `tree: TreeNode[]` + `nodesById` — the hierarchy for the explorer.
   - `edges: Object3D[]` — SketchUp edge lines (rendered, non-pickable).
   - Per-mesh **material clones** so highlighting/recolouring one mesh never bleeds
     into siblings that shared a material in the DAE.
   `ModelScene` suspends on this promise (React 19 `use()`), then publishes the
   index into the store.

2. **State.** All interaction mutates the Zustand store. Selection/hover/isolation
   are kept as `Set`s; assignments as a `meshId → subsystem` record (absence =
   the implicit `Unknown` default — keeps the state small and the export lossless).

3. **Reconcile.** `SceneController` subscribes to every visual slice and calls
   `lib/visuals.ts::applyVisuals()`, which is `O(#meshes)` (sub-millisecond here)
   and sets, per mesh: visibility (isolation), active material (original vs flat
   class colour), wireframe, transparency (x-ray, restoring authored opacity), and
   a subtle emissive highlight. Hover/selection **outlines** are drawn by a
   postprocessing `Outline` pass fed arrays of the selected/hovered objects.

4. **Camera.** Toolbar buttons push fire-and-forget *camera commands* (fit / focus
   / reset) into the store; a `CameraCommands` component inside drei `<Bounds>`
   consumes the latest nonce and re-frames using the Bounds API.

5. **Persist.** Assignments + view prefs are written to `localStorage` on every
   change and restored on load, so long collaborative sessions survive reloads.

6. **Export/Import.** `lib/exporter.ts` builds the contract from the index +
   assignments and parses it back, tolerating ids absent from the current model.

## Stable identifiers (the contract's backbone)

Because the model has no semantic names, each node gets a deterministic id: the
**name path from the root with sibling de-duplication**, e.g.
`SketchUp/group_0/group_16/instance_65/node#4`. The source file is static and the
loader deterministic, so ids are reproducible across reloads and machines. This is
what lets an exported `component-map.json` keep referring to the same geometry —
the property a downstream digital twin depends on. Group ids are the prefixes of
mesh ids, so group-level assignment is derivable, not separately tracked.

## File map

```
src/
  subsystems.ts          taxonomy, colours, hotkeys (single source of truth)
  types.ts               MeshInfo, TreeNode, ModelIndex, ComponentMap, modes
  store/store.ts         Zustand store + selectors + localStorage persistence
  lib/
    model.ts             ColladaLoader + indexModel + per-mesh material clones
    visuals.ts           applyVisuals — imperative scene reconciliation
    exporter.ts          build/parse component-map.json (+ detailed) + download
    cn.ts                classnames helper
  components/
    Viewport.tsx         Canvas wrapper, suspense/error overlays, hover tooltip
    scene/ModelScene.tsx in-canvas: model, picking, Bounds, outline, controller
    Toolbar.tsx          global view/display/overlay/isolation + import/export
    HierarchyPanel.tsx   tree + search + bidirectional sync
    InspectorPanel.tsx   metadata / multi-selection summary
    ClassificationPanel.tsx  assign buttons, legend, counts, detailed export
    StatusBar.tsx        live counts + modes
    Toast.tsx            transient feedback
  App.tsx                layout + global hotkeys
  main.tsx               entry
public/models/           model.dae + model/ textures (self-contained)
```

## Performance notes

- One `<primitive>` for the whole graph + imperative updates avoids reconciling
  660 React components on every interaction.
- Hover never re-renders the tree (the tree does not subscribe to `hovered`),
  preventing render storms during mouse movement.
- Materials are cloned once at load; subsequent visual changes mutate flags only
  (no shader recompiles), so mode switches are instant.

## Extending toward the digital twin (Phase 9)

- **New subsystem:** add one entry to `SUBSYSTEMS` + `SUBSYSTEM_META`.
- **Bind health/RUL:** consume `component-map.json`; resolve a mesh by its stable
  id; overlay colour/badges keyed on the subsystem or per-mesh id. The detailed
  export already exposes the metadata needed to drive overlays without re-reading
  the DAE.
