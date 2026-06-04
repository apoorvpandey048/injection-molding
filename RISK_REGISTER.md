# RISK_REGISTER — IMM Digital Twin Platform

Likelihood (L) and Impact (I): Low / Med / High. Owner is the module most able to
mitigate. Status tracked through implementation.

| ID | Risk | L | I | Mitigation | Owner | Status |
|----|------|---|---|-----------|-------|--------|
| R-01 | **Model is heavy** (~8.6 MB DAE, ~1114 meshes) — slow load / sub-60 FPS | M | H | Imperative reconciliation (no per-mesh React); merge edges off during isolation; lazy outline FX; measure FPS; consider Draco/GLB re-export with named nodes as a later optimization | Viewer | Open — mitigated by inherited engine |
| R-02 | **Spatial map mislabels regions** (e.g. a hose binned as Drive) | H | M | Name-hint overrides; tunable zone boundaries; Inspection mode lets an expert correct + re-export; ship as "derived, expert-refinable", not ground truth | Mapping | Open |
| R-03 | **React 18→19 / dependency churn** breaks Radix or Recharts | M | M | Build on the workbench (already React 19); pin versions; smoke-test each panel after port; Recharts ≥2.13 / Radix latest verified for R19 | Platform | Open |
| R-04 | **Snapshot contract drift** — UI assumes fields the backend doesn't send | L | H | Contract is fixed and documented (ARCHITECTURE §5, contracts/); defensive optional-chaining; a single typed `Snapshot` shared; no backend schema change required | Data | Mitigated |
| R-05 | **Two model files diverge** — map IDs derived from a model that later changes | M | H | Map keyed to deterministic IDs from `model.dae`; importer ignores stale IDs gracefully (already implemented in exporter `parseImport`); regenerate on model change via one script | Mapping | Mitigated |
| R-06 | **Determinism breaks on DGX** — different node order ⇒ different mesh IDs | L | H | ColladaLoader is deterministic for a fixed file; IDs are name-path + sibling de-dup (stable); commit the generated map so runtime derivation is a fallback, not the source | Deployment | Mitigated |
| R-07 | **Persistence race / corruption** — concurrent config writes | L | M | Single-writer backend, atomic write (temp file + rename), schema-validated load with safe defaults | Config | Open |
| R-08 | **Tooltip overload** — explain-everything becomes noisy/slow | M | M | Delay + skip-delay grouping (already tuned: 150 ms/400 ms); structured 3-row format; only on hover, never modal; data-derived text kept terse | UI | Open |
| R-09 | **Scope creep** — nine modules, five phases in limited time | H | M | Phase gates with "always deployable" rule; TASKS.md marks done/partial/planned honestly; deliver Operations + mapping + charts + tooltips first, harden later | Platform | Active |
| R-10 | **Camera disorientation** — users get lost after focus | M | L | Always-available fit/reset, axis gizmo, smooth (not teleport) transitions, persistent pose, "you are viewing X" label in panel | Viewer | Open |
| R-11 | **Tunnel exposes controls** — remote viewer triggers faults/reset | M | M | Demo controls clearly fenced + labeled non-production; future: read-only reviewer role + auth (JWT scaffolding exists in `.env.example`) | Collab | Open |
| R-12 | **Cutover regression** — switching `run.py` to platform dist breaks prod | M | H | D-08 keeps `web/` served until platform is green; cutover is one reviewable line; keep a `WEB_DIR` env override to roll back instantly | Deployment | Planned |
| R-13 | **Health tint vs. classification color confusion** | M | L | Mode-scoped: health tint only in Operations, flat identity color only in Inspection; legend + tooltips state which is active | UI | Mitigated by D-05 |
| R-14 | **Large `component-map.detailed.json` in git** | L | L | It's a few hundred KB of IDs; acceptable. If it grows, gzip or store IDs as indices | Mapping | Accepted |
