"""Train calibrated GBC quality classifier. Labels: good / acceptable / waste."""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import LabelEncoder

from src.ml.features import build_dataframe

FEATURE_COLS: list[str] = []  # populated lazily from first dataframe


def _label_from_row(row: pd.Series) -> str:
    cushion   = row.get("cushion_min", 6.5)
    peak_cav  = row.get("peak_cavity_pressure", 80.0)
    peak_inj  = row.get("peak_injection_pressure", 140.0)
    if cushion < 5.35 or peak_cav < 78.5 or peak_inj < 137.8:
        return "waste"
    if cushion < 6.34 or peak_cav < 79.25 or peak_inj < 139.0:
        return "acceptable"
    return "good"


def build_labels(df: pd.DataFrame) -> np.ndarray:
    return np.array([_label_from_row(df.iloc[i]) for i in range(len(df))])


def train(df: pd.DataFrame, output_path: Path, n_jobs: int = 1) -> dict[str, Any]:
    rul_cols = {c for c in df.columns if c.startswith("rul_") and c.endswith("_cycles")}
    rul_cols.add("rul_cycles")
    feature_cols = [c for c in df.columns if c not in ({"machine_id", "cycle_index"} | rul_cols)]
    X = df[feature_cols].values
    y = build_labels(df)
    groups = df["machine_id"].values

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    base_clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    gkf = GroupKFold(n_splits=min(5, len(np.unique(groups))))
    cv_splits = list(gkf.split(X, y_enc, groups=groups))

    cal_clf = CalibratedClassifierCV(base_clf, cv=cv_splits[:3], method="isotonic", n_jobs=n_jobs)
    cal_clf.fit(X, y_enc)

    artifact = {
        "model":        cal_clf,
        "label_encoder": le,
        "feature_cols": feature_cols,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        pickle.dump(artifact, f)

    return artifact
