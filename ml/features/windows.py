"""Sliding-window framer for C-MAPSS per-unit time-series.

Utilities for building fixed-length windows from per-unit trajectories,
plus helpers to derive Remaining Useful Life (RUL) labels and to extract
the final window per unit (C-MAPSS test-set style).
"""

from __future__ import annotations

from typing import Iterable, Mapping, Optional, Tuple

import numpy as np
import pandas as pd


def _resolve_feature_cols(
    df: pd.DataFrame,
    unit_col: str,
    time_col: str,
    feature_cols: Optional[Iterable[str]],
) -> list[str]:
    """Return the list of feature columns to slice into windows."""
    if feature_cols is not None:
        return list(feature_cols)
    numeric = df.select_dtypes(include=[np.number]).columns.tolist()
    return [c for c in numeric if c not in (unit_col, time_col)]


def make_windows(
    df: pd.DataFrame,
    unit_col: str = "unit_id",
    time_col: str = "cycle",
    feature_cols: Optional[Iterable[str]] = None,
    window: int = 30,
    stride: int = 1,
    min_len: Optional[int] = None,
) -> Tuple[np.ndarray, pd.DataFrame]:
    """Build sliding windows from a per-unit time-series DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Long-format frame with at least ``unit_col`` and ``time_col``.
    unit_col : str
        Column identifying a trajectory/unit.
    time_col : str
        Monotonic time/cycle column used to sort within unit.
    feature_cols : iterable of str, optional
        Columns to stack into the window tensor. If ``None``, all numeric
        columns except ``unit_col``/``time_col`` are used.
    window : int
        Window length (number of consecutive cycles).
    stride : int
        Step between consecutive window starts (>= 1).
    min_len : int, optional
        Units with fewer than ``min_len`` rows are skipped. Defaults to
        ``window``.

    Returns
    -------
    X : np.ndarray
        Shape ``(n_windows, window, n_features)``. Empty array with the
        right trailing dims if no windows could be produced.
    meta : pd.DataFrame
        Columns ``['unit_id', 'start_cycle', 'end_cycle']``, one row per
        window, aligned to ``X[i]``.
    """
    if window <= 0:
        raise ValueError("window must be positive")
    if stride <= 0:
        raise ValueError("stride must be positive")
    if min_len is None:
        min_len = window

    feats = _resolve_feature_cols(df, unit_col, time_col, feature_cols)
    n_features = len(feats)

    if df.empty or n_features == 0:
        X = np.empty((0, window, n_features), dtype=np.float64)
        meta = pd.DataFrame(
            {"unit_id": [], "start_cycle": [], "end_cycle": []}
        )
        return X, meta

    x_chunks: list[np.ndarray] = []
    unit_ids: list = []
    start_cycles: list = []
    end_cycles: list = []

    for unit, g in df.groupby(unit_col, sort=False):
        if len(g) < min_len or len(g) < window:
            continue
        g = g.sort_values(time_col, kind="mergesort")
        values = g[feats].to_numpy()
        times = g[time_col].to_numpy()
        n = values.shape[0]
        for start in range(0, n - window + 1, stride):
            end = start + window
            x_chunks.append(values[start:end])
            unit_ids.append(unit)
            start_cycles.append(times[start])
            end_cycles.append(times[end - 1])

    if not x_chunks:
        X = np.empty((0, window, n_features), dtype=np.float64)
        meta = pd.DataFrame(
            {"unit_id": [], "start_cycle": [], "end_cycle": []}
        )
        return X, meta

    X = np.stack(x_chunks, axis=0)
    meta = pd.DataFrame(
        {
            "unit_id": unit_ids,
            "start_cycle": start_cycles,
            "end_cycle": end_cycles,
        }
    )
    return X, meta


def rul_from_window(
    meta: pd.DataFrame,
    max_cycles_per_unit: Mapping,
) -> np.ndarray:
    """Compute Remaining Useful Life for each window in ``meta``.

    RUL = max_cycle(unit) - end_cycle, clipped at 0. Intended for
    training trajectories where the run ends at failure.

    Parameters
    ----------
    meta : pd.DataFrame
        Output of :func:`make_windows` (needs ``unit_id`` and ``end_cycle``).
    max_cycles_per_unit : mapping
        ``unit_id -> max cycle observed`` for that unit.

    Returns
    -------
    np.ndarray
        Shape ``(len(meta),)``, dtype float.
    """
    if len(meta) == 0:
        return np.empty((0,), dtype=np.float64)
    max_cycle = meta["unit_id"].map(max_cycles_per_unit).to_numpy()
    if pd.isna(max_cycle).any():
        missing = meta.loc[pd.isna(max_cycle), "unit_id"].unique().tolist()
        raise KeyError(f"max_cycles_per_unit missing units: {missing}")
    rul = max_cycle.astype(np.float64) - meta["end_cycle"].to_numpy().astype(
        np.float64
    )
    return np.clip(rul, 0.0, None)


def last_window_per_unit(
    df: pd.DataFrame,
    unit_col: str = "unit_id",
    time_col: str = "cycle",
    feature_cols: Optional[Iterable[str]] = None,
    window: int = 30,
    min_len: Optional[int] = None,
) -> Tuple[np.ndarray, pd.DataFrame]:
    """Return the last ``window`` cycles for each unit (one window per unit).

    Useful for C-MAPSS test sets where a single RUL prediction is made
    per unit from the tail of its observed trajectory. Units with fewer
    than ``min_len`` rows are skipped.

    Returns
    -------
    X : np.ndarray
        Shape ``(n_units_kept, window, n_features)``.
    meta : pd.DataFrame
        Columns ``['unit_id', 'start_cycle', 'end_cycle']``.
    """
    if window <= 0:
        raise ValueError("window must be positive")
    if min_len is None:
        min_len = window

    feats = _resolve_feature_cols(df, unit_col, time_col, feature_cols)
    n_features = len(feats)

    if df.empty or n_features == 0:
        X = np.empty((0, window, n_features), dtype=np.float64)
        meta = pd.DataFrame(
            {"unit_id": [], "start_cycle": [], "end_cycle": []}
        )
        return X, meta

    x_chunks: list[np.ndarray] = []
    unit_ids: list = []
    start_cycles: list = []
    end_cycles: list = []

    for unit, g in df.groupby(unit_col, sort=False):
        if len(g) < min_len or len(g) < window:
            continue
        g = g.sort_values(time_col, kind="mergesort")
        values = g[feats].to_numpy()
        times = g[time_col].to_numpy()
        tail = values[-window:]
        x_chunks.append(tail)
        unit_ids.append(unit)
        start_cycles.append(times[-window])
        end_cycles.append(times[-1])

    if not x_chunks:
        X = np.empty((0, window, n_features), dtype=np.float64)
        meta = pd.DataFrame(
            {"unit_id": [], "start_cycle": [], "end_cycle": []}
        )
        return X, meta

    X = np.stack(x_chunks, axis=0)
    meta = pd.DataFrame(
        {
            "unit_id": unit_ids,
            "start_cycle": start_cycles,
            "end_cycle": end_cycles,
        }
    )
    return X, meta
