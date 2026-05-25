# Architecture

See [docs/plan.md](plan.md) for the full implementation plan and
[docs/adr/0001-channel-set.md](adr/0001-channel-set.md) for the locked
channel taxonomy.

## Three-layer PdMDT framework (Zhou et al. 2023)

```
┌─────────────────────────────────────────────────────────────────┐
│ Service Decision Layer                                          │
│   maintenance svc · alert engine · rules → recommendations      │
│   dashboard (Next.js) · 3D twin (R3F)                           │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│ State Judgement Layer                                           │
│   prediction svc: anomaly (OC-SVM + DBSCAN + AE majority vote)  │
│                   quality (LightGBM)                            │
│                   health (XGBoost + SHAP)                       │
│                   RUL (RF + XGBoost ensemble)                   │
│   twin state svc (snapshot aggregator)                          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│ Data Collection Layer                                           │
│   simulator → MQTT → telemetry (cycle segmentation)             │
│   → feature svc (tsfresh + CWT + entropy/RMS/crest)             │
│   → TimescaleDB + MinIO (curves)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Topic plane

| Topic                       | Producer        | Payload schema              |
|-----------------------------|-----------------|-----------------------------|
| `imm/<id>/raw`              | simulator       | `RawSamplePacket`           |
| `imm/<id>/cycle`            | telemetry svc   | `CycleEvent`                |
| `imm/<id>/feat`             | feature svc     | `FeatureEvent`              |
| `imm/<id>/pred`             | prediction svc  | `PredictionEvent`           |
| `imm/<id>/alert`            | maintenance svc | `AlertEvent`                |
| `imm/<id>/health` (admin)   | simulator       | `GroundTruthHealth`         |

Schemas live in `packages/common/imm_common/messages.py`.

## Retraining (Rousopoulou et al. 2020 — double-oriented trigger)

Retraining fires when either:
1. **Data-driven**: KS test on rolling feature window vs. training distribution
   exceeds threshold for ≥N consecutive cycles.
2. **Model-based**: rolling precision / F1 against acknowledged alerts drops
   below a margin.

Shadow deployment for ≥1 week before promotion.
