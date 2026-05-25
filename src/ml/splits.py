"""GroupKFold split helper keyed by machine_id."""
from __future__ import annotations

from typing import Iterator, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold


def group_splits(
    df: pd.DataFrame,
    n_splits: int = 5,
) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
    """Yield (train_idx, val_idx) arrays split by machine_id column."""
    groups = df["machine_id"].values
    gkf = GroupKFold(n_splits=n_splits)
    X_dummy = np.zeros(len(df))
    for train_idx, val_idx in gkf.split(X_dummy, groups=groups):
        yield train_idx, val_idx
