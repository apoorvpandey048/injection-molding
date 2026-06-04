# IMM Digital Twin Platform

An **industrial Digital Twin Platform** for injection-molding predictive
maintenance. Decide **when exactly to replace** each machine subsystem — neither
too early (wasted life) nor too late (catastrophic failure). A physics-style
simulator drives per-component Remaining-Useful-Life (RUL) predictions and a
calibrated quality classifier; an urgency engine turns those into calendar
replacement dates; a **command-center** UI puts a large, interactive 3-D twin at
the center, with subsystems color-coded and health-tinted directly on the model.

**Command Center layout** — the 3-D twin is the hero. A left **Subsystem Rail**
(Hydraulic · Screw & Check Ring · Drive · Heaters · Mold) shows live health;
hovering highlights the matching meshes, clicking focuses the camera and turns
the right **Context Panel** into that subsystem's live detail (health, RUL,
failure probability, recommendation, enterprise forecast/trend charts, sensor
summary). Two modes:

- **Operations** — live monitoring, health-tinted twin, self-explaining tooltips.
- **Inspection** — the full mesh-level workbench (hierarchy, isolate, wireframe,
  x-ray, search, and a mapping editor that persists the component map).

Every metric, chart point, sensor and control explains itself on hover —
*what it is, whether it's good or bad, and what to do.* See
[UI_STRATEGY.md](UI_STRATEGY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick start

One command — idempotent (creates the venv, trains models, builds the frontend
on first run, then serves):

```bash
./demo.sh                 # serve locally → http://localhost:8000
./demo.sh --tunnel        # also open a temporary public link (Cloudflare)
PORT=9000 ./demo.sh       # choose the local port
```

Windows: `demo.bat` / `demo.bat --tunnel` (same behaviour).

**Requirements:** Python ≥ 3.11, Node.js + npm (for the frontend build), and
internet on first run (pip/npm installs; `--tunnel` downloads `cloudflared` and
opens an anonymous [trycloudflare.com](https://try.cloudflare.com) quick tunnel
over HTTPS — no Cloudflare account needed).

The first run trains models and builds the platform frontend (a few minutes);
subsequent runs detect those and start immediately. `run.py` serves the platform
build (`workbench/dist`) by default; set `WEB_DIR=web/dist` to roll back to the
legacy dashboard.

> **Reading the platform:** every gauge, chart point, sensor, control, and the
> small ⓘ icons explain themselves on hover — what they mean and what to do.
> Share a link with `#mode=operations&sub=Mold` to reproduce a colleague's exact
> view; append `&ro=1` for a **read-only** investor link (live monitoring stays
> interactive; reset/settings/fault controls are hidden). See the
> [DGX demo checklist](docs/DGX_DEMO_CHECKLIST.md).

## What's inside

```
src/simulator/    hidden-state cycle simulator (5 components) + injectable faults
src/datasource/   DataSource abstraction — same interface for sim and a real PLC
src/ml/           features (49 scalars), per-component RUL + quality, urgency
run.py            aiohttp server — WebSocket stream + REST + config/map persistence
workbench/        THE PLATFORM — React 19 + R3F twin, modules/lib + command center
  src/lib/        mapping engine (classify), identity, health/RUL, channels, visuals
  src/components/platform/   AppBar · SubsystemRail · ContextPanel · StatusBar
  src/ui/         design system: Explain tooltips + enterprise charts (Recharts)
  public/map/     component-map.detailed.json — source of truth (subsystem↔mesh)
  public/models/  model.dae (the twin geometry the map references)
web/              LEGACY dashboard — retained, no longer served (D-08)
config/           persisted platform config (cycles/day, …)
scripts/          training data, model retrain, screenshots, overview-doc builder
tests/            simulator / urgency / reset / failure / RUL-calibration tests
docs/ + *.md      planning: ARCHITECTURE, UI_STRATEGY, DECISIONS, RISK_REGISTER, …
```

**Stack (deliberately minimal, single-laptop):** aiohttp WebSocket server,
scikit-learn models (per-component GradientBoosting quantile regressors +
calibrated 3-class classifier), Vite/React UI. No Docker, brokers, or databases.

## Manual commands (what `demo.sh` automates)

```bash
python -m venv .venv && . .venv/bin/activate && pip install -e .
python scripts/generate_training_data.py     # synthetic cycles
python scripts/retrain_models.py              # writes artifacts/models/*
cd workbench && npm install && npm run build && cd ..   # build the platform
python run.py                                 # http://localhost:8000
pytest                                        # run the test suite
```

## Docs

- **`docs/PROTOTYPE_OVERVIEW.docx`** — full walkthrough: how it works, glossary,
  visual design system, how to read the dashboard, failure behaviour, a
  demonstration guide, highlights, and future work.
- `docs/architecture.md`, `docs/adr/` — design notes and the locked channel set.

The sensor channel set is fixed in [ADR-0001](docs/adr/0001-channel-set.md); do
not add or rename channels without amending the ADR.
