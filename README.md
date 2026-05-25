# Injection-Molding Predictive-Maintenance Digital Twin

Decide **when exactly to replace** an injection-molding machine — component by
component, neither too early (wasted life) nor too late (catastrophic failure).
A physics-style simulator drives per-component Remaining-Useful-Life (RUL)
predictions and a calibrated quality classifier; an urgency engine turns those
into calendar replacement dates; a live React dashboard surfaces it all, with an
optional interactive 3-D twin.

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

The first run trains models and builds the frontend (a few minutes); subsequent
runs detect those and start immediately. The interactive 3-D twin is built in by
default.

> **Reading the dashboard:** every gauge, chart, control, and the small ⓘ icons
> explain themselves on hover — what they mean and what to do.

## What's inside

```
src/simulator/    hidden-state cycle simulator (5 components) + injectable faults
src/datasource/   DataSource abstraction — same interface for sim and a real PLC
src/ml/           features (49 scalars), per-component RUL + quality, urgency
run.py            aiohttp server — WebSocket cycle stream + REST API
web/              Vite + React + Tailwind + shadcn + Recharts (+ optional Three.js)
scripts/          training data, model retrain, screenshots, overview-doc builder
tests/            simulator / urgency / reset / failure / RUL-calibration tests
docs/             PROTOTYPE_OVERVIEW.docx (full walkthrough), screenshots, ADRs
```

**Stack (deliberately minimal, single-laptop):** aiohttp WebSocket server,
scikit-learn models (per-component GradientBoosting quantile regressors +
calibrated 3-class classifier), Vite/React UI. No Docker, brokers, or databases.

## Manual commands (what `demo.sh` automates)

```bash
python -m venv .venv && . .venv/bin/activate && pip install -e .
python scripts/generate_training_data.py     # synthetic cycles
python scripts/retrain_models.py              # writes artifacts/models/*
cd web && npm install && VITE_ENABLE_3D=true npm run build && cd ..
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
