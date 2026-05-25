"""Train 3× quantile GBR for RUL prediction (p10/p50/p90), per FSM component."""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import GroupKFold

from src.simulator.degradation import BASE_WEAR


QUANTILES = {"p10": 0.1, "p50": 0.5, "p90": 0.9}
COMPONENTS = list(BASE_WEAR.keys())


def _train_one_component(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    n_splits: int,
) -> tuple[dict[str, GradientBoostingRegressor], dict[str, float]]:
    gkf = GroupKFold(n_splits=n_splits)
    models: dict[str, GradientBoostingRegressor] = {}
    val_scores: dict[str, float] = {}

    for name, alpha in QUANTILES.items():
        reg = GradientBoostingRegressor(
            loss="quantile",
            alpha=alpha,
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )
        pinball_scores = []
        for train_idx, val_idx in gkf.split(X, y, groups=groups):
            reg.fit(X[train_idx], y[train_idx])
            preds = reg.predict(X[val_idx])
            errors = y[val_idx] - preds
            pinball = np.mean(np.where(errors >= 0, alpha * errors, (alpha - 1) * errors))
            pinball_scores.append(pinball)

        reg.fit(X, y)
        models[name] = reg
        val_scores[f"pinball_{name}"] = float(np.mean(pinball_scores))

    return models, val_scores


def _train_component_worker(
    comp: str,
    X_c: np.ndarray,
    y_c: np.ndarray,
    g_c: np.ndarray,
    n_splits: int,
) -> tuple[str, dict[str, GradientBoostingRegressor], dict[str, float]]:
    models, val_scores = _train_one_component(X_c, y_c, g_c, n_splits)
    return comp, models, val_scores


def train(df: pd.DataFrame, output_path: Path, n_jobs: int = 1) -> dict[str, Any]:
    """Train per-component quantile RUL models.

    n_jobs=1 (default) trains components sequentially — keeps test monkeypatching
    of GradientBoostingRegressor effective. n_jobs>1 trains the (independent)
    components concurrently via joblib; identical models, just faster wall-clock.
    """
    rul_cols = {"rul_cycles", *(f"rul_{c}_cycles" for c in COMPONENTS)}
    feature_cols = [c for c in df.columns if c not in ({"machine_id", "cycle_index"} | rul_cols)]
    X = df[feature_cols].values
    groups = df["machine_id"].values
    n_splits = min(5, len(np.unique(groups)))

    tasks: list[tuple[str, np.ndarray, np.ndarray, np.ndarray]] = []
    for comp in COMPONENTS:
        target_col = f"rul_{comp}_cycles"
        if target_col not in df.columns:
            raise ValueError(f"Training data missing target column {target_col!r}. Regenerate with the updated data script.")
        y = df[target_col].values.astype(float)
        finite_mask = np.isfinite(y)
        if not finite_mask.all():
            X_c, y_c, g_c = X[finite_mask], y[finite_mask], groups[finite_mask]
        else:
            X_c, y_c, g_c = X, y, groups
        tasks.append((comp, X_c, y_c, g_c))

    if n_jobs == 1:
        results = [_train_component_worker(comp, X_c, y_c, g_c, n_splits) for comp, X_c, y_c, g_c in tasks]
    else:
        from joblib import Parallel, delayed

        results = Parallel(n_jobs=n_jobs)(
            delayed(_train_component_worker)(comp, X_c, y_c, g_c, n_splits)
            for comp, X_c, y_c, g_c in tasks
        )

    components_art: dict[str, dict[str, Any]] = {}
    for comp, models, val_scores in results:
        components_art[comp] = {
            "models":       models,
            "feature_cols": feature_cols,
            "val_scores":   val_scores,
        }

    artifact = {
        "components":   components_art,
        "feature_cols": feature_cols,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        pickle.dump(artifact, f)

    return artifact
