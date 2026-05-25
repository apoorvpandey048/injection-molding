# Visual Upgrade Plan — Injection-Molding PdM Digital Twin

**Scope of this iteration:** visual polish + correctness. No new ML, no new
architecture, no retraining. Five priorities (V1–V5) executed as separate phases
with a stop-and-report gate after each.

**Test baseline (recorded before any change):** `31 passed, 1 failed` of 32.
The single failure is `tests/test_simulator.py::test_at5_heater_drift_barrel_temp`
— a pre-existing **stochastic/flaky** test (it asserts `barrel_temp_std` rises under
`heater_drift`, but at seed/severity used the drifted std ≈ baseline std). Documented
as known-flaky in `UPGRADE_TASKS.md` P1.9. **This failure is part of the baseline; it
is NOT a regression.** "Green → red" is measured against `31 passed` of the *other*
31 tests, plus we re-check that test_at5 stays in its known ±0.03 noise band.

---

## Hard-rule compliance map (what each priority is allowed to touch)

| Priority | Python allowed? | What in Python | Frontend |
|----------|-----------------|----------------|----------|
| V1 Reset | ✅ (explicit)   | reset endpoint + `reset()` on sim/FSM/faults/machine | header button + confirm |
| V2 Failure | ✅ (explicit)  | `machine_state` field, failure latch, WASTE override | banner + failed gauge state + status badge |
| V3 Dates | ✅ (explicit)   | a date-math unit test only | OVERDUE / ">1 year" clamps |
| V4 Visual | ❌ **none**     | — | everything (`web/src/`, Tailwind, CSS) |
| V5 Docs  | ✅ doc script    | `scripts/build_overview_doc.py`, extend `capture_screenshots.py` | — |

No changes to `src/ml/*` models, `src/datasource/plc_source.py`, training, or 3-D
twin behavior. No new heavy deps (Fontsource + shadcn additions + Framer-Motion-if-needed
are the only pre-approved additions; I expect to add **only Fontsource**).

---

## V1 — Reset to full health

**Goal:** `POST /api/reset` + header "Reset machine" button (with confirm) that returns
the sim to pristine state: all 5 components `health=1.0`, no active faults, cycle counter
`0`, cleared rolling history, failure latch cleared.

### Backend (Python — explicitly permitted)
- **`src/simulator/degradation.py`** — add `DegradationFSM.reset()`: set every `_health`
  back to `1.0` and every `_fault_pressure` back to `0.0`.
- **`src/simulator/faults.py`** — add `FaultManager.clear_all()`: drop every active fault
  (`self._active.clear()`).
- **`src/simulator/machine.py`** — add a `cycle_index` read-only property and
  `MachineSimulator.reset()`: set `_cycle_index = 0`. (RNG is left as-is; reset restores
  *machine state*, not the noise stream — documented.)
- **`src/datasource/simulator_source.py`** — add `SimulatorSource.reset()`: call
  `self._fsm.reset()`, `self._fault_manager.clear_all()`, `self._machine.reset()`, and
  clear the V2 failure-latch fields. Streaming thread keeps running; next emitted cycle is
  index `0` at full health.
- **`run.py`** — add `handle_reset` (`POST /api/reset`) → `source.reset()`, set
  `_latest_snapshot = None`, return `{"status":"ok"}`. Register route in `make_app()`.
  `CONFIG` (cycles_per_day) is a *setting*, not machine state → **not** reset.

### Frontend
- **`web/src/api.ts`** — add `IMMClient.reset()` → `POST /api/reset`.
- **`web/src/App.tsx`** — header gets a subtle "Reset machine" button opening a confirm
  dialog (built on existing `@radix-ui/react-dialog`; no new dep). On confirm → `client.reset()`.
- **Rolling-history clear (protocol-free):** App tracks the last `cycle_index`; when the
  new snapshot's `cycle_index` is **less than** the previous (i.e. reset happened), bump a
  `resetEpoch` state used as the React `key` on `RULBand` and `ProcessCharts`, forcing a
  remount → fresh ref buffers. No WS-protocol change.

### Test
- Extend `tests/test_simulator.py` (or new `tests/test_reset.py`): inject a fault, run N
  cycles, call `source.reset()`, assert all health `== 1.0`, `active_faults == []`,
  next cycle index `== 0`, `get_machine_state() == "running"`.

---

## V2 — Health=0 / failure behavior

**Definition (anchored on existing constants `FAILURE_THRESHOLD=0.20`,
`OPTIMAL_REPLACE_LOW=0.35`, `OPTIMAL_REPLACE_HIGH=0.42`):**

`machine_state` is derived from the **worst component's true FSM health** (ground truth,
computed server-side, never fed to any model):

| worst health | machine_state |
|--------------|---------------|
| `> 0.42` (OPTIMAL_REPLACE_HIGH) | `running` |
| `0.35 – 0.42` | `warning` |
| `0.20 – 0.35` | `critical` |
| `≤ 0.20` (FAILURE_THRESHOLD) | `failed` (latched) |

This yields a monotone `running → warning → critical → failed` march as any component
degrades. Note this is **distinct** from the gauge *urgency* band (which is days-based,
ML-predicted) — `machine_state` is the ground-truth condition, urgency is the forecast.
Documented in V5.

**Failure behavior:** the first time any component crosses `≤ 0.20`, the machine **latches
FAILED**. While failed: the FSM no longer steps and the fault manager no longer ticks
(health is **pinned** at its crossed value; the `[0.0,1.0]` clamp guarantees it never goes
negative). New cycles **still emit**, flagged `failed=true`, with quality forced to `WASTE`.
Only `reset()` clears the latch.

### Backend (Python — explicitly permitted)
- **`src/datasource/simulator_source.py`**
  - New latch fields: `_failed: bool`, `_failed_component: str|None`,
    `_failed_at_cycle: int|None`, `_failed_health: float|None`.
  - `stream()`: when not failed, tick faults + step FSM as today; after stepping, if
    `self._fsm.any_failed()` and not yet latched, latch (`most_degraded_component()`,
    current `machine.cycle_index`, its health). When failed, **skip** fault-tick and FSM
    step; still call `next_cycle()` (frozen symptom factors) and `yield`.
  - `get_machine_state() -> str` (table above; returns `"failed"` if latched).
  - `is_failed() -> bool`, `get_failure_info() -> dict|None`
    (`{component, cycle_index, health}`).
  - `reset()` (V1) also clears these latch fields.
- **`run.py` `_build_snapshot`** — add top-level fields:
  - `"machine_state": source.get_machine_state()`
  - `"failed": source.is_failed()`
  - `"failure": source.get_failure_info()` (or `null`)
  - When `failed`: override the served quality block to
    `{"label":"waste","probability":{"good":0,"acceptable":0,"waste":1}}`. This is a
    **serving-layer presentation override only** — the ML model is untouched.

### Frontend
- **`web/src/api.ts`** — extend `Snapshot` type with `machine_state`, `failed`, `failure`.
- **`web/src/App.tsx`** — when `machine_state === "failed"`, render a prominent banner:
  *"Machine FAILED — {component} crossed the failure threshold at cycle {N}. Reset to continue."*
  with a Reset button.
- **`web/src/components/ComponentGauge.tsx`** — a component whose health `≤ failure_threshold`
  (from `snapshot.rul.failure_threshold`) renders a **distinct failed visual**: lock icon,
  desaturated grey-red ring, "STOPPED" label (reads as *stopped*, not merely *bad*).
- **Header status badge** reflects `machine_state` with a colored dot (running/warning/
  critical/failed) — functional in V2, polished in V4.

### Test (required by the brief)
- **`tests/test_failure.py`** (new): `SimulatorSource(seed=0)`, `set_speedup(0)` (disables
  the `time.sleep`), inject `hydraulic_pump_wear` severity≈1.0 onset≈1, iterate cycles
  collecting `get_machine_state()` after each. Assert: the observed distinct states appear
  in the order `running → warning → critical → failed` (prefix-correct, ends in `failed`);
  cycles continue to emit after `failed`; no health value ever `< 0.0`; the latched
  component matches `get_failure_info()`.

---

## V3 — Replacement-date sanity audit

### Test (required by the brief)
- **`tests/test_urgency.py`** (extend) — at `cycles_per_day=4000`, fresh p50 RUL `50000`:
  `cycles_to_date(50000, 4000, NOW)` is `12` days out (floor of 12.5), and
  `days_until(...) == 12` ("roughly 12.5 days"). Plus assert the existing clamps:
  negative cycles → today (0 days), and a large RUL (e.g. `2_000_000`) → `days > 365`.

### Frontend clamps (web-only — the bug is presentational)
Backend already clamps p50 ≥ 0 and dates ≥ today, so the literal "yesterday" never occurs,
but `days = 0` and multi-year dates both read as broken. Fix in the UI:
- **`web/src/components/ComponentGauge.tsx`**, **`ComponentGauge` dialog**, and the
  **worst-component footer in `App.tsx`**:
  - `days_until_replacement ≤ 0` **or** component failed → show **`OVERDUE`** badge
    (distinct desaturated-red style), **no date**.
  - `days_until_replacement > 365` → show **`> 1 year`** instead of a literal date.
  - otherwise → existing date + `Nd`.
- Centralize this in a small helper `web/src/lib/replacement.ts`
  (`formatReplacement(days, dateISO, failed) -> {label, date|null, tone}`) so gauge,
  dialog, and footer stay consistent.

### Docs
Edge cases (OVERDUE, >1 year, days=0, pinned-at-failure) are captured here and written
into the docx **in V5** (single regeneration of `build_overview_doc.py` output — see note
under V5). Listed in tasks as V3.4.

---

## V4 — Visual overhaul (web-only, the main ask)

**Parallelism decision:** the repo is **not a git repository**, so the brief's
branch/worktree sub-agent split (`visual/lane-a…`) is not available without `git init`,
and the four lanes all touch shared core files (`index.css`, `tailwind.config.js`,
`App.tsx`, `tokens.css`) which would conflict heavily. **Plan: execute V4 sequentially
A → B → C → D** (the brief's explicitly-sanctioned fallback). Gate every lane on a clean
`tsc && vite build` and a fresh screenshot before moving on. *(If you'd rather I `git init`
and run lanes as parallel worktree sub-agents, say so at approval — see the question I'm
raising.)*

### Lane A — Color system + typography + tokens + header
- **NEW `web/src/styles/tokens.css`** — single source of truth, CSS variables:
  `--color-bg, --color-surface, --color-surface-elevated, --color-border,
  --color-text-primary, --color-text-secondary, --color-text-muted, --color-accent,
  --color-accent-hover, --color-success, --color-warning, --color-critical, --color-failed`
  (`--color-failed` = desaturated grey-red, visibly distinct from `--color-critical`).
  One coherent dark industrial palette (deep slate-blue base, single accent — proposed
  teal/cyan accent to move off the amber hackathon look; final hexes documented in V5).
- **`web/src/index.css`** — `@import "./styles/tokens.css";`; remap the existing shadcn
  HSL variables to the new palette (so shadcn primitives stay consistent); set body font.
- **`web/package.json`** — add `@fontsource-variable/inter` + `@fontsource/jetbrains-mono`
  (self-hosted, no Google CDN). Import in `main.tsx`.
- **`web/tailwind.config.js`** — add `fontFamily.sans = Inter`, `fontFamily.mono =
  JetBrains Mono`; keep type scale to `text-xs/sm/base/lg/xl/2xl/3xl` only.
- **`web/src/App.tsx` header** — large **mono** cycle counter; machine-status badge with
  colored dot (driven by V2 `machine_state`); connection indicator; subtle Reset button;
  settings gear (opens Lane C drawer). Tokens via `bg-[var(--color-surface)]` etc.

### Lane B — Gauges + detail dialog + RUL band
- **`web/src/components/ComponentGauge.tsx`** — refine radial gauge: stroke width, center
  hierarchy **health % BIG → days SMALLER → urgency label SMALLEST** (reorders today's
  days-first layout), CSS-transition the ring value, five distinct states
  (monitor/schedule/imminent/critical/**failed** with lock). Consumes V3 helper.
- **Detail dialog (same file)** — better spacing; RUL band gets **axis labels with units**
  ("cycles", "days from now"), hover tooltip with exact values, plain-English
  "what this means" footer.
- **`web/src/components/RULBand.tsx`** — better gradient fills; threshold reference lines
  clearly labeled (Failure threshold, resale sweet-spot); remove chart-junk; tooltip values.

### Lane C — Quality + process charts + fault controls + settings drawer
- **`web/src/components/QualityCard.tsx`** — smoother bar animation; semantic colors
  (`good`=`--color-success`, `acceptable`=`--color-warning`, `waste`=`--color-critical`).
- **`web/src/components/ProcessCharts.tsx`** — consistent axis treatment, subtle gridlines,
  no legend clutter, token colors.
- **`web/src/components/FaultButtons.tsx` + `App.tsx`** — wrap fault controls in a
  **collapsible "Demo controls"** panel (de-emphasized; clearly not production), with the
  speed slider. Built on a small collapsible (CSS/`details` or radix) — no new dep.
- **NEW `web/src/components/ui/sheet.tsx`** — shadcn Sheet (built on existing
  `@radix-ui/react-dialog`, side variant; no new dep). **NEW `web/src/components/SettingsDrawer.tsx`**
  — cycles-per-day editor; wired via new `api.ts` `getSettings()` / `setSettings()`
  (`GET`/`POST /api/settings`, already exist on the server).

### Lane D — Empty/loading/error states + micro-interactions
- Every panel gets a **designed empty/loading state** (skeleton/placeholder) when
  `snapshot` is null, and an **error/disconnected state** when `!connected`. Touch each
  component + `App.tsx`.
- **Micro-interactions:** hover states on everything clickable; accessible focus rings
  (token `--color-accent`); subtle fade-in on snapshot update (CSS transition, not a jarring
  re-render). Framer Motion only if CSS proves insufficient (pre-approved, but I'll try CSS
  first).
- **Responsive check** at 1440×900 and 1920×1080. Dark mode only; no theme toggle.

### After each lane: `cd web && npx tsc --noEmit && npm run build`, then screenshot.

---

## V5 — Plain-English glossary + updated overview doc

Happens **after V1–V4 are visually stable**. The docx is *generated* by
`scripts/build_overview_doc.py`, so "append, don't rewrite" = **add new sections to that
script and regenerate once** (regenerating per-priority would waste work — this is why V3's
edge-case doc is deferred to here).

- **`scripts/build_overview_doc.py`** — append sections:
  1. **Glossary** — RUL, p10/p50/p90, calibration, GroupKFold, urgency band, replacement
     date, failure threshold, sweet spot, fault injection, digital twin, machine state.
     Each: one technical sentence + one plain sentence + one factory-floor example.
  2. **Reading the dashboard at a glance** — annotated screenshot with callouts 1–8 (one
     line each) + a 4-bullet "what should I do?" decision tree.
  3. **Visual design system** — palette swatches, type scale, key spacing rules.
  4. **What happens when the machine fails** — documents V2 (states, latch, WASTE, reset).
  5. **Replacement-date edge cases** — OVERDUE, >1 year, days=0, pinned-at-failure (V3).
- **`scripts/capture_screenshots.py`** — extend to capture **all states**: healthy,
  warning, critical, failed (drive to failure via fault + `set_speedup`), reset
  confirmation dialog, settings drawer, component detail dialog. Regenerate
  `docs/screenshots/*` automatically.
- Regenerate `docs/PROTOTYPE_OVERVIEW.docx`.

---

## Deliverable — single runnable script (after V1–V5)

- **`./demo.sh`** (bash) and **`demo.bat`** (cmd), idempotent:
  detect models → train if missing; detect `web/dist` → `npm install && build` if missing;
  detect `.venv` → create + `pip install -e ".[dev]"` if missing; start `run.py`;
  print the URL. Listed as the final task.

---

## Verification discipline (every phase)
1. `tsc --noEmit && npm run build` must succeed (the only automated frontend safety net).
2. `pytest tests/` — expect `31 passed`; `test_at5` may stay flaky in its known band; any
   *other* test going red is fixed before continuing.
3. Screenshot before/after for V4 phases.
4. Stop after each priority and report: shipped / before-after shots / deviations / new risks.
