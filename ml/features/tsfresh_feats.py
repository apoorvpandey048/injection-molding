"""tsfresh efficient feature-set wrappers for C-MAPSS windowed sensor data.

Provides helpers to convert (n_windows, window, n_features) arrays into the
long-form DataFrame expected by tsfresh, extract the EfficientFCParameters
feature set, impute non-finite values, and select relevant features using
the Benjamini-Hochberg procedure.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd
from tsfresh import extract_features, select_features
from tsfresh.feature_extraction import EfficientFCParameters
from tsfresh.utilities.dataframe_functions import impute

SEED = 20260520


def windows_to_long(
    X: np.ndarray,
    meta: pd.DataFrame | None,
    feature_names: Sequence[str],
) -> pd.DataFrame:
    """Convert a windowed sensor tensor into the tsfresh long-form DataFrame.

    Parameters
    ----------
    X : np.ndarray
        Array of shape ``(n_windows, window, n_features)``.
    meta : pd.DataFrame | None
        Optional per-window metadata. Currently unused for the long-form
        construction itself; accepted for API symmetry with the rest of the
        pipeline. The window ``id`` is always the positional window index.
    feature_names : Sequence[str]
        Names for the ``n_features`` channels, in the order they appear on
        the last axis of ``X``.

    Returns
    -------
    pd.DataFrame
        Long-form DataFrame with columns ``['id', 'time', <feat1>, ...]``
        where ``id`` ranges over ``0..n_windows-1`` and ``time`` over
        ``0..window-1``. Rows are sorted by ``(id, time)`` for determinism.
    """
    X = np.asarray(X)
    if X.ndim != 3:
        raise ValueError(
            f"X must have shape (n_windows, window, n_features); got {X.shape!r}"
        )
    n_windows, window, n_features = X.shape
    if len(feature_names) != n_features:
        raise ValueError(
            f"feature_names has length {len(feature_names)} but X has "
            f"{n_features} feature channels"
        )

    ids = np.repeat(np.arange(n_windows, dtype=np.int64), window)
    times = np.tile(np.arange(window, dtype=np.int64), n_windows)
    flat = X.reshape(n_windows * window, n_features)

    long_df = pd.DataFrame(flat, columns=list(feature_names))
    long_df.insert(0, "time", times)
    long_df.insert(0, "id", ids)
    long_df = long_df.sort_values(["id", "time"], kind="mergesort").reset_index(drop=True)
    return long_df


def extract_efficient(long_df: pd.DataFrame, n_jobs: int = 1) -> pd.DataFrame:
    """Extract the tsfresh EfficientFCParameters feature set from long-form data.

    Parameters
    ----------
    long_df : pd.DataFrame
        Long-form DataFrame as produced by :func:`windows_to_long`, with
        ``id`` and ``time`` columns plus one column per sensor channel.
    n_jobs : int, default 1
        Number of parallel jobs passed to ``tsfresh.extract_features``. The
        default of 1 keeps execution deterministic.

    Returns
    -------
    pd.DataFrame
        Imputed feature matrix indexed by window ``id``. Rows are sorted by
        index for determinism.
    """
    features = extract_features(
        long_df,
        column_id="id",
        column_sort="time",
        default_fc_parameters=EfficientFCParameters(),
        disable_progressbar=True,
        n_jobs=n_jobs,
    )
    impute(features)
    features = features.sort_index()
    features = features.reindex(sorted(features.columns), axis=1)
    return features


def select_relevant(
    features: pd.DataFrame,
    y,
    fdr_level: float = 0.05,
) -> pd.DataFrame:
    """Select relevant tsfresh features via the Benjamini-Hochberg procedure.

    Works for binary, multiclass, and regression targets; tsfresh dispatches
    the appropriate per-feature significance test based on the dtype of ``y``.

    Parameters
    ----------
    features : pd.DataFrame
        Feature matrix from :func:`extract_efficient`, indexed by window id.
    y : array-like
        Target vector aligned with ``features`` rows (same length and order).
    fdr_level : float, default 0.05
        Target false discovery rate for the Benjamini-Hochberg multiple
        testing correction.

    Returns
    -------
    pd.DataFrame
        Subset of ``features`` containing only the columns deemed relevant
        at the requested FDR level, sorted by column name for determinism.
    """
    y_series = pd.Series(np.asarray(y), index=features.index)
    selected = select_features(features, y_series, fdr_level=fdr_level)
    selected = selected.reindex(sorted(selected.columns), axis=1)
    return selected
