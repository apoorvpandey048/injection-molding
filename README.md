# Injection Molding PdM + Digital Twin Platform

Predictive maintenance and digital-twin MVP for industrial injection molding
machines (IMMs). Hybrid ML pipeline (filtering → AE features → clustering →
RF/XGBoost) on a simulated IMM, real-time anomaly + quality + health + RUL,
3D twin UI.

## Architecture (3-layer PdMDT, Zhou et al. 2023)

```
Data Collection Layer    : simulator → MQTT → telemetry → features → TimescaleDB
State Judgement Layer    : anomaly + quality + health + RUL prediction services
Service Decision Layer   : maintenance recommendations + alerts + dashboard/twin
```

See [docs/architecture.md](docs/architecture.md) and the full plan in
[docs/plan.md](docs/plan.md).

## Quick start

```bash
cp .env.example .env
make up                  # mosquitto + timescaledb + minio + mlflow
make down
```

## Layout

```
packages/      service code (simulator, telemetry, feature, prediction, ...)
ml/            datasets, FE library, training scripts, notebooks
frontend/     Next.js + React Three Fiber dashboard + 3D twin
infra/         Timescale migrations, Grafana dashboards
docs/          architecture, ADRs, runbooks
```

## Channel taxonomy

The exact sensor channel set the simulator emits is locked in
[ADR-0001](docs/adr/0001-channel-set.md), grounded in Aslantas et al. (2022)
and Rousopoulou et al. (2020). Do not add or rename channels without
amending the ADR.

## Milestones

M1 foundation · M2 simulator · M3 ingest · M4 features · M5 degradation
· M6 anomaly+quality · M7 health+RUL · M8 API+WS · M9 dashboard · M10 twin
· M11 maintenance · M12 retraining+observability

## License

TBD.
