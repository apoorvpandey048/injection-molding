"""P1.7 — schema/sanity test for per-component RUL predictor."""
from __future__ import annotations

import pickle
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from sklearn.ensemble import GradientBoostingRegressor as _GBR

from scripts.generate_training_data import simulate_machine
from src.simulator.degradation import BASE_WEAR

COMPONENTS = list(BASE_WEAR.keys())
QUANTILES = ("p10", "p50", "p90")
FORBIDDEN_FEATURE_TOKENS = ("health", "fault_pressure", "rul_", "fsm")


class FastGBR(_GBR):
    def __init__(self, **kwargs):
        kwargs["n_estimators"] = 20
        super().__init__(**kwargs)


@pytest.fixture(scope="module")
def monkeypatch_module(request):
    from _pytest.monkeypatch import MonkeyPatch
    mp = MonkeyPatch()
    request.addfinalizer(mp.undo)
    return mp


@pytest.fixture(scope="module")
def artifact_and_cycle(monkeypatch_module):
    import src.ml.train_rul as train_rul_mod

    monkeypatch_module.setattr(train_rul_mod, "GradientBoostingRegressor", FastGBR)

    train_records: list[dict] = []
    for i in range(5):
        train_records.extend(
            simulate_machine(f"SCH-{i:03d}", 400, seed=i * 17 + 3, machine_index=i)
        )
    df_train = pd.DataFrame(train_records)
    artifact = train_rul_mod.train(df_train, Path("/tmp/_rul_schema.pkl"))

    sample_records = simulate_machine("SCH-SAMPLE", 50, seed=999, machine_index=0)
    cycle_feats = {k: v for k, v in sample_records[-1].items() if not k.startswith("rul_")}
    cycle_feats.pop("machine_id", None)
    cycle_feats.pop("cycle_index", None)
    return artifact, cycle_feats


def test_artifact_has_all_five_components(artifact_and_cycle):
    artifact, _ = artifact_and_cycle
    assert set(artifact["components"].keys()) == set(COMPONENTS), (
        f"expected {COMPONENTS}, got {list(artifact['components'].keys())}"
    )


def test_each_component_has_three_quantile_models(artifact_and_cycle):
    artifact, _ = artifact_and_cycle
    for comp in COMPONENTS:
        models = artifact["components"][comp]["models"]
        assert set(models.keys()) == set(QUANTILES), (
            f"{comp} missing quantile models: have {list(models.keys())}"
        )


def test_quantile_ordering_p10_le_p50_le_p90(artifact_and_cycle):
    """Predictor contract: p10 <= p50 <= p90 is guaranteed by the API even when
    independent quantile GBR heads cross — predict_rul_per_component sorts."""
    from src.ml.predict import predict_rul_per_component

    artifact, feats = artifact_and_cycle
    per_comp = predict_rul_per_component(feats, artifact)
    for comp in COMPONENTS:
        p10, p50, p90 = per_comp[comp]["p10"], per_comp[comp]["p50"], per_comp[comp]["p90"]
        assert p10 <= p50 <= p90, (
            f"{comp}: quantile order broken p10={p10:.2f} p50={p50:.2f} p90={p90:.2f}"
        )


def test_features_are_observable_only(artifact_and_cycle):
    artifact, _ = artifact_and_cycle
    for comp in COMPONENTS:
        for feat in artifact["components"][comp]["feature_cols"]:
            lc = feat.lower()
            for token in FORBIDDEN_FEATURE_TOKENS:
                assert token not in lc, (
                    f"{comp}: forbidden FSM-state token {token!r} in feature {feat!r}"
                )
