"""P1.4 — held-out [p10,p90] coverage ≥ 70% per component."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from sklearn.ensemble import GradientBoostingRegressor as _GBR

from scripts.generate_training_data import simulate_machine
from src.simulator.degradation import BASE_WEAR

COMPONENTS = list(BASE_WEAR.keys())
COVERAGE_FLOOR = 0.70


class FastGBR(_GBR):
    def __init__(self, **kwargs):
        kwargs["n_estimators"] = 40
        super().__init__(**kwargs)


@pytest.fixture(scope="module")
def trained_artifact(monkeypatch_module):
    import src.ml.train_rul as train_rul_mod

    monkeypatch_module.setattr(train_rul_mod, "GradientBoostingRegressor", FastGBR)

    n_train_machines = 10
    holdout_id = "HOLD-000"
    cycles = 800

    train_records: list[dict] = []
    for i in range(n_train_machines):
        train_records.extend(
            simulate_machine(f"TRN-{i:03d}", cycles, seed=i * 137 + 42, machine_index=i)
        )
    holdout_records = simulate_machine(holdout_id, cycles, seed=9001)

    df_train = pd.DataFrame(train_records)
    df_hold  = pd.DataFrame(holdout_records)

    out = Path("/tmp/_rul_calib.pkl")
    artifact = train_rul_mod.train(df_train, out)
    return artifact, df_hold


@pytest.fixture(scope="module")
def monkeypatch_module(request):
    from _pytest.monkeypatch import MonkeyPatch
    mp = MonkeyPatch()
    request.addfinalizer(mp.undo)
    return mp


@pytest.mark.parametrize("comp", COMPONENTS)
def test_p14_coverage_per_component(trained_artifact, comp):
    artifact, df_hold = trained_artifact
    comp_art = artifact["components"][comp]
    feat_cols = comp_art["feature_cols"]
    target_col = f"rul_{comp}_cycles"

    y_true = df_hold[target_col].values.astype(float)
    mask = np.isfinite(y_true)
    assert mask.sum() >= 50, f"too few finite RUL targets for {comp}: {mask.sum()}"
    X = df_hold[feat_cols].values[mask]
    y_true = y_true[mask]

    p10 = comp_art["models"]["p10"].predict(X)
    p90 = comp_art["models"]["p90"].predict(X)
    inside = (y_true >= p10) & (y_true <= p90)
    coverage = float(inside.mean())

    print(f"[P1.4] {comp}: coverage={coverage:.3f}  (n={len(y_true)})")
    assert coverage >= COVERAGE_FLOOR, (
        f"{comp} coverage {coverage:.3f} below floor {COVERAGE_FLOOR}"
    )
