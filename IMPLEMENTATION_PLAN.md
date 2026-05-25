# IMPLEMENTATION_PLAN.md — IMM Predictive Maintenance Demo (Fast-Track Prototype)

> Source of truth. If reality drifts from this doc, update this doc first, then the code.
> Companion file: [TASKS.md](TASKS.md). Notebook track in [ml/](ml/) is a sibling, **not a dependency**.

---

## 1. One-paragraph project summary

We are building a 24-hour, portfolio-grade demo of a predictive maintenance + quality monitoring system for plastic injection molding machines. A synthetic simulator emits realistic per-cycle process curves and scalars; two ML models (RUL regressor, quality classifier) consume only **observable** signals; a single-page dashboard shows live charts, per-component health bars, an RUL band, a quality prediction, three fault-injection buttons, and a 2D twin of the machine whose regions recolor as health drops. Everything runs from one command, with no Docker, no broker, no microservices. All I/O flows through a `DataSource` interface so that swapping the simulator for a real PLC feed later is a single-class change.

---

## 2. Architecture diagram (ASCII)

```
                    ┌──────────────────────────────────────────────┐
                    │              contracts/  (Lane C)            │
                    │  channels.py · *.schema.json · datasource.py │
                    └──────────────────────────────────────────────┘
                              ▲                ▲                ▲
                  imports     │                │ imports        │ imports
                              │                │                │
   ┌──────────────────────────┴──┐   ┌─────────┴───────┐   ┌────┴──────────────────┐
   │       Lane A — SIM+ML       │   │  Lane C — GLUE  │   │  Lane B — FRONTEND     │
   │                             │   │                 │   │                        │
   │  ┌───────────────────────┐  │   │   run.py        │   │   web/  (Vite + TS)    │
   │  │ Simulator (hidden FSM)│  │   │   ┌──────────┐  │   │                        │
   │  │  - degradation state  │──┼──▶│   │   loop   │  │──▶│  charts · health bars  │
   │  │  - cycle generator    │  │   │   └──────────┘  │WS │  RUL band · quality    │
   │  └───────────────────────┘  │   │       │         │or │  2D twin · fault btns  │
   │             │ observables   │   │       ▼         │JSON│                       │
   │             ▼               │   │  snapshot.json  │   │                        │
   │  ┌───────────────────────┐  │   │  /ws            │   │                        │
   │  │ DataSource interface  │  │   │                 │   │                        │
   │  │  ├─ SimulatorSource ✓ │  │   │  fault POST  ◀──┼───┤  POST /fault           │
   │  │  └─ PLCSource (stub)  │  │   │                 │   │                        │
   │  └───────────┬───────────┘  │   │                 │   │                        │
   │              ▼              │   │                 │   │                        │
   │  ┌───────────────────────┐  │   │                 │   │                        │
   │  │ Models (observable    │  │   │                 │   │                        │
   │  │ features only):       │  │   │                 │   │                        │
   │  │  - RUL regressor      │  │   │                 │   │                        │
   │  │  - Quality classifier │  │   │                 │   │                        │
   │  └───────────────────────┘  │   │                 │   │                        │
   └─────────────────────────────┘   └─────────────────┘   └────────────────────────┘

KEY INVARIANT: Frontend, ML, and Twin never know which DataSource is live.
KEY INVARIANT: Hidden FSM state never crosses the DataSource boundary.
```

---

## 3. Repo layout

```
injection-molding/
├── IMPLEMENTATION_PLAN.md    [C] this file
├── TASKS.md                  [C] live task board
├── README.md                 [C] 5-line what + 30-line how
├── Makefile                  [C] `make demo`
├── pyproject.toml            [C] python deps (sim+ml+glue)
├── run.py                    [C] single entry point
│
├── contracts/                [C] OWNED BY LANE C — others read only
│   ├── channels.py
│   ├── datasource.py
│   ├── snapshot.schema.json
│   ├── cycle_output.schema.json
│   └── fault_injection.schema.json
│
├── src/
│   ├── simulator/            [A]
│   │   ├── machine.py        (cycle generator + curve synthesis)
│   │   ├── degradation.py    (hidden FSM, per-component)
│   │   ├── faults.py         (fault injection handlers)
│   │   └── profiles.py       (curve shape templates from literature)
│   ├── ml/                   [A]
│   │   ├── features.py       (observable-only feature extraction)
│   │   ├── train_rul.py
│   │   ├── train_quality.py
│   │   ├── predict.py        (load + run both models)
│   │   └── splits.py         (group-split-by-machine helper)
│   └── datasource/           [A]
│       ├── base.py           (re-exports contracts/datasource.py for typing)
│       ├── simulator_source.py
│       └── plc_source.py     (NotImplementedError stub)
│
├── artifacts/
│   └── models/               [A] rul.pkl, quality.pkl, model_card.md
├── data/
│   └── synthetic/            [A] training runs as parquet
│
├── scripts/                  [C]
│   ├── regenerate_training_data.py   (calls Lane A code)
│   ├── retrain_models.py             (deterministic; seeded)
│   └── record_demo.py                (drives speedup + screen capture hint)
│
├── web/                      [B] OWNED BY LANE B
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/mock_snapshot.json     (B uses until X2 lands)
│   ├── src/
│   │   ├── main.ts
│   │   ├── api.ts            (WS + REST client; reads snapshot.schema.json)
│   │   ├── components/
│   │   │   ├── ProcessCharts.ts
│   │   │   ├── HealthBars.ts
│   │   │   ├── RULBand.ts
│   │   │   ├── QualityCard.ts
│   │   │   ├── FaultButtons.ts
│   │   │   └── Twin2D.ts     (SVG; twin-binding contract documented inline)
│   │   └── styles.css
│
├── docs/                     [C]
│   ├── DEMO_SCRIPT.md        (60-second narration with timestamps)
│   ├── ELEVATOR.md           (30-second paragraph)
│   └── REAL_DATA_SWAP.md     (how to replace SimulatorSource with PLCSource)
│
└── ml/                       (existing notebook track — NOT touched by these 3 agents)
```

**Forbidden directories per lane** (hard rule):
- Lane A may not touch `web/`, `contracts/`, `docs/`, `scripts/record_demo.py`, `Makefile`, `README.md`.
- Lane B may not touch anything outside `web/`.
- Lane C may not touch `src/`, `web/src/`, `artifacts/`, `data/`.

---

## 4. The shared contracts

These are authored by **Lane C in the first 90 minutes**. Everything else reads them.

### 4.1 `contracts/channels.py`

Sourced from Aslantas (2022) and Rousopoulou (2020). Names are stable; units are SI.

```python
# Per-tick (high-frequency, within-cycle) channels
PROCESS_CURVES = {
    "cavity_pressure":             "bar",
    "hydraulic_injection_pressure":"bar",
    "screw_position":              "mm",
    "screw_velocity":              "mm/s",
    "nozzle_temperature":          "degC",
}

# Per-cycle scalars
CYCLE_SCALARS = {
    "cycle_time":                  "s",
    "injection_time":              "s",
    "hold_time":                   "s",
    "cooling_time":                "s",
    "cushion_min":                 "mm",
    "peak_injection_pressure":     "bar",
    "peak_cavity_pressure":        "bar",
    "switchover_position":         "mm",
    "switchover_pressure":         "bar",
    "shot_volume":                 "cm3",
    "clamp_force_peak":            "kN",
    "back_pressure":               "bar",
    "screw_rpm":                   "rpm",
    "oil_temperature":             "degC",
}

# Hold pressure profile (10 steps as in Rousopoulou)
HOLD_PRESSURE_STEPS = [f"hold_pressure_step_{i}" for i in range(1, 11)]  # bar

# Barrel temperatures (6 zones; Aslantas)
BARREL_ZONES = [f"barrel_zone_temp_{i}" for i in range(1, 7)]  # degC

# Component identifiers used by health bars + twin regions
COMPONENTS = [
    "hydraulic",        # pump, valves, oil
    "screw_check_ring", # non-return valve wear
    "heaters",          # barrel + nozzle band heaters
    "drive",            # screw drive / servo
    "mold",             # cooling channels, surface wear
]

# Fault types the simulator accepts
FAULTS = ["check_ring_wear", "heater_drift", "hydraulic_pump_wear"]
```

### 4.2 `contracts/cycle_output.schema.json`

What `SimulatorSource.next_cycle()` returns:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["cycle_index", "timestamp", "machine_id", "curves", "scalars", "hold_profile", "barrel_temps"],
  "properties": {
    "cycle_index":   { "type": "integer", "minimum": 0 },
    "timestamp":     { "type": "string", "format": "date-time" },
    "machine_id":    { "type": "string" },
    "curves": {
      "type": "object",
      "description": "Per-tick arrays sampled within the cycle. Same length across keys.",
      "additionalProperties": { "type": "array", "items": { "type": "number" } }
    },
    "scalars":       { "type": "object", "additionalProperties": { "type": "number" } },
    "hold_profile":  { "type": "array", "items": { "type": "number" }, "minItems": 10, "maxItems": 10 },
    "barrel_temps":  { "type": "array", "items": { "type": "number" }, "minItems": 6,  "maxItems": 6  }
  }
}
```

### 4.3 `contracts/snapshot.schema.json`

What the frontend consumes each tick:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["cycle_index", "timestamp", "curves", "scalars", "health", "rul", "quality"],
  "properties": {
    "cycle_index": { "type": "integer" },
    "timestamp":   { "type": "string", "format": "date-time" },
    "curves":      { "type": "object", "additionalProperties": { "type": "array", "items": { "type": "number" } } },
    "scalars":     { "type": "object", "additionalProperties": { "type": "number" } },
    "health": {
      "type": "object",
      "description": "Per-component health in [0,1]. Estimated from observable signals, NOT read from FSM.",
      "properties": {
        "hydraulic":        { "type": "number", "minimum": 0, "maximum": 1 },
        "screw_check_ring": { "type": "number", "minimum": 0, "maximum": 1 },
        "heaters":          { "type": "number", "minimum": 0, "maximum": 1 },
        "drive":            { "type": "number", "minimum": 0, "maximum": 1 },
        "mold":             { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["hydraulic","screw_check_ring","heaters","drive","mold"]
    },
    "rul": {
      "type": "object",
      "required": ["component", "cycles_remaining", "ci_low", "ci_high"],
      "properties": {
        "component":        { "type": "string" },
        "cycles_remaining": { "type": "number" },
        "ci_low":           { "type": "number" },
        "ci_high":          { "type": "number" }
      }
    },
    "quality": {
      "type": "object",
      "required": ["label", "proba"],
      "properties": {
        "label": { "type": "string", "enum": ["good", "acceptable", "waste"] },
        "proba": { "type": "object",
                   "properties": { "good": {"type":"number"}, "acceptable": {"type":"number"}, "waste": {"type":"number"} },
                   "required": ["good","acceptable","waste"] }
      }
    },
    "speedup":      { "type": "number", "minimum": 1, "description": "Cycles per real second" },
    "active_faults":{ "type": "array", "items": { "type": "string" } }
  }
}
```

### 4.4 `contracts/fault_injection.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["fault", "severity"],
  "properties": {
    "fault":    { "type": "string", "enum": ["check_ring_wear", "heater_drift", "hydraulic_pump_wear"] },
    "severity": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.6 },
    "onset_cycles": { "type": "integer", "minimum": 1, "default": 20,
                      "description": "Cycles over which the fault ramps from 0 to severity" }
  }
}
```

### 4.5 `contracts/datasource.py`

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Iterator, Dict, Any

CycleOutput = Dict[str, Any]   # validated against cycle_output.schema.json

class DataSource(ABC):
    """Abstraction over data origin. Sim today, PLC tomorrow."""

    @abstractmethod
    def stream(self) -> Iterator[CycleOutput]:
        """Yield one CycleOutput per cycle, forever, ordered by cycle_index."""

    @abstractmethod
    def inject_fault(self, fault: str, severity: float, onset_cycles: int) -> None:
        """Optional for real PLCs (may raise NotImplementedError there)."""

    @abstractmethod
    def set_speedup(self, cycles_per_second: float) -> None:
        """Demo-only knob; PLC implementation raises NotImplementedError."""

    @property
    @abstractmethod
    def machine_id(self) -> str: ...
```

---

## 5. Lane A — Simulator + ML

### 5.1 Build order

1. `src/simulator/profiles.py` — parametric curve templates (injection ramp, hold plateau, recovery). 1h.
2. `src/simulator/machine.py` — emits one nominal cycle conforming to `cycle_output.schema.json`. 1.5h.
3. `src/simulator/degradation.py` — hidden FSM (see 5.2). 1h.
4. `src/simulator/faults.py` — three injection handlers that nudge FSM rates. 30m.
5. `src/datasource/simulator_source.py` — wraps machine+FSM behind `DataSource`. 30m.
6. `src/datasource/plc_source.py` — stub class raising `NotImplementedError` with a docstring describing the integration surface. 10m.
7. `src/ml/features.py` — observable-only feature extraction from a window of cycles. 1h.
8. `scripts/regenerate_training_data.py` — runs simulator N machines × M cycles with random fault onsets, writes parquet. 1h.
9. `src/ml/splits.py` + `src/ml/train_quality.py` + `src/ml/train_rul.py` — see 5.3. 2h.
10. `src/ml/predict.py` — loads both pickles, exposes `predict(window) -> {health, rul, quality}`. 45m.

### 5.2 Degradation FSM design

Each of the 5 components has a hidden state `h ∈ [0, 1]` (1 = healthy). Per cycle:

```
h_next = h - base_wear[c] - fault_pressure[c]   (clipped to [0,1])
```

`fault_pressure[c]` is non-zero when a fault that maps to component `c` is active. Mapping:

| Fault                | Component affected | Symptom in observables                                          |
|----------------------|--------------------|-----------------------------------------------------------------|
| check_ring_wear      | screw_check_ring   | `cushion_min` drifts down; `peak_cavity_pressure` more variable |
| heater_drift         | heaters            | `barrel_zone_temp_*` slow drift ±; `injection_time` lengthens   |
| hydraulic_pump_wear  | hydraulic          | `peak_injection_pressure` sag; `oil_temperature` rises          |

Symptom strength is a monotonic function of `(1 - h)`, with Gaussian noise on top. Mold and drive degrade only via slow `base_wear` (no injectable fault) — they exist so the health-bar UI has more than 3 things to show.

**Hard rule:** `h` is never written to the cycle output. The simulator emits only observables. Tests enforce this (see 5.4).

### 5.3 The two models

**Quality classifier**
- Predicts: `{good, acceptable, waste}` per cycle.
- Features: scalars from the current cycle + rolling means/stds over last 20 cycles for the 8 most informative scalars.
- Label generation: a deterministic function of the cycle's observables + small noise (so the classifier is learning a real signal, not the hidden state). Documented in `train_quality.py`.
- Model: `sklearn.ensemble.GradientBoostingClassifier` or `RandomForestClassifier`. Calibrated probabilities.
- Validation: stratified 80/20 on cycles, but **grouped by machine_id**.

**RUL regressor**
- Predicts: cycles remaining until any component crosses `h < 0.2` (treated as the "failure" threshold).
- Features: last-50-cycle window of observable scalars + 6 hand-crafted trend features (slope of cushion_min, slope of peak_injection_pressure, etc.). No FSM access.
- Label generation: from simulator ground truth at data-generation time only (the simulator is allowed to emit a parallel "label" file during training data generation; that file is consumed by training and never by inference or the live `DataSource`).
- Model: `GradientBoostingRegressor` with `loss="quantile"` trained 3 times (α=0.1, 0.5, 0.9) for the CI band.
- Validation: **group K-fold by `machine_id`**. Report MAE and within-50-cycles accuracy on held-out machines.

**Leakage discipline (the rule):**
- `features.py` never imports from `simulator/`.
- A test (A-T3) asserts the feature module has zero imports from `src.simulator`.
- A test (A-T4) trains on machines 0–7, evaluates on 8–9, and fails if held-out MAE is implausibly low (< 5 cycles) — a tripwire for leakage.

### 5.4 Tests required

| ID    | Test                                                                            |
|-------|---------------------------------------------------------------------------------|
| A-T1  | `SimulatorSource.stream()` output validates against `cycle_output.schema.json`. |
| A-T2  | Cycle output dict contains zero keys matching `/health|h_|state|fsm/`.          |
| A-T3  | `import ast`-based check: `src/ml/features.py` has no `src.simulator` imports.  |
| A-T4  | Group-split RUL MAE on held-out machines is > 5 and < 200 cycles (sanity band). |
| A-T5  | Inject `check_ring_wear` severity 0.8 → `cushion_min` mean drops ≥ 10% within 30 cycles. |
| A-T6  | `PLCDataSource().stream()` raises `NotImplementedError` with a useful message.  |

### 5.5 Lane A "done" criteria

- [ ] `from src.datasource.simulator_source import SimulatorSource; next(SimulatorSource().stream())` returns a schema-valid dict.
- [ ] `python scripts/retrain_models.py` is deterministic (seeded) and writes `artifacts/models/{rul,quality}.pkl` + `model_card.md`.
- [ ] `predict.py` loads both pickles and returns the `health/rul/quality` block from `snapshot.schema.json`.
- [ ] All A-T* tests pass.
- [ ] No imports from `web/` or `contracts/` other than `channels` and `datasource`.

---

## 6. Lane B — Frontend + 2D Twin

### 6.1 Tech stack

**Vite + TypeScript + vanilla DOM** (no React, no Next.js). Charts via **uPlot** (lightweight, fast, good for time series). Styling: handwritten CSS, one accent color, dark theme. Twin: inline SVG drawn by hand, regions are `<g id="region-hydraulic">` etc.

Rationale: zero build complexity, fast cold start, demo-friendly. React adds nothing here.

### 6.2 Layout sketch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  IMM-Monitor · Machine SIM-001 · Cycle 4,287 · ▶ speedup ×84                │
├──────────────────────────────────┬──────────────────────────────────────────┤
│                                  │                                          │
│   ProcessCharts (uPlot, 3 rows)  │   Twin2D  (SVG side-view of IMM)         │
│   ── cavity pressure             │   ┌───────┬────────┬─────────────┐       │
│   ── hydraulic injection         │   │ clamp │  mold  │  injection  │       │
│   ── screw position              │   │       │        │   barrel    │       │
│                                  │   └───────┴────────┴─────────────┘       │
│                                  │   Regions tint red as health → 0         │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  HealthBars (5 components)       │   RULBand                                │
│  ▓▓▓▓▓▓▓░░ hydraulic  72%        │   most-degraded: hydraulic               │
│  ▓▓▓▓▓▓▓▓▓ screw_ring 96%        │   ETA 412 cycles  (CI: 280 – 580)        │
│  ▓▓▓▓▓░░░░ heaters    51%        │                                          │
│  ─────                            │   QualityCard                            │
│                                  │   GOOD  · p=0.81 / 0.14 / 0.05           │
├──────────────────────────────────┴──────────────────────────────────────────┤
│  FaultButtons:  [ check-ring wear ]  [ heater drift ]  [ hydraulic pump ]   │
│  Active: heater_drift (severity 0.6, since cycle 4,201)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 2D twin design

- One inline `<svg viewBox="0 0 1000 400">`.
- Regions (each a `<g>` with stable `id`): `region-clamp`, `region-mold`, `region-injection`, `region-barrel`, `region-hydraulic`, `region-drive`.
- Binding contract (documented at top of `Twin2D.ts`): given `snapshot.health[c]`, fill = lerp(`#2dd4bf`, `#ef4444`, 1 − h). Stroke pulses when `c` is the most-degraded component.
- **3D swap contract:** any future 3D twin (glTF or otherwise) implements `setHealth(componentId: string, h: number)` and `pulse(componentId: string)`. The dashboard talks to the twin only through this interface — no other coupling. Documented in `Twin2D.ts` header.

### 6.4 Tests / visual QA

- `npm run typecheck` clean.
- A Playwright smoke test (`web/tests/smoke.spec.ts`): loads page, asserts charts render, asserts each health bar exists, clicks each fault button, asserts the active-faults strip updates.
- Manual QA checklist in `docs/DEMO_SCRIPT.md`.

### 6.5 Lane B "done" criteria

- [ ] `npm run dev` shows the full dashboard reading from `public/mock_snapshot.json` with no console errors.
- [ ] Swapping the data source to the live WS endpoint requires changing one URL in `api.ts`.
- [ ] All six twin regions recolor when their component's health is dialed in mock data.
- [ ] Three fault buttons POST schema-valid JSON to `/api/fault`.
- [ ] Playwright smoke passes locally.

---

## 7. Lane C — Infra + Glue + Demo

### 7.1 Contracts to author first (T+0 → T+90min)

In order: `channels.py` → `cycle_output.schema.json` → `snapshot.schema.json` → `fault_injection.schema.json` → `datasource.py`. Commit and announce in `TASKS.md` X1 before Lane A or B start their builds.

### 7.2 Glue runner architecture

Single `run.py`:

```
run.py
├── starts a SimulatorSource (or env-selected DataSource)
├── starts a tiny aiohttp server on :8000
│     ├── GET  /              → serves built web/dist (or proxies vite in dev)
│     ├── GET  /api/snapshot  → latest snapshot JSON
│     ├── WS   /ws            → pushes snapshot on each cycle
│     └── POST /api/fault     → validates against fault_injection.schema.json
│                                then calls source.inject_fault(...)
└── loop:
      cycle = next(source.stream())
      preds = predict(cycle, history_window)
      snapshot = build_snapshot(cycle, preds, active_faults, speedup)
      broadcast(snapshot)
      sleep(1 / speedup)
```

No process boundaries, no broker. `aiohttp` only because it gives us WS + static + REST in one runtime with no fuss. If even that is too much, fall back to `http.server` + polling `/api/snapshot`.

### 7.3 Demo script (60 seconds)

Saved in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Outline:

```
00:00–00:08  "This is a simulated injection molding machine running live."
             (Charts moving, cycle counter ticking, speedup ×80.)
00:08–00:18  "Five components are tracked. Right now, all healthy."
             Point at health bars. "The twin mirrors that."
00:18–00:28  Click [ hydraulic pump wear ].
             "I'm injecting a fault — pump wear, severity 0.6."
00:28–00:42  Wait ~20 demo cycles. Pressure trace sags.
             Hydraulic health bar drops past 70%. Twin's hydraulic region tints orange.
             "No one told the model what the fault was. It's reading the symptoms."
00:42–00:52  RUL band updates. "412 cycles to threshold, 90% CI shown."
             Quality classifier flips from GOOD to ACCEPTABLE.
00:52–01:00  "Same code path works on real PLC data — swap the DataSource, dashboard unchanged."
```

### 7.4 README outline

```
# IMM Predictive Maintenance — Demo
5-line "what": ...
## Quickstart
  git clone ...
  python -m venv .venv && source .venv/bin/activate
  pip install -e .
  (cd web && npm install && npm run build)
  python scripts/retrain_models.py
  make demo            # opens http://localhost:8000
## How it works
  → IMPLEMENTATION_PLAN.md
## Replacing the simulator with real data
  → docs/REAL_DATA_SWAP.md
```

### 7.5 Lane C "done" criteria

- [ ] Contracts directory complete and frozen by T+90min.
- [ ] `make demo` brings up sim + web on `localhost:8000` with one command.
- [ ] `docs/DEMO_SCRIPT.md` exists with timestamps.
- [ ] `docs/ELEVATOR.md` is one paragraph, ≤ 120 words.
- [ ] `docs/REAL_DATA_SWAP.md` lists the exact files that change.
- [ ] `scripts/record_demo.py` runs the sim at ×80 for 75 seconds and exits cleanly.

---

## 8. Execution timeline

Hours are wall-clock from kickoff. Two human-hours per agent assumed available in parallel.

| Time      | Lane C (Infra)                       | Lane A (Sim+ML)                  | Lane B (Frontend)                  |
|-----------|--------------------------------------|----------------------------------|------------------------------------|
| 0:00–0:30 | scaffold repo, write `channels.py`   | read plan; sketch FSM            | scaffold Vite app; write `mock_snapshot.json` from schema (hand-crafted) |
| 0:30–1:30 | author all 3 JSON schemas + `datasource.py`; commit + tag `contracts-v0` | build `profiles.py` + nominal `machine.py` against draft schema | wire ProcessCharts + HealthBars against mock |
| 1:30–2:00 | build skeleton `run.py` that loops a stub source emitting mock_snapshot | wrap simulator in `SimulatorSource`; A-T1, A-T2 pass | wire RULBand + QualityCard + Twin2D against mock |
| 2:00–4:00 | wire WS broadcast + `/api/fault` route; integrate Lane A `predict.py` shim returning zeros | degradation FSM + 3 faults; generate training parquet | FaultButtons → POST; finish twin region tinting |
| 4:00–5:00 | **SMOKE MOMENT** (§9): real simulator data reaches real frontend | train both models; replace zero-shim in `predict.py` | Playwright smoke; visual polish pass 1 |
| 5:00–6:00 | demo script + README + record_demo.py | leakage tests A-T3/A-T4; tune symptoms so A-T5 passes | visual polish pass 2; speedup UI |
| 6:00–8:00 | integration debugging; capture 60s recording | model-card; deterministic-retrain check | last polish; final Playwright run |

**T+6 hours:** demo recordable. **T+8 hours:** demo recorded.

---

## 9. The "first smoke moment"

**Definition:** the browser at `http://localhost:8000` shows a `cavity_pressure` trace that is being generated, in real time, by `SimulatorSource.stream()` running inside `run.py`, with the cycle counter advancing.

**Reachable at T+4h** because:
- Lane C's `run.py` can broadcast immediately using a stub source (Lane C writes a 20-line `StubSource` that yields cycle outputs derived from `mock_snapshot.json`) — this proves the WS path.
- Lane A's nominal `machine.py` (no FSM, no models) is enough to replace the stub.
- Frontend has been reading the schema since T+0:30 via `mock_snapshot.json`, so the swap to live WS is one URL.

What is **not** required at smoke moment: ML models, fault injection, twin tinting, RUL band, CI band, quality labels. These all land between T+4h and T+6h.

---

## 10. Stubs and assumptions

| Stub                                                | Owner | Consumer | Kill-by |
|-----------------------------------------------------|-------|----------|---------|
| `web/public/mock_snapshot.json` hand-crafted        | B     | B        | T+5h (replace with live WS) |
| `StubSource` in `run.py` emitting fixed mock        | C     | C        | T+2h (replace with Lane A `SimulatorSource`) |
| `predict.py` returning zeros for health/rul/quality | A     | C        | T+5h (replace with trained models) |
| `PLCDataSource.stream()` raises NotImplementedError | A     | nobody now | never — that IS the deliverable for now |
| Fault POST returns 200 even if Lane A handler missing| C    | C        | T+3h |

---

## 11. Risk register

| # | Risk                                                                 | Mitigation                                                              |
|---|----------------------------------------------------------------------|-------------------------------------------------------------------------|
| 1 | Simulator symptoms too subtle → fault button looks broken on stage   | A-T5 tunes severity so a 0.6-severity fault is visible in < 30 cycles   |
| 2 | RUL model overfits because labels leak through features              | A-T3 (import lint) + A-T4 (held-out MAE tripwire)                       |
| 3 | Schema drift between Lane C contract and Lane A/B implementations    | Contracts frozen at T+90min, tagged `contracts-v0`; any change is a PR with all 3 agents notified |
| 4 | WS layer flakes during the recording                                 | Fallback path: `/api/snapshot` polled at 1Hz; recording can use polling |
| 5 | Twin SVG looks toy-grade and undermines credibility                  | Budget 60 min explicitly for twin visual pass (Lane B 5:00–6:00 slot)   |

---

## 12. What changes when real data arrives

**Changes:**
- New file `src/datasource/plc_source.py` (or `opcua_source.py`) implements `DataSource`.
- One env var or CLI flag in `run.py` selects the source class.
- `scripts/regenerate_training_data.py` is replaced by an ETL that pulls historical PLC data into the same parquet shape `src/ml/train_*.py` already consumes.
- `predict.py` is unchanged. Models are retrained on real data using the same training scripts.

**Stays the same:**
- `contracts/` (channel names already match literature conventions).
- `src/ml/features.py`, `train_rul.py`, `train_quality.py`, `splits.py`.
- All of `web/`.
- `run.py` glue loop.
- `snapshot.schema.json`.

If any of the above ends up needing to change for real data, the abstraction failed and the plan was wrong — review before merging the real-data PR.
