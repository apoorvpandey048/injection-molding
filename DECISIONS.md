# DECISIONS — IMM Digital Twin Platform (ADR log)

Lightweight architecture decision records. Each entry: context → decision →
consequences. Newest decisions may supersede older ones.

---

### D-01 — Render the COLLADA model, retire the GLB from the live path
**Context.** Two model files exist. `injection_machine.glb` has generic, unnamed
nodes (binding was explicitly deferred). `model.dae` is what the component map
references, with deterministic runtime-derived mesh IDs.
**Decision.** The Digital Twin Viewer renders `model.dae` via the workbench's R3F
engine. The GLB is no longer used for the live twin.
**Consequences.** Per-mesh health binding becomes possible. We inherit the DAE's
~1114 meshes and the COLLADA loader; performance is handled by imperative
reconciliation (already proven in the workbench). The GLB + Draco assets remain in
`web/public` but are dead in the new path.

---

### D-02 — Component map is **spatial + name-hint**, not keyword-only
**Context.** The DAE's nodes are ~30 descriptive names among ~1114 generic
`instance_N` meshes; keyword classification can't partition it confidently.
**Decision.** The Component Mapping Engine assigns each mesh to a subsystem by
**spatial region** (centroid along the machine's principal axis + vertical band),
overridden by **name hints** where descriptive names exist. Output is a complete,
deterministic `component-map.detailed.json`.
**Consequences.** Whole machine regions light up coherently (great demo). The map
is reproducible and committed as the source of truth. It is an *approximation*; a
domain expert refines it in Inspection mode and re-exports — and that refined file
then takes precedence over the derived one.

---

### D-03 — Unify on the workbench foundation (React 19 + R3F), fold in the dashboard
**Context.** Two SPAs: `web/` (React 18, raw three.js, recharts, radix) and
`workbench/` (React 19, R3F, drei, zustand). The brief wants one platform with the
3D viewer as hero and the workbench as a module.
**Decision.** Evolve the **workbench** into the platform (it already has the
production R3F engine, hierarchy, isolation, wireframe, classification = Inspection
mode for free) and **port the live-data dashboard** (api/useSnapshot + panels) into
it. Recharts and Radix support React 19.
**Consequences.** The hero 3D experience is built on proven code; Inspection mode
is near-free. Cost: re-home the dashboard panels and add recharts/radix to the
platform app. The new app lives at `platform/` (a git move of `workbench/`), so
diffs stay legible.

**Update (supersedes the location detail of D-03):** to minimize churn and keep
history, the unified app is developed **in place under `workbench/` renamed to a
neutral platform identity** rather than a fresh tree; `run.py`/`demo.sh` are
repointed once it reaches parity. The legacy `web/` stays served until then.

---

### D-04 — Selected subsystem is the dashboard's single active context
**Context.** The brief: "The selected component becomes the active context of the
dashboard. Every graph should update accordingly."
**Decision.** One store field `selectedSubsystem` drives the Context Panel and every
chart. No subsystem selected ⇒ machine-overview rollup.
**Consequences.** Clean mental model, no panel-by-panel selection state. Charts must
all read from the same selector; the history buffer is keyed per subsystem.

---

### D-05 — Health is a continuous mesh-tint channel, layered on classification color
**Context.** Subsystems have identity colors (classification) *and* live health.
**Decision.** In Operations mode meshes are tinted by **live health** (green→amber→
red) within their subsystem; the subsystem's identity color drives chrome (rail,
outlines, panel). Classification view (flat identity color) remains available in
Inspection mode.
**Consequences.** Operators see condition at a glance on the model itself; authors
still get the flat taxonomy view. Two clearly separated visual intents.

---

### D-06 — Self-explaining tooltips are data-derived, not just static copy
**Context.** The brief makes "intelligent tooltips" a major requirement; they must
say whether a value is good/bad and what to do.
**Decision.** Build an `Explain`/`MetricExplain` system that composes the tooltip
from the **current value + its threshold band**, so the interpretation is always
true to the live reading (not generic). Definitions are static; judgments are
computed.
**Consequences.** A single threshold model (per metric/channel) feeds both the chart
bands and the tooltips, guaranteeing they agree.

---

### D-07 — Determinism: persist config + thresholds + map to files on the backend
**Context.** DGX deployment must not require retraining or re-mapping; outputs must
survive a clone+pull+start.
**Decision.** The backend persists `cycles_per_day`, thresholds, and the active
component map to disk under `config/` (JSON). The frontend reads/writes via REST.
The model is seeded (`seed=42`) and models are pre-trained artifacts — no retrain on
boot. The component map is committed.
**Consequences.** `git pull && ./demo.sh` yields an identical, working system with
no manual setup. No DB required for the demo (DB remains an optional upgrade per
ARCHITECTURE §8).

---

### D-08 — Keep `web/` as legacy until the platform is wired into `run.py`
**Context.** "Never break working functionality; always remain deployable."
**Decision.** `run.py` keeps serving `web/dist` until the platform build is green and
validated; the switch of `WEB_DIR` to `platform/dist` is the final, atomic phase
step. `web/` is then retained read-only for reference.
**Consequences.** Every intermediate phase has a deployable app. The cutover is one
small, reviewable change.

---

### D-09 — Collaboration via shareable URL session state (no realtime server)
**Context.** Remote reviewers (developer + domain expert) review the same machine
through the tunnel. A full multiplayer backend is out of scope for the demo.
**Decision.** Encode review context (mode, selected subsystem, camera pose) in the
URL hash so a link reproduces a colleague's exact view; everyone streams the same
live snapshots from the one backend.
**Consequences.** "Shared review session" works over the existing tunnel with zero
new infra. True cursor-level multiplayer is a documented future extension.

---

### D-10 — Charts: Recharts, not a new 3D-grade chart lib
**Context.** Need enterprise charts (crosshair, threshold/forecast regions, markers).
**Decision.** Stay on Recharts (already a dependency); it supports `ReferenceArea`/
`ReferenceLine`/custom tooltips — enough for the enterprise toolkit — and is React 19
compatible at current versions.
**Consequences.** No new heavy dependency; consistent with the existing dashboard.
Custom crosshair + forecast overlays are built on Recharts primitives.

---

### D-11 — Committed component map is the source of truth (file-first on load)
**Context.** A returning reviewer's stale `localStorage` could shadow the committed
map (observed: 249 vs 240 mesh drift across test sessions).
**Decision.** On load the platform prefers the committed
`public/map/component-map.detailed.json`; `localStorage` only applies when no file
exists. Inspection edits are session-local until exported/persisted to the file.
**Consequences.** Deterministic for fresh clones and returning browsers alike; the
file is the single shared truth. Unsaved live edits don't survive reload by design.

---

### D-12 — Spatial zones rebalanced so every subsystem is visibly present
**Context.** The first spatial partition gave Drive only 8 of 660 meshes — selecting
it highlighted almost nothing.
**Decision.** Re-cut the zones: power pack at the injection-end base (Hydraulic),
clamp-drive/motor at the centre base and upper centre (Drive), barrel screw/heaters
across the upper injection end, mold at the clamp end.
**Consequences.** Balanced, demo-legible regions — Hydraulic 219 · Screw 111 ·
Drive 57 · Heaters 71 · Mold 184 · Structure 18. Still deterministic; the committed
map is regenerated when the classifier changes.

---

### D-13 — Commit the trained ML models for friction-free DGX startup
**Context.** The brief: "DGX deployment must not require retraining." Models were
gitignored, so a clone retrained on first run (minutes).
**Decision.** Commit `artifacts/models/*.pkl` (≈12 MB) via a `.gitignore` exception;
keep all other artifacts ignored.
**Consequences.** `git clone && ./demo.sh` comes up immediately with no training
wait. Models are still regenerable deterministically (`make train`, fixed seed) if
ever needed.

---

### D-14 — Desktop-optimised responsive layout (≥1280), not a mobile reflow
**Context.** UI_STRATEGY first described a rail→icons / panel→bottom-sheet reflow.
**Decision.** Ship fluid side-panel widths (Tailwind breakpoints) that keep the 3-D
viewer the dominant column (≥55%) from 1280 px up, plus a "Viewing ·" orientation
badge. No phone/tablet reflow — industrial monitoring is a desktop/large-display use.
**Consequences.** Clean, professional on laptops, monitors and shared screens;
explicitly desktop-first. UI_STRATEGY updated to match what shipped.
