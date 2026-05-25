# Visual Upgrade Tasks — Live Tracker

Status legend: 🔲 todo · 🟡 in-progress · ✅ done · ⛔ blocked

Update this file after every task. One task = one logical change.

**Test baseline (pre-change):** `31 passed, 1 failed` of 32.
Known-flaky baseline failure: `tests/test_simulator.py::test_at5_heater_drift_barrel_temp`
(stochastic; baseline std ≈ drifted std). Not a regression — see VISUAL_UPGRADE_PLAN.md.

---

## V1 — Reset to full health  *(backend + UI wiring; do first)*

| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V1.1 | ✅ | `DegradationFSM.reset()` — all `_health`→1.0, all `_fault_pressure`→0.0 | [src/simulator/degradation.py](src/simulator/degradation.py) | — |
| V1.2 | ✅ | `FaultManager.clear_all()` — drop all active faults | [src/simulator/faults.py](src/simulator/faults.py) | — |
| V1.3 | ✅ | `MachineSimulator.reset()` + `cycle_index` property — `_cycle_index`→0; RNG stream intentionally left running | [src/simulator/machine.py](src/simulator/machine.py) | — |
| V1.4 | ✅ | `SimulatorSource.reset()` — reset fsm + faults + machine (V2 latch fields appended in V2.1) | [src/datasource/simulator_source.py](src/datasource/simulator_source.py) | V1.1–V1.3 |
| V1.5 | ✅ | `POST /api/reset` handler + route; clears `_latest_snapshot` (keeps CONFIG) | [run.py](run.py) | V1.4 |
| V1.6 | ✅ | `IMMClient.reset()` → `POST /api/reset` | [web/src/api.ts](web/src/api.ts) | V1.5 |
| V1.7 | ✅ | Header "Reset machine" button + confirm dialog (radix-dialog, no new dep) | [web/src/App.tsx](web/src/App.tsx) | V1.6 |
| V1.8 | ✅ | Rolling-history clear: `cycle_index` drop → bump `resetEpoch`, used as `key` on RULBand + ProcessCharts | [web/src/App.tsx](web/src/App.tsx) | V1.7 |
| V1.9 | ✅ | `test_reset.py`: post-reset health all 1.0, no faults, next cycle 0 (passes) | [tests/test_reset.py](tests/test_reset.py) | V1.4 |
| V1.10 | ✅ | tsc clean, `npm run build` ok, suite running (V1 fast subset green); endpoint verified live (175→0 cycle drop, faults cleared, health→1.0); screenshot `docs/screenshots/v1_reset_dialog.png` | — | V1.1–V1.9 |

## V2 — Health=0 / failure behavior  *(backend + UI wiring)*

| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V2.1 | ✅ | Failure latch fields + `stream()` freeze-on-fail + `get_machine_state()` / `is_failed()` / `get_failure_info()`; `reset()` clears latch | [src/datasource/simulator_source.py](src/datasource/simulator_source.py) | V1.4 |
| V2.2 | ✅ | Snapshot gains `machine_state`, `failed`, `failure`; quality forced WASTE when failed (serving-layer override only) | [run.py](run.py) | V2.1 |
| V2.3 | ✅ | `Snapshot` type: `machine_state`, `failed`, `failure` (+ `MachineState`, `FailureInfo`) | [web/src/api.ts](web/src/api.ts) | V2.2 |
| V2.4 | ✅ | Failed banner in App ("Machine FAILED — {comp} crossed threshold at cycle #{N}. Reset to continue.") + Reset button | [web/src/App.tsx](web/src/App.tsx) | V2.3 |
| V2.5 | ✅ | Failed gauge visual: Lock icon + "STOPPED" + grey-red ring `#7d5f5f` + grayscale + strikethrough label when health ≤ threshold | [web/src/components/ComponentGauge.tsx](web/src/components/ComponentGauge.tsx) | V2.3 |
| V2.6 | ✅ | Header status badge reflects `machine_state` (colored dot, pulse when failed) | [web/src/App.tsx](web/src/App.tsx) | V2.3 |
| V2.7 | ✅ | `test_failure.py` (2 tests): running→warning→critical→failed order, post-fail emit, health ≥ 0, health pinned (passes) | [tests/test_failure.py](tests/test_failure.py) | V2.1 |
| V2.8 | ✅ | tsc clean, build ok; live progression verified running→warning→critical→failed (hydraulic 0.567→0.20, crossed @cycle 675); screenshot `docs/screenshots/v2_failed_state.png`. Full suite running. | — | V2.1–V2.7 |

## V3 — Replacement-date sanity audit

| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V3.1 | ✅ | 3 tests: 4000 cpd p50 50000 → 2026-06-05 / 12 days; negative→today/0 days; 2M→500 days (>365). All pass. | [tests/test_urgency.py](tests/test_urgency.py) | — |
| V3.2 | ✅ | `formatReplacement(days, dateISO, failed)` → `{kind, gauge, long, date}` (overdue / far / normal) | [web/src/lib/replacement.ts](web/src/lib/replacement.ts) | — |
| V3.3 | ✅ | Applied in gauge center, gauge dialog (date + "Time remaining"), worst-component footer | [web/src/components/ComponentGauge.tsx](web/src/components/ComponentGauge.tsx), [web/src/App.tsx](web/src/App.tsx) | V3.2 |
| V3.4 | ✅ | Edge-case wording captured in VISUAL_UPGRADE_PLAN.md V3 (written into docx in V5.6) | (notes → V5) | V3.2 |
| V3.5 | ✅ | tsc clean, build ok; screenshots `v3_over_one_year.png` (cpd=3 → ">1 yr", green/monitor) + `v3_overdue.png` (cpd=1e7 → OVERDUE, red). Full V3 suite pending. | — | V3.1–V3.3 |

## V4 — Visual overhaul  *(web-only; sequential A→B→C→D — no git repo for worktree lanes)*

### Lane A — Color + typography + tokens + header
| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V4.A1 | ✅ | `tokens.css` — semantic palette (deep slate-blue base, sky-400 accent, distinct grey-red `--color-failed`) | [web/src/styles/tokens.css](web/src/styles/tokens.css) | — |
| V4.A2 | ✅ | `index.css` imports tokens; shadcn HSL vars remapped to palette; Inter body font + fade-in util | [web/src/index.css](web/src/index.css) | V4.A1 |
| V4.A3 | ✅ | `@fontsource-variable/inter` + `/jetbrains-mono` deps + imports; Tailwind `fontFamily` sans/mono + semantic color tokens | [web/package.json](web/package.json), [web/src/main.tsx](web/src/main.tsx), [web/tailwind.config.js](web/tailwind.config.js) | V4.A1 |
| V4.A4 | ✅ | Header polish: brand block, status badge+dot, **mono cycle counter**, Live/Offline indicator, subtle Reset. (Settings gear deferred to V4.C4 to ship with its drawer.) | [web/src/App.tsx](web/src/App.tsx) | V4.A2, V4.A3 |
| V4.A5 | ✅ | tsc clean, build ok; screenshot `docs/screenshots/v4_laneA.png` | — | V4.A4 |

### Lane B — Gauges + detail dialog + RUL band
| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V4.B1 | ✅ | Custom 270° **SVG arc gauge** (CSS stroke-dasharray transition); center **health% BIG → days → urgency**; 5 distinct states incl. failed lock | [web/src/components/ComponentGauge.tsx](web/src/components/ComponentGauge.tsx) | Lane A |
| V4.B2 | ✅ | Dialog: p10/p50/p90 stat cards (p50 accented), axis-labeled band, replacement date/time, plain-English Info footer | [web/src/components/ComponentGauge.tsx](web/src/components/ComponentGauge.tsx) | V4.B1 |
| V4.B3 | ✅ | RULBand: sky gradient, failure line at **RUL 0** (cycles — fixed health/cycles unit mismatch chart-junk), units, tooltip, `showAxisLabels`, empty state | [web/src/components/RULBand.tsx](web/src/components/RULBand.tsx) | Lane A |
| V4.B4 | ✅ | tsc clean, build ok; screenshots `v4_laneB_dash.png` + `v4_laneB_dialog.png` | — | V4.B1–V4.B3 |

### Lane C — Quality + process charts + fault controls + settings drawer
| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V4.C1 | ✅ | QualityCard: semantic good=success / acceptable=warning / waste=critical, smoother `transition-[width]` bars, label pill + empty state | [web/src/components/QualityCard.tsx](web/src/components/QualityCard.tsx) | Lane A |
| V4.C2 | ✅ | ProcessCharts: cohesive token line colors, faint horizontal gridlines, units per trace, empty state | [web/src/components/ProcessCharts.tsx](web/src/components/ProcessCharts.tsx) | Lane A |
| V4.C3 | ✅ | Collapsible **"Demo controls"** (default collapsed, muted, "not production controls") wrapping FaultButtons + speed slider; FaultButtons restyled muted/critical | [web/src/components/FaultButtons.tsx](web/src/components/FaultButtons.tsx), [web/src/App.tsx](web/src/App.tsx) | Lane A |
| V4.C4 | ✅ | `ui/sheet.tsx` (radix-dialog side variant, no new dep) + `SettingsDrawer.tsx` (cpd editor, shift presets, live day calc) + api.ts get/setSettings + header gear | [web/src/components/ui/sheet.tsx](web/src/components/ui/sheet.tsx), [web/src/components/SettingsDrawer.tsx](web/src/components/SettingsDrawer.tsx), [web/src/api.ts](web/src/api.ts), [web/src/App.tsx](web/src/App.tsx) | Lane A |
| V4.C5 | ✅ | tsc clean, build ok; screenshots `v4_laneC_dash.png`, `v4_laneC_demo.png`, `v4_laneC_settings.png` | — | V4.C1–V4.C4 |

### Lane D — Empty/loading/error states + micro-interactions
| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V4.D1 | ✅ | Empty/loading states: ComponentGrid skeleton gauges; "Waiting for forecast/quality/process curves…" in RULBand/Quality/ProcessCharts | [web/src/components/ComponentGrid.tsx](web/src/components/ComponentGrid.tsx), RULBand, QualityCard, ProcessCharts | Lanes A–C |
| V4.D2 | ✅ | Disconnected state: header "Offline" indicator + amber "Connection lost — reconnecting…" banner | [web/src/App.tsx](web/src/App.tsx) | Lanes A–C |
| V4.D3 | ✅ | Micro-interactions: hover (gauges/buttons/toggle), accessible `focus-visible` rings (accent), `animate-imm-in` fade-in on main grid | [web/src/index.css](web/src/index.css), [web/src/App.tsx](web/src/App.tsx), components | Lanes A–C |
| V4.D4 | ✅ | Responsive verified @ 1600×1000 and **1920×1080** — layout holds, good whitespace | `docs/screenshots/v4_laneD_1920.png` | V4.D1–V4.D3 |
| V4.D5 | ✅ | tsc clean, build ok; screenshots `v4_laneD_loading.png` (no-WS), `v4_final_healthy.png`; full suite running | — | V4.D1–V4.D4 |

## V5 — Glossary + updated overview doc  *(after V1–V4 stable)*

| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| V5.1 | ✅ | Rewrote `capture_screenshots.py`: drives healthy→warning→critical→failed via API + polls machine_state; captures reset dialog, settings drawer, detail dialog | [scripts/capture_screenshots.py](scripts/capture_screenshots.py) | V4 |
| V5.2 | ✅ | Regenerated `docs/screenshots/*` (01_dashboard, 02_gauge_dialog, reset_confirm, settings_drawer, state_warning/critical/failed, 03_with_fault) + `dashboard_annotated.png` (PIL callouts) | docs/screenshots | V5.1 |
| V5.3 | ✅ | Glossary §10 — 11 terms × (technical / plain English / factory-floor) | [scripts/build_overview_doc.py](scripts/build_overview_doc.py) | V4 |
| V5.4 | ✅ | §11 "Reading the dashboard at a glance" — annotated screenshot, callouts 1–8, 4-bullet decision tree | [scripts/build_overview_doc.py](scripts/build_overview_doc.py) | V5.2 |
| V5.5 | ✅ | §12 "Visual design system" — 12 shaded palette swatches + type scale + spacing rules | [scripts/build_overview_doc.py](scripts/build_overview_doc.py) | V4 |
| V5.6 | ✅ | §13 "What happens when the machine fails" (V2) + §14 "Replacement-date edge cases" (V3) | [scripts/build_overview_doc.py](scripts/build_overview_doc.py) | V2, V3 |
| V5.7 | ✅ | Regenerated `docs/PROTOTYPE_OVERVIEW.docx` (verified: §§10–14 present, 12 swatch fills) | docs/PROTOTYPE_OVERVIEW.docx | V5.1–V5.6 |

## Final — single runnable deliverable

| ID   | Status | Description | Files touched | Depends on |
|------|--------|-------------|---------------|------------|
| F.1 | ✅ | `demo.sh` — idempotent: venv→install, train if no models, build if no dist, serve, print URL. Verified end-to-end on idempotent path (skips setup, serves on :8123, snapshot+index 200). | [demo.sh](demo.sh) | V1–V5 |
| F.2 | ✅ | `demo.bat` — same behavior, cmd-flavored (NEED_TRAIN flag, `call npm`, pushd/popd). Syntax reviewed (not run — no Windows host). | [demo.bat](demo.bat) | F.1 |

## Post-delivery enhancements (after V1–V5)

| ID  | Status | Description | Files |
|-----|--------|-------------|-------|
| PD.1 | ✅ | `ws:// → wss://` when page is HTTPS — fixes the live stream over a Cloudflare tunnel (caught via tunnel screenshot) | [web/src/api.ts](web/src/api.ts) |
| PD.2 | ✅ | `demo.sh --tunnel` / `demo.bat --tunnel` — auto-download cloudflared, open a quick tunnel (`--protocol http2`, since QUIC is often firewalled), print a temporary public URL | [demo.sh](demo.sh), [demo.bat](demo.bat), [.gitignore](.gitignore) |
| PD.3 | ✅ | Default `cycles_per_day` 4000 → **40** so a healthy machine reads schedule/monitor (green/cyan), not "critical" (explains health-vs-urgency) | [run.py](run.py) |
| PD.4 | ✅ | Launcher builds with **`VITE_ENABLE_3D=true`** so the 3-D twin shows by default | [demo.sh](demo.sh), [demo.bat](demo.bat) |
| PD.5 | ✅ | **Guided tooltips everywhere** — reusable `InfoHint` (ⓘ icon) + `Hint` (wrap) on a `TooltipProvider`. Header (state/cycle/live/reset/settings), every card title ("how to read"), per-gauge action guidance, p10/p50/p90, quality pill+bars, each process curve, each fault, speed, cycles-per-day, 2-D twin blocks. Verified hover + no click regression. | [web/src/components/InfoHint.tsx](web/src/components/InfoHint.tsx), [App.tsx](web/src/App.tsx), ComponentGauge, QualityCard, ProcessCharts, FaultButtons, SettingsDrawer, Twin2D |
| PD.6 | ✅ | Screenshots + docx regenerated at the new defaults (3-D + cpd=40) | docs/screenshots, [scripts/*](scripts/) |

---

## Cross-cutting notes
- **Sequence:** V1 → V2 → V3 (backend, build on each other) → V4 (web-only, A→B→C→D) → V5 (docs) → demo scripts.
- **Hard rules:** no `src/ml/*` model/training changes; no new heads/anomaly; no Docker/brokers/db/auth; 3-D twin behavior unchanged.
- **Only new deps:** Fontsource (Inter + JetBrains Mono). shadcn Sheet + confirm built on existing `@radix-ui/react-dialog` (no new radix pkg). Framer Motion reserved but expected unused.
- **Frontend has no test harness** — `tsc --noEmit && vite build` + screenshots are the only regression net for V4. Gate every lane on a clean build.
- **Stop-and-report** after each priority (V1–V5).
