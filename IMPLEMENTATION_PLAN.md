# IMPLEMENTATION_PLAN — IMM Digital Twin Platform

> This plan supersedes the prior prototype plan. It transitions the standalone
> Component Mapping Workbench + standalone dashboard into one **Industrial Digital
> Twin Platform**. Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md),
> [UI_STRATEGY.md](UI_STRATEGY.md), [DECISIONS.md](DECISIONS.md),
> [RISK_REGISTER.md](RISK_REGISTER.md), [DEPLOYMENT.md](DEPLOYMENT.md), and the
> traceable task list [TASKS.md](TASKS.md). (The prior prototype plan is preserved
> in git history.)

**Invariant for every phase:** the system stays **deployable**. The legacy `web/`
app remains the served app until the platform reaches parity-and-better; the
`run.py` cutover is the final, reversible step (D-08).

---

## Phase 0 — Architecture review *(this commit)*

**Objective.** Produce all planning artifacts before any implementation.
**Tasks.** Generate ARCHITECTURE, UI_STRATEGY, DECISIONS, RISK_REGISTER,
DEPLOYMENT, IMPLEMENTATION_PLAN, TASKS. Reconcile the two-model / no-map reality
(D-01, D-02). Define the module boundaries and the snapshot↔subsystem contract.
**Acceptance.** Seven artifacts exist, internally consistent, traceable to tasks.
**Manual test.** Read-through: every module in the brief maps to a module here;
every brief requirement maps to a task ID in TASKS.md.
**Deployment validation.** No code changed ⇒ existing app still deploys.

---

## Phase 1 — Platform shell & live data *(working app)*

**Objective.** Stand up the unified platform app with the Command Center layout,
the 3D viewer as hero, the live data layer, and the Operations/Inspection mode
switch — rendering real streaming data.

**Tasks.**
- T1.1 Promote `workbench/` into the platform app identity; add Recharts + Radix
  (tooltip/dialog) deps; keep React 19 + R3F.
- T1.2 Port the data layer from `web/`: `IMMClient` (`/ws` + `/api/*`),
  `useSnapshot`, the typed `Snapshot`. Add a per-subsystem history ring-buffer.
- T1.3 Extend the Zustand store: `snapshot`, `connected`, `mode`,
  `selectedSubsystem`, `hoveredSubsystem`, history.
- T1.4 Build the Command Center layout shell: `AppBar`, `SubsystemRail`,
  center `DigitalTwinViewer`, `ContextPanel`, `StatusBar`.
- T1.5 Wire the viewer to render `model.dae` (reuse `ModelScene`/`model.ts`/
  `visuals.ts`), with orbit/pan/zoom/fit/reset and the axis gizmo.
- T1.6 Operations vs Inspection mode toggle; Inspection reveals the existing
  workbench panels (hierarchy/inspector/classification).

**Acceptance.**
- Twin fills the center column; app loads and streams; Live badge reflects WS.
- Cycle counter increments; machine-state banner reflects `machine_state`.
- Mode toggle swaps Operations ⇄ Inspection without reload or camera reset.

**Manual test cases.**
1. Start backend + platform dev server → twin renders, badge green, cycles tick.
2. Kill backend → badge goes Offline, "reconnecting"; restart → recovers.
3. Toggle to Inspection → hierarchy + inspector appear; toggle back → Operations.
4. Resize window 1920→1280→1024 → viewer never below 50 %; rail collapses gracefully.

**Deployment validation.** `npm run build` (platform) green; `web/` still served by
`run.py` (no cutover yet).

---

## Phase 2 — Component Mapping & Health Engines *(working app)*

**Objective.** Consume the component map automatically and bind **live health to
geometry**: subsystems color-coded, hover/highlight, click→focus, health-tinted
meshes.

**Tasks.**
- T2.1 Mapping Engine: spatial + name-hint classifier (`classify.ts`) producing a
  complete `assignments` map; deterministic.
- T2.2 `map:generate` script + committed `public/map/component-map.detailed.json`;
  loader that prefers the committed file, falls back to runtime classify (D-02).
- T2.3 `identity.ts`: Subsystem ↔ backend key ↔ color ↔ fault id (ARCHITECTURE §5).
- T2.4 Health Engine: per-subsystem health/status/trend from the snapshot.
- T2.5 Extend `applyVisuals`: Operations health-tint channel (subsystem→health
  color lerp), selected emphasis + others dimmed (D-05).
- T2.6 Subsystem Rail: five items, identity color, live health bar, hover→3D
  highlight, click→select + `frameSubsystem` cinematic focus.
- T2.7 Camera: `frameSubsystem` command (eased focus on a subsystem's meshes),
  persistent pose.

**Acceptance.**
- Selecting Hydraulic/ScrewCheckRing/Drive/Heaters/Mold highlights the right
  region and focuses the camera.
- Mesh tint tracks live health (inject a fault → region reddens).
- Every mesh belongs to exactly one subsystem (complete partition).

**Manual test cases.**
1. Hover each rail item → corresponding meshes brighten, others dim.
2. Click Mold → camera frames the clamp/mold end; rail marks Mold active.
3. Inject `hydraulic_pump_wear` → Hydraulic meshes shift green→amber→red as health
   drops; rail health bar falls in sync.
4. Reload → committed map loads (source = file), same regions.

**Deployment validation.** Build green; map file present and valid JSON; classify
runs <50 ms; FPS ≥ 60 on orbit (R-01 check).

---

## Phase 3 — Context Panel, enterprise charts, intelligent tooltips *(working app)*

**Objective.** Make the selected subsystem the dashboard's active context, upgrade
all charts to enterprise-grade, and make the platform self-explaining.

**Tasks.**
- T3.1 Context Panel: for the selected subsystem show Health, RUL, Status, Failure
  Probability, Maintenance Recommendation, Sensor Summary, Trend Direction;
  default = machine overview rollup (D-04).
- T3.2 Threshold model (`modules/sensors/thresholds.ts`): per-metric normal/
  warning/critical bands, shared by charts and tooltips (D-06).
- T3.3 Chart toolkit: crosshair + hover values, threshold `ReferenceArea`s,
  forecast region (p10–p90 + p50), predicted-failure `ReferenceLine`/marker.
- T3.4 Charts: RUL Forecast Band (per subsystem), Sensor Curve (per channel with
  bands), Health Trend (history buffer), Quality bar.
- T3.5 Explain system (`ui/explain/`): `<Explain>` + `<MetricExplain>` with
  What / Reading / Action rows; data-derived judgments.
- T3.6 Apply tooltips across health scores, RUL, sensor readings, graph points,
  subsystems, machine state, and all controls.

**Acceptance.**
- Selecting a subsystem updates every panel and chart to that subsystem.
- Charts show threshold regions, a forecast region, and a failure marker.
- Hovering any metric/point yields a What/Reading/Action explanation true to the
  current value.

**Manual test cases.**
1. Select Drive → panel shows Drive's health/RUL/sensors; charts switch to Drive.
2. Hover the RUL chart near failure → tooltip states value, cycle, band, risk, and
   "schedule/replace" action.
3. Hover a health score of, say, 31 % → tooltip says "below maintenance window —
   schedule replacement", not generic copy.
4. Inject a fault → forecast marker moves earlier; recommendation escalates.

**Deployment validation.** Build green; no chart re-render jank; tooltips open
within delay budget; history buffer capped (no memory growth).

---

## Phase 4 — Inspection mode integration *(working app)*

**Objective.** Surface the full original workbench inside the platform: mesh
selection, hierarchy explorer, isolation, wireframe/x-ray, search, and a mapping
editor that saves back to the source of truth.

**Tasks.**
- T4.1 Host the workbench panels (Hierarchy, Inspector, Classification) in the
  Inspection layout; share the one store + one scene (no second canvas).
- T4.2 Mesh-level pick/select/isolate (I), wireframe + x-ray, edges toggle, search.
- T4.3 Mapping editor: assign selection→subsystem (hotkeys 1–5), clear, group
  assign; export detailed map; **POST to `/api/component-map`** to persist.
- T4.4 Import/round-trip an existing map; stale-ID tolerance (already in exporter).
- T4.5 Keep camera + selection continuity when switching Operations ⇄ Inspection.

**Acceptance.**
- A power user inspects internals without leaving the platform.
- Edits to the mapping persist to disk and reload as the active map.

**Manual test cases.**
1. Inspection → search "platen" → select → isolate → wireframe → x-ray → restore.
2. Re-assign a mesh from Unknown→Mold, save → reload Operations → mesh now tints
   with Mold health.
3. Export map → re-import → identical assignments (round-trip).

**Deployment validation.** Build green; POST persists atomically; corrupt-import is
rejected with a toast, not a crash.

---

## Phase 5 — Determinism, persistence, collaboration & cutover *(deployable platform)*

**Objective.** Make the platform deterministic and shareable, then cut `run.py`
over to serve it.

**Tasks.**
- T5.1 Backend persistence: `/api/settings` + new `/api/config` +
  `/api/component-map` write JSON to `config/` / `public/map/` atomically; load on
  boot with safe defaults (D-07).
- T5.2 Collaboration: encode mode + selected subsystem + camera pose in the URL
  hash; opening a shared link reproduces the view (D-09).
- T5.3 `run.py` cutover: `WEB_DIR → platform/dist` (env-overridable for rollback);
  add `/map/*` and `/config` routes; update `demo.sh` to build `platform/`.
- T5.4 Docs: refresh README + DEPLOYMENT smoke test; record screenshots.
- T5.5 Final validation pass (DEPLOYMENT §8) on laptop and via `--tunnel`.

**Acceptance.**
- Clone → `./demo.sh` → identical working platform; no retrain, no re-map.
- A shared URL reproduces a colleague's exact view.
- Cutover is reversible via `WEB_DIR`.

**Manual test cases.**
1. Fresh clone → `./demo.sh` → all DEPLOYMENT §8 steps pass.
2. Change a threshold in UI → reload → persists; check `config/platform.json`.
3. Copy URL after selecting Heaters + focusing → open in a new tab → same view.
4. `./demo.sh --tunnel` → open public URL on another device → identical app.
5. Set `WEB_DIR=web/dist` → legacy dashboard returns (rollback proven).

**Deployment validation.** `make test` green; platform build green; tunnel serves
the platform; rollback lever works.

---

## Traceability

Every task `Tx.y` above appears in [TASKS.md](TASKS.md) with a status and a link to
the brief requirement it satisfies. The nine brief modules map to ARCHITECTURE §3.
No implementation task exists without a phase, acceptance criteria, and a manual
test case here.
