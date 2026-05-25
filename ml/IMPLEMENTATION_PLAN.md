# PdM IMM Exploration — Implementation Plan

**Artifact owner:** `ml/notebooks/pdm_imm_exploration.ipynb`
**Status:** plan locked, executing
**Date:** 2026-05-20

---

## 0. Decisions resolved (Phase 0)

### 0.1 Dataset

**Primary:** NASA C-MAPSS turbofan run-to-failure (`archive.zip` at repo root → extracted to `ml/datasets/cmapss/`, gitignored).
Contents confirmed: `train_FD00{1..4}.txt`, `test_FD00{1..4}.txt`, `RUL_FD00{1..4}.txt`, `Damage Propagation Modeling.pdf`, `readme.txt`.

**Why C-MAPSS, not the platform simulator:**
`packages/simulator/imm_simulator/process_model.py` header states *"Healthy baseline only (M2). No degradation, no shock noise, no sensor faults. M5 will extend this..."* — the simulator cannot emit run-to-failure trajectories yet, so it cannot validate any RUL/health/quality technique. C-MAPSS gives us 4 fault-mode regimes (FD001 single op-cond + 1 fault, FD002 6 op-conds + 1 fault, FD003 single op-cond + 2 faults, FD004 6 op-conds + 2 faults), per-unit run-to-failure, and known paper-parity benchmarks.

**Honesty caveat:** C-MAPSS is a turbofan, not an IMM. Channel-name analogies (sensor_2 ≈ "barrel zone temp", sensor_4 ≈ "hold pressure", etc.) are **structural** (high-rate slow-drifting numeric channels with monotonic-ish degradation) — they are **not physical**. We will say so plainly in the notebook and never rename C-MAPSS columns to ADR-0001 channel names. Mapping appears once as a discussion aid, not as a code transformation.

**Deferred:** IMS bearings (vibration), simulator-emitted Tier-A curves (deferred to M5).

### 0.2 Paper → notebook section map

| Paper | Technique used from it | Notebook section |
|------|------------------------|-------------------|
| Taşçı 2023 (review) | Algorithm taxonomy framing | §1 framing prose |
| Nagorny 2017 | Cycle-curve features (peak, AUC, slope) — adapted to per-cycle features on C-MAPSS sensor windows | §4 feature engineering |
| Michiels 2022 | Quality classifier on engineered features, paper-parity bar (~99.4% acc); applied to C-MAPSS FD003/FD004 fault-mode classification | §7 quality classifier |
| Aslantas 2022 | tsfresh-style scalar feature pipeline + RFE | §4–§5 |
| Rousopoulou 2020 | OC-SVM + DBSCAN unsupervised anomaly detection | §6 anomaly ensemble |
| Nasiri 2024 | RUL regression with engineered features (RF/XGB) | §9 RUL ensemble |
| Zhou 2023 (PdMDT) | Three-layer Data → Algorithm → Service framing; KS-test drift detection | §2 framing, §10 drift |

### 0.3 Notebook outline (§1–§12)

1. **Framing & ADR alignment** — paper map, channel-analogy disclosure, success bar.
2. **Environment + reproducibility** — version dump, single global SEED.
3. **Data load + EDA** — load FD001–FD004, sanity stats, per-unit length histograms, sensor variance (drop constant sensors per Nasiri 2024).
4. **Feature engineering** — rolling-window per-unit features: tsfresh (efficient set), CWT scalogram energies (PyWavelets), Haralick GLCM on scalogram tile, entropy/RMS/crest/peak-to-peak.
5. **Feature selection** — variance threshold → RFE (RF-backed) → SHAP-mean-|value| ranking → correlation-cluster prune.
6. **Anomaly ensemble** (architecture.md commitment: OC-SVM + DBSCAN + AE majority vote, **no Isolation Forest**) — train on early-life cycles (healthy), score full trajectory; report precision/recall against fault-onset proxy.
7. **Quality classifier** (LightGBM) — fault-mode classification on FD003/FD004 (2 fault modes + healthy class). **Target ≥0.99 acc** to mirror Michiels 99.4%.
8. **Health score** (XGBoost regressor + SHAP) — predict normalized RUL ∈ [0,1]; SHAP global + per-prediction local for top features.
9. **RUL ensemble** (RF + XGBoost stacked, group-split by unit_id). **Target FD001 RMSE ≤14** (Nasiri/Zhou band).
10. **Drift detection** — KS-test sliding window + rolling-metric drop double-trigger, demoed on FD002 (regime shifts) vs FD001.
11. **Headline results table** — acc/RMSE side-by-side with paper numbers.
12. **Limitations & graduation path** — what would change to run this on real IMM Tier-A curves; which helpers in `ml/features/` graduate to `packages/feature/`.

### 0.4 Environment

- **Python:** 3.11 (matches existing `.venv` at 3.11.13 and `packages/simulator` `requires-python = ">=3.11"`). Root `pyproject.toml` will be lowered from `>=3.12` to `>=3.11` for consistency — this is the only repo-wide change.
- **Dependency declaration:** add `[project.optional-dependencies] ml = [...]` to root `pyproject.toml`. Install via `uv sync --extra ml`.
- **Deps:** numpy, pandas, scikit-learn, xgboost, lightgbm, tsfresh, pywavelets, shap, scikit-image, matplotlib, seaborn, jupyterlab, ipykernel. (mlflow optional, deferred.)
- **PyTorch:** out by default. Autoencoder for the anomaly ensemble will be a small sklearn MLPRegressor stand-in (reconstruction error on standardized features) — keeps deps light, matches "plain sklearn unless agreed".
- **Seed:** `SEED = 20260520`, set on numpy, random, sklearn `random_state=SEED`, xgb/lgbm `seed=SEED`.

### 0.5 Repo layout

```
ml/
  IMPLEMENTATION_PLAN.md       # this file
  README.md                    # quick-start
  notebooks/
    pdm_imm_exploration.ipynb  # the deliverable
  datasets/
    cmapss/                    # extracted from archive.zip, gitignored
  features/                    # reusable helpers; graduates to packages/feature later
    __init__.py
    windows.py                 # sliding-window framer
    tsfresh_feats.py
    spectral.py                # CWT + entropy + RMS + crest
    selection.py               # RFE + SHAP-rank + corr-prune
```

`ml/datasets/` already covered by existing `.gitignore` `data/` + we'll add `ml/datasets/` explicitly.

---

## 1. Success bar (paper parity)

| Task | Paper | Paper metric | Our target |
|------|-------|--------------|------------|
| Fault-mode classification (FD003) | Michiels 2022 | acc 99.4 / spec 99.7 / sens 94.7 | acc ≥ 0.99 |
| RUL regression (FD001) | Nasiri 2024 / Zhou 2023 | RMSE ~12–14 | RMSE ≤ 14 |
| Anomaly detection on healthy→fault transition | Rousopoulou 2020 | F1 ~0.85 | F1 ≥ 0.80 |

If we cannot hit a target with the agreed simple stack, we report the gap honestly and name the architectural change that would close it (e.g. LSTM, attention) rather than tuning until claims look better than they are.

## 2. Leakage rules (non-negotiable)

- Every RUL split is **GroupKFold by `unit_id`** — no unit appears in both train and test.
- Anomaly detector trains only on cycles where `RUL > 80%` of that unit's max — fault-onset cycles never seen.
- Feature scaler fitted on train fold only; transformed onto val/test.
- Explicit assertion in the notebook: `assert set(train_units) & set(test_units) == set()`.

## 3. Honesty caveats committed to the notebook

- C-MAPSS is turbofan; channel analogies to ADR-0001 IMM channels are structural, not physical. No new channel names will be invented (ADR-0001 §"future channel addition requires a follow-up ADR").
- Anomaly ensemble's "AE" component is a sklearn MLPRegressor reconstruction-error proxy, not a trained PyTorch autoencoder. Called out in §6.
- Fault-mode classification ≠ short-shot classification (Michiels) — both are multi-class quality-adjacent tasks on engineered scalar features, but the physical phenomenon differs. Stated in §7.

## 4. Execution order

- **Phase 1:** scaffold `ml/`, lower root `requires-python` to `>=3.11`, add `[ml]` extras, extract C-MAPSS, smoke-test imports. ← starting now.
- **Phase 2:** §2–§3 cells (env + EDA).
- **Phase 3:** §4–§5 cells (FE + selection).
- **Phase 4:** §6 anomaly ensemble.
- **Phase 5:** §7 quality classifier — **first paper-parity gate**.
- **Phase 6:** §8 health, §9 RUL — **second paper-parity gate**.
- **Phase 7:** §10 drift, §11 results, §12 limitations.

One cell at a time, stop after each, interpret honestly.
