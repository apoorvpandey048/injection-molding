# TASKS — IMM Digital Twin Platform

> Traceable task tracker. Source of truth for *what* and *why* is
> [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); this file tracks status. Status:
> ☐ planned · ◑ in progress · ☑ done. Updated continuously through implementation.
> (Prior prototype tasks are preserved in git history.)

**Legend — brief requirement column** links each task to the section of `prompt.md`
it satisfies, so every requirement is traceable to a task and vice-versa.

---

## Phase 0 — Architecture review

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T0.1 | ARCHITECTURE.md | Phase 0 | ☑ |
| T0.2 | UI_STRATEGY.md | Phase 0 / Visual Design | ☑ |
| T0.3 | DECISIONS.md | Phase 0 | ☑ |
| T0.4 | RISK_REGISTER.md | Phase 0 | ☑ |
| T0.5 | DEPLOYMENT.md | Phase 0 / Deployment Workflow | ☑ |
| T0.6 | IMPLEMENTATION_PLAN.md (phased, acceptance, tests) | Phase 0 / Implementation Approach | ☑ |
| T0.7 | TASKS.md (traceable) | Phase 0 | ☑ |

---

## Phase 1 — Platform shell & live data

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T1.1 | Promote workbench→platform app; add Recharts + Radix deps | System Architecture | ☑ |
| T1.2 | Port data layer (IMMClient, useSnapshot, Snapshot type) | Collaborative/Deployment | ☑ |
| T1.3 | Extend store: snapshot, connected, mode, selectedSubsystem, history | System Architecture | ☑ |
| T1.4 | Command Center layout shell (AppBar/Rail/Viewer/ContextPanel/StatusBar) | 3D Digital Twin Viewer | ☑ |
| T1.5 | Viewer renders model.dae; orbit/pan/zoom/fit/reset/gizmo | 3D Digital Twin Viewer | ☑ |
| T1.6 | Operations ⇄ Inspection mode toggle | Inspection Mode | ☑ |

---

## Phase 2 — Component Mapping & Health Engines

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T2.1 | Spatial + name-hint classifier (deterministic, complete) | Component Mapping Engine | ☑ |
| T2.2 | map:generate script + committed component-map.detailed.json + loader | Component Interaction | ☑ |
| T2.3 | identity.ts (Subsystem↔backend key↔color↔fault) | Component Interaction | ☑ |
| T2.4 | Health Engine: per-subsystem health/status/trend | Component Health Engine | ☑ |
| T2.5 | applyVisuals health-tint channel + selected emphasis | Component Interaction / Performance | ☑ |
| T2.6 | Subsystem Rail (color, live health, hover→highlight, click→focus) | Component Interaction | ☑ |
| T2.7 | Camera frameSubsystem cinematic focus + persistent pose | 3D Digital Twin Viewer | ☑ |

---

## Phase 3 — Context Panel, charts, tooltips

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T3.1 | Context Panel = active subsystem (health/RUL/status/failP/rec/sensors/trend) | Component Health Panel | ☑ |
| T3.2 | Threshold model shared by charts + tooltips | Graph System / Tooltips | ☑ |
| T3.3 | Chart toolkit: crosshair, threshold regions, forecast, failure marker | Graph System | ☑ |
| T3.4 | Charts: RUL band, sensor curve, health trend, quality | Graph System | ☑ |
| T3.5 | Explain system (What/Reading/Action, data-derived) | Intelligent Tooltips | ☑ |
| T3.6 | Tooltips across metrics/points/sensors/subsystems/state/controls | Intelligent Tooltips | ☑ |

---

## Phase 4 — Inspection mode integration

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T4.1 | Host workbench panels in Inspection layout (one store, one scene) | Inspection Mode | ☑ |
| T4.2 | Mesh pick/select/isolate/wireframe/x-ray/edges/search | Inspection Mode | ☑ |
| T4.3 | Mapping editor: assign/clear/group, export, POST persist | Inspection Mode / Deployment | ☑ |
| T4.4 | Import + round-trip + stale-ID tolerance | Deployment | ☑ |
| T4.5 | Camera + selection continuity across modes | 3D Digital Twin Viewer | ☑ |

---

## Phase 5 — Determinism, persistence, collaboration, cutover

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T5.1 | Backend file persistence: /api/settings + /api/component-map (atomic write, load-on-boot) | Deployment Workflow | ☑ |
| T5.2 | Collaboration: URL-hash session state (mode + selected subsystem) | Collaborative Review | ☑ |
| T5.3 | run.py cutover (WEB_DIR→workbench/dist, /map route, env-rollback); demo.sh builds platform | Deployment Workflow | ☑ |
| T5.4 | Docs: README + PROTOTYPE_OVERVIEW.docx (22 figures) + screenshot gallery | Deployment | ☑ |
| T5.5 | Final validation pass (laptop ☑ via headless browser; tunnel pending) | Deployment Workflow | ◑ |

## Phase 6 — Industry-ready polish (post-review)

| ID | Task | Brief req | Status |
|----|------|-----------|--------|
| T6.1 | Responsive desktop layout (fluid panels, viewer ≥55% from 1280px) + "Viewing·" badge | Visual Design / Performance | ☑ |
| T6.2 | File-first component-map precedence (determinism over stale localStorage) | Deployment Workflow | ☑ |
| T6.3 | Rebalanced spatial classifier (every subsystem visibly present; Drive 8→57) | Component Mapping Engine | ☑ |
| T6.4 | Tighter camera framing (Bounds margin 1.25→1.12) | 3D Digital Twin Viewer | ☑ |
| T6.5 | Commit trained models for friction-free DGX boot (.gitignore exception) | Deployment Workflow | ☑ |
| T6.6 | DGX quickstart + shareable-link workflow documented | Collaborative Review / Deployment | ☑ |
| T6.7 | Comprehensive re-verification + 22 fresh screenshots | Implementation Approach | ☑ |

> **Scope notes (honest status):**
> - T5.1 persists `cycles_per_day` and the component map. Per-threshold overrides
>   (`/api/config`) are a documented future extension — thresholds are currently
>   fixed constants from `degradation.py`.
> - T5.2 shares mode + selected subsystem in the URL hash; camera-pose sharing is a
>   future extension (D-09).
> - T5.5: validated on the laptop with a headless-Chromium smoke test (model loads,
>   subsystem hover/select + camera focus, detail panel, charts, mode switch, map
>   persistence round-trip all pass). The `--tunnel` path is unchanged plumbing but
>   was not exercised in this environment.
> - Pre-existing: `tests/test_simulator.py::test_at5_heater_drift_barrel_temp` fails
>   on `main` independent of this work (simulator untouched) — a borderline
>   stochastic assertion in the heater-drift fault. Left as-is (not in scope).

---

## Requirement → task coverage (brief checklist)

| Brief requirement | Tasks |
|-------------------|-------|
| Modular architecture (9 modules) | ARCHITECTURE §3; T1.*–T5.* |
| 3D viewer as primary experience | T1.4, T1.5, T2.7 |
| Orbit/pan/zoom/reset/fit/focus/transitions/persistent | T1.5, T2.7, T4.5 |
| Component interaction (hover/highlight/click/focus/details) | T2.6, T3.1, T4.2 |
| Subsystem visual identity (5 colors) | T2.3, T2.5 |
| Component health panel = active context | T3.1 |
| Intelligent tooltips (what/good-bad/action) | T3.5, T3.6 |
| Graph system (crosshair/thresholds/forecast/markers) | T3.2, T3.3, T3.4 |
| Inspection mode (selection/hierarchy/isolation/wireframe/search/editor) | T4.1–T4.4 |
| Collaborative review | T5.2 |
| Deterministic deployment + persistence | T5.1, T5.3, D-07 |
| Performance (60 FPS) | T2.5 (imperative reconcile), R-01 |
| Always-deployable / never break | D-08, T5.3 (cutover last) |
