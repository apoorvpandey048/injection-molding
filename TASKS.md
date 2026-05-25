# Task Tracker

Source of truth: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). If a task here conflicts with the plan, the plan wins — fix the task row, don't drift.

Legend: 🔲 todo · 🟡 in-progress · ✅ done · ⛔ blocked

---

## Lane A — Simulator + ML  (owner: `sim-agent`)

| ID  | Task | Status | Owner | Notes |
|-----|------|--------|-------|-------|
| A1  | Author `src/simulator/profiles.py` — nominal per-channel curve generators (cavity_pressure, hydraulic_injection_pressure, screw_position, hold_pressure_step_1..10, barrel zone temps). Parametric, deterministic from seed. | 🔲 | sim-agent | Shapes only — no degradation logic yet. |
| A2  | Author `src/simulator/machine.py` — `Machine` class that emits one `cycle_output` dict per `tick()` using profiles + nominal noise. | 🔲 | sim-agent | Validates against `contracts/cycle_output.schema.json`. |
| A3  | Author `src/simulator/degradation.py` — hidden component-health FSM (5 components, h∈[0,1], drift + jumps). | 🔲 | sim-agent | State is private to the simulator; must not leak through any return value. |
| A4  | Wire fault handlers: `check_ring_wear`, `heater_drift`, `hydraulic_pump_wear` — each modifies FSM state, which biases profile params on subsequent cycles. | 🔲 | sim-agent | Symptom map matches §5 of the plan. |
| A5  | Author `src/datasource/simulator_source.py` — `SimulatorSource(DataSource)` wrapping `Machine`. Implements `stream()`, `inject_fault()`, `set_speedup()`. | 🔲 | sim-agent | Only public-facing surface for the rest of the system. |
| A6  | Author `src/datasource/plc_source.py` — `PLCSource(DataSource)` stub raising `NotImplementedError` with docstring describing OPC-UA / Modbus mapping. | 🔲 | sim-agent | Proves the interface is real, not theatre. |
| A7  | Author `src/ml/features.py` — observable-signal feature extractor (per-cycle scalars + light derived stats from curves). | 🔲 | sim-agent | **Forbidden:** any import from `src.simulator.*`. Lint test A-T3 enforces this. |
| A8  | Author `scripts/generate_training_data.py` — produces `data/synthetic/train.parquet` from N seeded simulator runs, with `machine_id` group label and per-cycle quality label + RUL label. | 🔲 | sim-agent | Deterministic for a given seed list. |
| A9  | Author `src/ml/train_quality.py` — train calibrated GBC; save to `artifacts/models/quality.pkl`; emit metrics JSON. | 🔲 | sim-agent | GroupKFold by `machine_id`. |
| A10 | Author `src/ml/train_rul.py` — three quantile GBRs (α=0.1/0.5/0.9); save to `artifacts/models/rul.pkl`; emit metrics JSON. | 🔲 | sim-agent | GroupKFold by `machine_id`. No leakage. |
| A11 | Author `src/ml/predict.py` — load both models, expose `predict(cycle_output) -> {quality, rul_p10/p50/p90}`. | 🔲 | sim-agent | Called by Lane C glue. |
| A12 | Tests: A-T1 schema-roundtrip · A-T2 fault-symptom emerges in ≤100 cycles · A-T3 AST lint (no simulator imports in `ml/`) · A-T4 GroupKFold split correctness · A-T5 model load+predict latency <10ms · A-T6 determinism on fixed seed. | 🔲 | sim-agent | A-T3 is the leakage guard — do not skip. |
| A13 | `make train` target wired (regenerates data + retrains both models, end-to-end, deterministic). | 🔲 | sim-agent | Coordinate with C8. |

## Lane B — Frontend + 2D Twin  (owner: `frontend-agent`)

| ID  | Task | Status | Owner | Notes |
|-----|------|--------|-------|-------|
| B1  | Scaffold `web/` with Vite + TypeScript + vanilla DOM. Dark theme, one accent color, considered typography. | 🔲 | frontend-agent | No React, no Next.js. |
| B2  | Drop `web/public/mock_snapshot.json` matching `contracts/snapshot.schema.json` so the UI is buildable before Lane C ships the live feed. | 🔲 | frontend-agent | Kill-by: end of hour 4. |
| B3  | `ProcessCharts` component — uPlot, two live curves (cavity_pressure, hydraulic_injection_pressure), rolling window. | 🔲 | frontend-agent | |
| B4  | `HealthBars` component — 5 component bars, color-lerp `#2dd4bf → #ef4444`. | 🔲 | frontend-agent | Bound to `snapshot.health[]`. |
| B5  | `RULBand` component — most-degraded component's p50 line with p10/p90 band. | 🔲 | frontend-agent | |
| B6  | `QualityCard` component — predicted class + probability bar; flashes on transitions. | 🔲 | frontend-agent | |
| B7  | `Twin2D` component — inline SVG side-view of IMM. Named regions: `region-clamp`, `region-mold`, `region-injection`, `region-barrel`, `region-hydraulic`, `region-drive`. `setHealth(id, h)` + `pulse(id)` API. | 🔲 | frontend-agent | The 3D-swap contract lives here. |
| B8  | `FaultButtons` component — three buttons that POST `contracts/fault_injection.schema.json` to `/api/fault`. | 🔲 | frontend-agent | |
| B9  | WS client wiring — subscribe to `/ws`, dispatch snapshots into a typed store, all components re-render off the store. | 🔲 | frontend-agent | Fallback to polling `/api/snapshot` if WS missing — log a console warning. |
| B10 | Speedup toggle in header — POST to `/api/speedup`. | 🔲 | frontend-agent | |
| B11 | Playwright smoke test: load page, see live cavity_pressure update, click `check_ring_wear`, observe health bar drop within 30s of wallclock at 100× speedup. | 🔲 | frontend-agent | |
| B12 | Visual polish pass — spacing, type scale, accent restraint, empty/loading states. | 🔲 | frontend-agent | Last 60 minutes before recording. |

## Lane C — Infra + Glue + Demo  (owner: `infra-agent`)

| ID  | Task | Status | Owner | Notes |
|-----|------|--------|-------|-------|
| C1  | Author `contracts/channels.py` — final channel taxonomy (per §4 of plan). Read-only thereafter. | 🔲 | infra-agent | Lanes A and B import from here. |
| C2  | Author `contracts/snapshot.schema.json`, `contracts/cycle_output.schema.json`, `contracts/fault_injection.schema.json`. | 🔲 | infra-agent | Locked by end of hour 1. |
| C3  | Author `contracts/datasource.py` — `DataSource` ABC: `stream()`, `inject_fault()`, `set_speedup()`, `machine_id`. | 🔲 | infra-agent | |
| C4  | `run.py` skeleton — aiohttp app serving `/`, `/api/snapshot`, `/ws`, `/api/fault`, `/api/speedup`. Uses a `StubSource` initially that replays `mock_snapshot.json`. | 🔲 | infra-agent | Unblocks B before A is ready. |
| C5  | Swap `StubSource` for `SimulatorSource` once A5 lands. WS broadcasts each cycle's snapshot. | 🔲 | infra-agent | Triggers smoke moment (X2). |
| C6  | Integrate `src/ml/predict.py` into the per-cycle snapshot assembly once A11 lands. | 🔲 | infra-agent | |
| C7  | `Makefile` targets: `make demo`, `make train`, `make test`, `make web`. | 🔲 | infra-agent | `make demo` is the single command. |
| C8  | `pyproject.toml` / `requirements.txt` — pinned versions. No Docker, no compose. | 🔲 | infra-agent | |
| C9  | `README.md` — 5-line "what" + 30-line "how to run". Nothing else. | 🔲 | infra-agent | |
| C10 | `docs/DEMO_SCRIPT.md` — 60-second narration with timestamps. | 🔲 | infra-agent | |
| C11 | `docs/ELEVATOR.md` — 30-second elevator paragraph. | 🔲 | infra-agent | |
| C12 | `docs/REAL_DATA_SWAP.md` — what changes when PLC data arrives (cross-ref §12 of plan). | 🔲 | infra-agent | |
| C13 | `scripts/record_demo.py` — runs the sim at 100× speedup, drives fault buttons on a schedule, exits cleanly so OBS/ffmpeg can wrap. | 🔲 | infra-agent | |
| C14 | `.gitignore` — venv, `artifacts/models/*.pkl`, `data/synthetic/*.parquet`, node_modules, dist. | 🔲 | infra-agent | |

---

## Cross-lane integration points

| ID | What | Lanes | Status |
|----|------|-------|--------|
| X1 | Contracts published (C1+C2+C3), A and B unblocked | C → A, B | 🔲 |
| X2 | First real `snapshot.json` from `SimulatorSource` reaches the frontend over WS | A, C → B | 🔲 |
| X3 | Fault button click triggers visible symptom (curve change + health bar drop) within 30 cycles | B → C → A → C → B | 🔲 |
| X4 | Both models trained and integrated into the per-cycle snapshot (RUL band + quality card live) | A → C → B | 🔲 |
| X5 | Full 60-second demo recording captured end-to-end | C | 🔲 |

---

## Update protocol

Agents update their own rows only. Status changes go through a commit:

```
git commit -m "[LANE-A] task A3 → 🟡 in-progress"
```

When marking ✅, append a one-line note in the **Notes** column about what shipped (file path, key decision, or test that now passes). Do not delete rows; if a task is descoped, mark it ⛔ with a note pointing to the replacement task.

Cross-lane (X*) rows are updated by whichever agent observes the integration succeeding — and they must commit a one-line proof (a curl output, a screenshot path, a passing test name).
