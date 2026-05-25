# Upgrade Plan — Per-Component RUL + UI Modernization

## 0. Discrepancies surfaced against the prompt

Before any code, three mismatches with the prompt:

1. **No `injection_machine.zip` exists in the workspace.** `find` over the repo
   surfaces only `500.zip` and `archive.zip`; no `.dae`, no `.glb`, no
   `injection_machine*`. P5 cannot start until the user drops the asset
   somewhere (suggest `web/public/models/`). Until then P5 is gated.
2. **Component names differ from the prompt.** The prompt lists components as
   `hydraulic / screw / heaters / drive / mold`. The simulator FSM
   ([src/simulator/degradation.py](src/simulator/degradation.py)) uses
   `hydraulic / screw_check_ring / heaters / drive / mold`. The plan keeps the
   FSM names as the canonical IDs (changing them is a high-blast-radius rename
   touching faults, training data, tests) but maps `screw_check_ring → "Screw
   / Check Ring"` for UI display.
3. **`PROTOTYPE_OVERVIEW.docx` does exist** at
   [docs/PROTOTYPE_OVERVIEW.docx](docs/PROTOTYPE_OVERVIEW.docx). No issue —
   just confirming it's where the prompt said it should be.

## 1. Current snapshot schema (extracted from `run.py`)

The WS server emits one JSON object per cycle with these top-level keys
(see [run.py:42-68](run.py#L42-L68)):

```jsonc
{
  "cycle_index":   int,
  "timestamp":     iso8601,
  "machine_id":    str,
  "scalars":       { ... },                  // process scalars
  "curves":        { ... },                  // hold-pressure / cavity-pressure traces
  "hold_profile":  { ... },
  "barrel_temps":  { ... },
  "health":        { hydraulic: 0..1, screw_check_ring: 0..1, ... },
  "active_faults": [ ... ],
  "rul": {                                   // machine-level only
    "p10": float, "p50": float, "p90": float,
    "failure_threshold": 0.20,
    "optimal_replace_low": 0.35,
    "optimal_replace_high": 0.42
  },
  "quality": { "label": "good|acceptable|waste", "probability": { ... } }
}
```

Source of truth for the labels is `DegradationFSM.cycles_to_failure()` in
[src/simulator/degradation.py:55-63](src/simulator/degradation.py#L55-L63),
which already returns a **per-component** dict. Training code currently
collapses it via `min(rul.values())` in
[scripts/generate_training_data.py:48-50](scripts/generate_training_data.py#L48-L50)
— that's the single line that drops the per-component information today.

## 2. Proposed new snapshot schema

Additive only. Old fields stay so the existing UI keeps rendering during the
incremental React migration.

```jsonc
{
  // ... all existing fields unchanged ...

  "rul_per_component": {
    "hydraulic":        { "p10": 412.3, "p50": 587.1, "p90": 803.4,
                          "replacement_date": "2026-07-14",
                          "urgency": "schedule" },
    "screw_check_ring": { ... },
    "heaters":          { ... },
    "drive":            { ... },
    "mold":             { ... }
  },

  "config": {
    "cycles_per_day": 4000,
    "now":            "2026-05-23T..."
  }
}
```

Urgency bands (computed from `p50_cycles / cycles_per_day` → days):

| Urgency    | Days to failure |
|------------|-----------------|
| `critical` | < 7             |
| `imminent` | 7 – 30          |
| `schedule` | 30 – 90         |
| `monitor`  | > 90            |

Machine-level `rul` block stays — it's now `min` across the per-component
p50s, matching the existing semantics.

## 3. File-by-file changes

### P1 — Per-component RUL
- [scripts/generate_training_data.py](scripts/generate_training_data.py):
  emit one `rul_<comp>_cycles` column per component instead of collapsing to
  `rul_cycles`. Keep `rul_cycles = min(...)` for back-compat.
- [src/ml/train_rul.py](src/ml/train_rul.py): refactor `train(df, output_path)`
  into a loop over components. Artifact becomes
  `{ "components": { hydraulic: {models: {p10,p50,p90}, feature_cols, val_scores}, ... } }`.
  Old single-model artifact stays loadable via a thin compatibility branch
  during the transition, then deleted at the end of P1.
- [src/ml/predict.py](src/ml/predict.py): emit `rul_per_component` (and keep
  `rul` as the min for now).
- [run.py](run.py): pass through `rul_per_component`, add `config` block.
- New test `tests/test_rul_per_component.py`: load an artifact, run predict on
  a synthetic cycle, assert all 5 keys present, all 3 quantiles present,
  `p10 ≤ p50 ≤ p90` (approximately).
- [scripts/retrain_models.py](scripts/retrain_models.py): no API change, but
  regenerate models.

### P2 — Replacement dates + urgency
- New module `src/ml/urgency.py`: pure functions
  `cycles_to_date(cycles, cycles_per_day, now)` and `classify(days)`.
- [src/ml/predict.py](src/ml/predict.py): consume `urgency.py`, accept
  optional `cycles_per_day` arg.
- [run.py](run.py): hold a mutable `CONFIG = {"cycles_per_day": 4000}`. New
  `POST /api/settings` mutates it; `GET /api/settings` returns it. Snapshot
  builder reads it each cycle.
- Test: `tests/test_urgency.py` — exact day math + band edges.

### P3 — UI modernization (Vite + React + Tailwind + shadcn + Recharts + lucide)
- Vite already drives `web/`. Add `@vitejs/plugin-react`. Install deps:
  `react`, `react-dom`, `tailwindcss`, `@radix-ui/*` (shadcn primitives),
  `lucide-react`, `recharts`, `class-variance-authority`, `clsx`,
  `tailwind-merge`.
- [web/src/main.ts](web/src/main.ts) → `main.tsx`. Mount one `<App />` that
  owns the WS connection (port the existing [web/src/api.ts](web/src/api.ts)
  *as-is* — no changes — and wrap it in a `useSnapshot()` hook).
- `web/src/components/ui/*` — generated by `npx shadcn@latest add card badge
  tooltip dialog tabs button`.
- Convert components one at a time, each in its own commit. Order chosen by
  ascending complexity:
  1. `QualityCard.ts` → `QualityCard.tsx`
  2. `FaultButtons.ts` → `FaultButtons.tsx`
  3. `ProcessCharts.ts` → `ProcessCharts.tsx` (Recharts `LineChart`)
  4. `RULBand.ts` → `RULBand.tsx` (Recharts `AreaChart` with p10/p90 band)
  5. `HealthBars.ts` → **deleted**, replaced by P4
  6. `Twin2D.ts` → `Twin2D.tsx` (keep SVG, just wrap)
- After all six conversions: delete leftover `.ts` component files, delete
  `main.ts`, switch Vite entry to `main.tsx`.
- Dark theme + single accent — picking **amber** (`amber-400` on slate-900).
  Reasoning: an amber accent reads "industrial / caution-aware" against dark
  slate and avoids the saturated-blue cliché.

### P4 — Radial gauges
- `web/src/components/ComponentGauge.tsx` — Recharts
  `RadialBarChart` (single-bar, 270° sweep) with absolute-positioned center
  text. Ring color by band. Click opens a `<Dialog>` containing the
  component-scoped `RULBand` plus a (stub) "Schedule maintenance" button.
- `web/src/components/ComponentGrid.tsx` — 5-up CSS grid wrapping
  `ComponentGauge`.
- Replace `<HealthBars />` mount with `<ComponentGrid />` in `App.tsx`.

### P5 — 3D backdrop (gated on asset upload)
- Pre-flight: license check on the `.dae` README, document outcome in
  `docs/3D_LICENSE.md`. Abort if non-redistributable.
- Convert `.dae → .glb` offline via `npx gltf-pipeline -i model.dae -o
  model.glb -d` (Draco-compressed). Target < 2 MB gzipped.
- New `web/src/components/ThreeBackdrop.tsx`. Plain Three.js (no R3F) — one
  `Scene`, one `GLTFLoader`, `requestAnimationFrame` rotate-Y. Add the
  required header comment: `// INTERACTIVE 3D BINDING DEFERRED — requires
  Blender rework to add semantic node names per component`.
- Feature-flag mount via `import.meta.env.VITE_ENABLE_3D === "true"`.

## 4. Parallelism

- **Sequential, blocking spine:** P1 → P2 (P2 needs per-component RUL to exist
  in the snapshot to date-format).
- **P3 can run in parallel with P2**, because P3 is a renderer migration that
  binds to whatever the snapshot currently contains. Strategy: kick P3 off
  the moment P1 is merged; P2 only mutates `predict.py`/`run.py`, which P3
  doesn't touch.
- **P4 depends on P3** (it ships React components into the new shell) and on
  P2 (gauges show replacement dates).
- **P5 is independent of everything else**, gated on asset upload + license
  check.

## 5. Risk register — biggest risk + mitigation

**Biggest risk: P1 per-component RUL quality collapses on the smaller components.**

The two slowest-wearing components (`drive` at 8e-5/cycle, `mold` at
6e-5/cycle) have RULs measured in *tens of thousands of cycles*. With only
20 machines × ≤3000 cycles in the default training run, most trajectories
**never observe failure** for those two — so the per-component RUL labels
are right-censored. Training a quantile regressor on heavily right-censored
labels with no censoring-aware loss will produce systematically
under-confident, miscalibrated p90s for those components, which then
propagates into wrong replacement dates and wrong urgency badges. This is
the failure mode most likely to make the demo look wrong.

**Mitigation, in order of cost:**

1. **Lengthen training trajectories.** Bump
   `scripts/generate_training_data.py --cycles` default from 3000 to 15000
   and let the FSM run to actual failure per machine. Cheap, deterministic,
   keeps the existing pipeline.
2. **Inject component-targeted faults more aggressively for slow components**
   so they reach failure within the trajectory. The fault catalogue in
   `src/simulator/faults.py` already supports per-component pressure — just
   bias the sampler in the training generator to over-represent
   `drive`/`mold` faults.
3. **Calibration check as an explicit deliverable** of P1: a test that
   computes coverage of `[p10, p90]` per component on the held-out fold and
   fails CI if any component drops below 70% coverage. This makes
   miscalibration loud instead of silent.
4. **Last-resort cut:** if (1)+(2) still leave `drive`/`mold` poorly
   calibrated, fall back to a heuristic per-component RUL for those two
   (linear extrapolation from observed health-proxy features) and document
   it openly. P1 still ships, just with a labelled asterisk.

**Second-biggest risk** (smaller, worth noting): the React migration in P3
is a large surface change. Mitigation is already baked into the plan —
strict one-component-per-commit incremental conversion, WS client untouched.

## 6. Cut order if scope blows up

If time runs out, drop in this order: **P5 → P4 → P3 → P2 → P1**. P5 has the
least demo value (static 3D is eye candy). P1 is non-negotiable — it's the
ML story of the upgrade.
