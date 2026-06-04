# DEPLOYMENT — IMM Digital Twin Platform

> Principle: **clone → pull → start → it works.** No retraining, no re-mapping, no
> manual recreation. Deterministic and reproducible across the developer laptop and
> the DGX.

---

## 1. Topology

```
 Developer laptop                Git remote               DGX (GPU host)
 ────────────────                ──────────               ──────────────
 edit · validate · commit  ──►   origin/main   ──►   pull · install · start
        │                                                     │
        │                                            run.py (aiohttp :PORT)
        │                                                     │
        └───────────────── review via ◄────── Cloudflare Tunnel (public https)
                           same SPA
```

One server (`run.py`) serves the SPA, the WebSocket stream, the REST API, the 3D
model, and the component map. Remote reviewers hit the same app via the tunnel.

---

## 2. What is committed (so nothing must be recreated)

| Artifact | Path | Why committed |
|----------|------|---------------|
| 3D model + textures | `*/public/models/model.dae`, `model/` | the twin geometry |
| **Component map (source of truth)** | `public/map/component-map.detailed.json` | subsystem↔mesh, no re-mapping |
| Backend default config | `config/platform.json` (created on first write; safe defaults baked into `run.py`) | thresholds, cycles/day, UI defaults |
| Trained ML models | `artifacts/models/{quality,rul}.pkl` | **committed** (D-13) → no retraining on clone; still regenerable via `make train` (fixed seed) |
| Simulator seed | `seed=42` in `run.py` | reproducible cycles |

Persistence at runtime is to **files** (atomic write: temp + rename), schema-validated
on load with safe fallbacks. No database is required for the demo; TimescaleDB/Postgres
in `infra/` is an optional upgrade.

### Persisted state categories (brief §"Store")
- component mappings → `public/map/component-map.detailed.json` (+ user edits POSTed back)
- assignments → embedded in the component map
- UI settings → `config/platform.json` (+ per-reviewer `localStorage`)
- thresholds → `config/platform.json`
- configuration (cycles/day, etc.) → `config/platform.json`

---

## 3. Developer workflow (laptop)

> The platform app lives in **`workbench/`** (the unified app; the legacy dashboard
> is `web/`). `run.py` serves `workbench/dist`.

```bash
# 1. validate
make test                      # pytest (simulator, RUL calibration, urgency, reset)
cd workbench && npm ci && npm run build && cd ..   # typecheck + production build

# 2. (only if the model/classifier changed) regenerate the committed component map:
#    delete it and load the app once — the classifier re-derives it and POSTs it back.
rm -f workbench/public/map/component-map.detailed.json   # then open the app once

# 3. commit + push
git add -A && git commit -m "…" && git push
```

The build is the gate: a red `tsc`/`vite build` blocks the commit. CI-equivalent is
`make test` + `npm run build`.

---

## 4. DGX workflow (deterministic boot)

```bash
git pull
./demo.sh                      # idempotent: venv → (train if missing) → build SPA → serve
#   or expose publicly:
./demo.sh --tunnel             # + Cloudflare tunnel, prints the public https URL
```

`demo.sh` is **idempotent**:
1. create `.venv`, `pip install -e .` (skips if present);
2. if `artifacts/models/{quality,rul}.pkl` missing → generate synthetic data + train
   (fixed seed) — **once**; present ⇒ skipped (no retraining);
3. build the SPA (`npm ci && npm run build`) — the platform app;
4. start `run.py` on `PORT` (default 8000);
5. with `--tunnel`, start `cloudflared` and surface the URL.

Result: a clone that has never run the platform comes up identical to the
developer's, with the same map, thresholds, and behavior.

---

## 5. Build & serve wiring

- **Build output**: `workbench/dist` (Vite).
- **run.py**: `WEB_DIR` resolves to `workbench/dist` (fallbacks: `web/dist`,
  `workbench/public`, `web/public`). The env override `WEB_DIR=web/dist` rolls back
  to the legacy dashboard instantly (R-12).
- **Static routes**: `/assets/*`, `/models/*` (the DAE + textures),
  `/map/component-map.detailed.json` (the component map). Served from the dist dir /
  the committed map path.
- **3D**: the platform's twin is always on (it *is* the platform); the old
  `VITE_ENABLE_3D` gate is retired.

### Cutover — done (D-08 / R-12)
The cutover is complete: `run.py` serves `workbench/dist` and `demo.sh` builds
`workbench/`. Rollback remains a single reversible step: `WEB_DIR=web/dist`.

---

## 6. Endpoints (unchanged contract + additions)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | SPA index |
| GET | `/ws` | live cycle snapshot stream |
| GET | `/api/snapshot` | latest snapshot (poll fallback) |
| POST | `/api/fault` | inject/clear a demo fault |
| POST | `/api/reset` | reset simulator |
| POST | `/api/speedup` | sim clock speed |
| GET/POST | `/api/settings` | cycles/day (persisted to `config/platform.json`) |
| GET/POST | `/api/component-map` | read / save the active component map (persisted) |
| GET | `/models/*`, `/map/*`, `/assets/*` | static |

> `/api/config` (per-threshold + UI overrides) is a documented future extension —
> thresholds are currently fixed constants from `degradation.py`.

The WebSocket snapshot JSON is **unchanged** — no frontend/backend contract break.

---

## 7. Environment

`.env.example` documents the full production stack (MQTT, TimescaleDB, MinIO,
MLflow, JWT). For the demo only `PORT` is required; everything else has safe
defaults. Real-source / DB / auth wiring is additive (ARCHITECTURE §8).

| Var | Default | Use |
|-----|---------|-----|
| `PORT` | 8000 | server port |
| `WEB_DIR` | `workbench/dist` | served SPA dir (rollback lever) |
| `CONFIG_PATH` | `config/platform.json` | persisted config file |
| `MAP_DIR` | `workbench/public/map` | active component map directory |

---

## 8. Validation per deploy (smoke test)

1. App loads; twin renders `model.dae`; 5 subsystems colored in the rail.
2. Live badge green; cycle counter increments.
3. Hover a subsystem → meshes highlight; click → camera focuses, panel updates.
4. Inject a fault → that subsystem's health falls, mesh reddens, alert appears,
   forecast marker moves.
5. Switch to Inspection → hierarchy + isolate + wireframe work; mapping editor
   saves; re-export round-trips.
6. Reload → camera pose, selection, mode, settings restored.
7. `--tunnel` → public URL opens the identical app for a remote reviewer.

A failure in any step blocks the cutover (D-08).

---

## 9. DGX quickstart (investor demo) — clone, run, share

The platform is committed so a DGX clone needs **no retraining and no re-mapping**.

```bash
# one time
git clone https://github.com/apoorvpandey048/injection-molding.git
cd injection-molding

# run + expose a temporary public https link (Cloudflare quick tunnel)
./demo.sh --tunnel
#   → prints:  Public demo URL:  https://<random>.trycloudflare.com
#   share that link with investors; it serves the exact same live platform
```

- **Relaunch** any time with the same command — `demo.sh` is idempotent: the venv,
  models and frontend build are reused if present, so subsequent starts are immediate.
- **Local only:** `./demo.sh` (serves `http://localhost:8000`). **Custom port:**
  `PORT=9000 ./demo.sh`.
- **Shareable view:** append `#mode=operations&sub=Mold` (or any subsystem) to the
  URL to drop a viewer straight into a specific subsystem's context (D-09).
- **Committed for determinism:** trained models (`artifacts/models/*.pkl`, D-13), the
  component map (`public/map/…`), default config (`config/platform.json`), the model
  + textures. First run does one-time venv setup only.
- **Rollback lever:** `WEB_DIR=web/dist ./demo.sh` serves the legacy dashboard.

Requirements on the DGX: Python ≥ 3.11, Node.js + npm, and outbound internet on the
first run (pip/npm) and for the tunnel. The tunnel uses an anonymous
`trycloudflare.com` quick tunnel — no Cloudflare account needed.
