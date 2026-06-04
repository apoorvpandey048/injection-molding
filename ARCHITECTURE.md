# ARCHITECTURE — IMM Digital Twin Platform

> Status: **living document**. Supersedes the standalone "Machine Component Mapping
> Workbench" architecture. The workbench is now the *Inspection* module of one
> platform, not a separate application.

---

## 1. System context

```
        ┌──────────────────────────────────────────────────────────────┐
        │                     IMM Digital Twin Platform                  │
        │                       (single SPA, served by run.py)           │
        │                                                                │
        │   Operations mode  ◄──── mode switch ────►  Inspection mode    │
        │   (live monitoring)                          (mesh authoring)   │
        └───────────────▲────────────────────────────────▲──────────────┘
                        │ WebSocket /ws (snapshots)        │ static /models/model.dae
                        │ REST /api/* (commands, config)   │ static /map/component-map.detailed.json
                        │                                  │
        ┌───────────────┴──────────────────────────────────┴────────────┐
        │                  run.py  (aiohttp app server)                   │
        │   • streams cycle snapshots   • persists config + thresholds    │
        │   • serves SPA dist + 3D model + component map                  │
        └───────────────▲────────────────────────────────────────────────┘
                        │ in-process
        ┌───────────────┴────────────────────────────────────────────────┐
        │   SimulatorSource → Machine / degradation / faults / ML predict │
        │   health{5}, rul_per_component{5}, quality, curves{5}, scalars  │
        └─────────────────────────────────────────────────────────────────┘
```

The platform is deployed as a **single-page app** served by the existing Python
`run.py`. There is no second server, no second build, no second port. A remote
reviewer reaches the exact same app through the Cloudflare tunnel.

---

## 2. The two model files (the critical reconciliation)

This was the central architectural problem and it drives several decisions.

| File | Format | Used by (before) | Node names | Mesh IDs |
|------|--------|------------------|------------|----------|
| `web/public/models/injection_machine.glb` | glTF + Draco | old `web/` dashboard | **generic** | none (binding deferred) |
| `workbench/public/models/model.dae` | COLLADA | `workbench/` | mostly `instance_N` | **deterministic, runtime-derived** |

The old GLB was a *backdrop* — its nodes are unnamed, so it could never bind
live health to geometry (see the `INTERACTIVE 3D BINDING DEFERRED` banner in the
old `Twin3D.tsx`). The **component map references `model.dae` IDs**, derived at
load time by `lib/model.ts → indexModel()`.

**Decision:** the platform's Digital Twin Viewer renders `model.dae` (the same
model the mapping references) using the workbench's proven R3F engine. The GLB
is retired from the live path. See [DECISIONS.md](DECISIONS.md) D-01.

### 2.1 Why a *spatial* component map

`model.dae` has ~1114 mesh instances but only ~30 descriptive node names
(`hopper`, `platen`, `mold_rail_base`, `oil_cooler_*`, `tank_holder`, …); the
rest are `instance_N` with generic metal/glass materials. Keyword classification
alone cannot partition it into the five subsystems with confidence.

**Decision:** the Component Mapping Engine classifies meshes by **spatial region**
(position of each mesh centroid along the machine's principal axis + vertical
band), seeded and overridden by **name hints**. This is deterministic,
reproducible, complete (every mesh lands in exactly one subsystem), and produces
visually coherent regions that light up convincingly. Expert users refine it in
Inspection mode and re-export. See [DECISIONS.md](DECISIONS.md) D-02.

---

## 3. Module architecture

Nine modules, matching the platform brief. Each is a directory under
`platform/src/modules/<name>/` with a stable public surface (an `index.ts`), so
modules can grow without cross-module refactors.

| # | Module | Responsibility | Key files |
|---|--------|----------------|-----------|
| 1 | **Digital Twin Viewer** | R3F canvas, camera (orbit/pan/zoom/fit/focus/reset, cinematic transitions), lighting, outline FX | `modules/viewer/` |
| 2 | **Component Mapping Engine** | classify meshes → subsystems (spatial + name hints), load/persist `component-map.detailed.json`, mesh↔subsystem lookups | `modules/mapping/` |
| 3 | **Component Health Engine** | derive per-subsystem health/status/trend from the live snapshot; drive mesh tint | `modules/health/` |
| 4 | **RUL Engine** | per-subsystem remaining-useful-life, urgency, replacement date, forecast band data | `modules/rul/` |
| 5 | **Sensor Visualization Engine** | scalar + curve channels mapped to subsystems, threshold bands, crosshair charts | `modules/sensors/` |
| 6 | **Alert Engine** | machine-state banner, fault list, threshold breaches, prioritised "act on this first" | `modules/alerts/` |
| 7 | **Analytics Engine** | trends, forecast regions, predicted-failure markers, summary KPIs | `modules/analytics/` |
| 8 | **Deployment Module** | config/threshold persistence, deterministic boot, env wiring | `run.py` + `modules/config/` |
| 9 | **Collaboration Module** | shared review session via URL state (selected subsystem, camera, mode), tunnel-aware | `modules/collab/` |

Cross-cutting: **state store** (`store/`), **data layer** (`data/` — WebSocket
client + REST), **design system** (`ui/` + `styles/`), **tooltip system**
(`ui/explain/`).

### 3.1 Data flow (one cycle)

```
backend cycle ──► /ws snapshot ──► IMMClient ──► useSnapshot() ──► store.snapshot
                                                                       │
        ┌──────────────────────────────────────────────────────────────┤
        ▼                          ▼                       ▼             ▼
  Health Engine             RUL Engine            Sensor Engine    Alert Engine
  (per-subsystem            (per-subsystem        (channel→sub)    (state, faults)
   health 0..1)              forecast band)
        │                          │                       │             │
        ▼                          ▼                       ▼             ▼
  mesh tint (viewer)        forecast chart          curve charts    status banner
  subsystem rail color      detail panel            detail panel    alert list
```

The **selected subsystem** is the dashboard's active context: every panel reads
`store.selectedSubsystem` and renders that subsystem's slice.

---

## 4. State model

Single Zustand store (extends the workbench store). Slices:

- **model**: `index: ModelIndex | null`, load status.
- **mapping**: `assignments: Record<meshId, Subsystem>`, `componentMap`, source
  (`file` | `derived`), dirty flag.
- **live**: `snapshot: Snapshot | null`, `connected`, history ring-buffer
  (per-subsystem health & worst-RUL, capped at N cycles).
- **selection/context**: `selectedSubsystem: Subsystem | null`,
  `hoveredSubsystem`, plus mesh-level `selection`/`hovered`/`activeNodeId`
  (Inspection).
- **viewer**: camera command bus (`fit`/`focus`/`reset`/`frameSubsystem`),
  persisted camera pose.
- **inspection**: `isolated`, `viewMode`, `displayMode`, `showEdges`, `search`,
  `expanded` (the existing workbench slices).
- **ui**: `mode: "operations" | "inspection"`, panel open/close, settings.

Persistence: mapping + UI settings + camera pose to `localStorage` (fast,
per-reviewer) **and** the authoritative component map + server config to disk via
the backend (durable, shared). See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 5. Subsystem ↔ backend component identity

The backend health/RUL dicts are keyed by snake_case component ids; the UI uses
the workbench Subsystem enum. One canonical bidirectional map
(`modules/mapping/identity.ts`):

| Subsystem (UI) | backend key | color | fault id |
|----------------|-------------|-------|----------|
| Hydraulic | `hydraulic` | `#3b82f6` blue | `hydraulic_pump_wear` |
| ScrewCheckRing | `screw_check_ring` | `#f97316` orange | `check_ring_wear` |
| Drive | `drive` | `#22c55e` green | `drive_servo_wear` |
| Heaters | `heaters` | `#eab308` yellow | `heater_drift` |
| Mold | `mold` | `#a855f7` purple | `mold_clamp_wear` |
| Unknown | — | `#9ca3af` gray | — |

`Unknown` meshes (frame, guards, panels) render as neutral structure and never
carry health — they are context, not monitored assets.

---

## 6. Rendering & performance architecture

- **Imperative reconciliation** (kept from the workbench): a single
  `applyVisuals(index, state)` walks the ~1114 meshes and sets
  material/visibility/emissive in <1 ms. No per-mesh React nodes ⇒ no React
  reconciliation cost on hover. This is what keeps the 60 FPS target.
- **Health tint** is a new visual channel layered into `applyVisuals`: in
  Operations mode each mesh's base color lerps subsystem color → health color
  (green→amber→red) by that subsystem's live health, with the selected subsystem
  emphasised and others dimmed.
- **Selection/hover outline** via `@react-three/postprocessing` `Outline`
  (already in place).
- **Camera**: drei `<Bounds>` for fit/focus + a command bus for cinematic
  `frameSubsystem` transitions (eased, ~0.6 s). Camera pose persisted.
- Charts use Recharts with memoised series and a capped history buffer to avoid
  unbounded re-renders.

---

## 7. Directory layout (target)

```
platform/                      # the unified app (evolved from workbench/)
  public/
    models/model.dae           # the canonical model (+ textures)
    map/component-map.detailed.json   # source of truth (generated, committed)
  src/
    data/            # IMMClient, useSnapshot, REST helpers (ported from web/)
    store/           # zustand store (extended)
    modules/
      viewer/        # DigitalTwinViewer, camera, lighting, scene controller
      mapping/       # classifier, identity, component-map IO
      health/        # per-subsystem health derivation
      rul/           # forecast band, urgency
      sensors/       # channel↔subsystem, threshold model
      alerts/        # state banner, fault controls
      analytics/     # trends, KPIs
      collab/        # URL session state
      config/        # settings + thresholds client
      inspection/    # hierarchy, inspector, mapping editor (ported workbench UI)
    ui/              # design system: Card, Button, Tooltip, explain/ tooltips
    layout/          # CommandCenter shell, AppBar, SubsystemRail, ContextPanel, StatusBar
    styles/          # tokens.css, index.css
run.py                         # serves platform/dist; persists config + thresholds
web/                           # LEGACY dashboard — retained, no longer served (D-08)
```

Until the platform reaches feature-parity-and-better and is wired into `run.py`,
`web/` remains the served app so the system is **never left non-deployable**
(see [TASKS.md](TASKS.md) phase gates).

---

## 8. Extension points (future-proofing without refactor)

- **New subsystem**: add one entry to `subsystems.ts` + `identity.ts`; classifier,
  rail, panels, charts all enumerate from there.
- **New sensor channel**: add to the channel↔subsystem table in
  `modules/sensors/channels.ts`; charts render generically.
- **Real PLC source**: swap `SimulatorSource` for `PLCSource` behind the same
  snapshot contract (`contracts/` already defines it) — frontend unchanged.
- **Real backend persistence**: the config client speaks REST; swapping the file
  store for TimescaleDB/Postgres (already in `infra/`) is a backend-only change.
- **Multi-machine**: `machine_id` already flows in every snapshot; a machine
  selector + per-machine store namespace is additive.
