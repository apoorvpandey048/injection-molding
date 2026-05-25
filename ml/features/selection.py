"""Feature selection pipeline.

Stages:
    1. Variance threshold drop.
    2. Recursive Feature Elimination backed by a Random Forest.
    3. SHAP-based ranking on the RFE-selected subset.
    4. Greedy correlation-cluster pruning honouring SHAP order.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.feature_selection import RFE, VarianceThreshold

SEED = 20260520


def _make_forest(task: str, n_estimators: int):
    """Return a RandomForest estimator appropriate for the task."""
    if task == "regression":
        return RandomForestRegressor(
            n_estimators=n_estimators, random_state=SEED, n_jobs=-1
        )
    if task == "classification":
        return RandomForestClassifier(
            n_estimators=n_estimators, random_state=SEED, n_jobs=-1
        )
    raise ValueError(f"task must be 'regression' or 'classification', got {task!r}")


def drop_low_variance(X: pd.DataFrame, threshold: float = 1e-8) -> pd.DataFrame:
    """Drop near-constant columns using sklearn's VarianceThreshold.

    Parameters
    ----------
    X : pd.DataFrame
        Input feature frame.
    threshold : float
        Minimum variance a column must have to be retained.

    Returns
    -------
    pd.DataFrame
        DataFrame restricted to retained columns, preserving names and index.
    """
    selector = VarianceThreshold(threshold=threshold)
    selector.fit(X.values)
    kept_mask = selector.get_support()
    kept_cols = X.columns[kept_mask]
    return X.loc[:, kept_cols].copy()


def rfe_rank(
    X: pd.DataFrame,
    y,
    task: str = "regression",
    n_features_to_select: int = 50,
    n_estimators: int = 200,
) -> list[str]:
    """Rank/select features via sklearn RFE backed by a Random Forest.

    Parameters
    ----------
    X : pd.DataFrame
        Feature frame.
    y : array-like
        Target.
    task : {'regression', 'classification'}
        Determines which RandomForest variant is used.
    n_features_to_select : int
        Target number of features for RFE.
    n_estimators : int
        Trees per RandomForest fit inside RFE.

    Returns
    -------
    list[str]
        Selected column names ordered by RFE support (ranking ascending).
    """
    n_target = min(n_features_to_select, X.shape[1])
    estimator = _make_forest(task, n_estimators)
    rfe = RFE(estimator=estimator, n_features_to_select=n_target, step=0.1)
    rfe.fit(X.values, y)
    support = rfe.support_
    ranking = rfe.ranking_
    cols = np.asarray(X.columns)
    selected = cols[support]
    # Within the supported set every ranking_ value is 1; preserve original
    # column order for determinism.
    selected_order = [c for c in cols if c in set(selected)]
    return selected_order


def shap_rank(
    X: pd.DataFrame,
    y,
    task: str = "regression",
    n_estimators: int = 200,
    sample: Optional[int] = None,
) -> pd.Series:
    """Rank features by mean(|SHAP value|) from a RandomForest TreeExplainer.

    Parameters
    ----------
    X : pd.DataFrame
        Feature frame used to fit the model and compute SHAP values.
    y : array-like
        Target.
    task : {'regression', 'classification'}
        Selects RandomForest variant.
    n_estimators : int
        Trees in the fitted forest.
    sample : int, optional
        If provided, randomly subsample this many rows from ``X`` for the
        SHAP value computation (model is still fit on the full X/y).

    Returns
    -------
    pd.Series
        Mean absolute SHAP value per column, indexed by column name and
        sorted descending.
    """
    model = _make_forest(task, n_estimators)
    model.fit(X.values, y)

    if sample is not None and sample < len(X):
        rng = np.random.default_rng(SEED)
        idx = rng.choice(len(X), size=sample, replace=False)
        X_sample = X.iloc[idx]
    else:
        X_sample = X

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    if isinstance(shap_values, list):
        # Multi-class classification: list of (n_samples, n_features) arrays.
        stacked = np.stack([np.abs(sv) for sv in shap_values], axis=0)
        mean_abs = stacked.mean(axis=0).mean(axis=0)
    else:
        arr = np.asarray(shap_values)
        if arr.ndim == 3:
            # (n_samples, n_features, n_classes) layout from newer shap.
            mean_abs = np.abs(arr).mean(axis=2).mean(axis=0)
        else:
            mean_abs = np.abs(arr).mean(axis=0)

    ranking = pd.Series(mean_abs, index=X.columns, name="mean_abs_shap")
    return ranking.sort_values(ascending=False)


def correlation_cluster_prune(
    X: pd.DataFrame,
    ranking: pd.Series,
    corr_threshold: float = 0.95,
) -> list[str]:
    """Greedy correlation pruning honouring an importance ranking.

    Iterates columns in ``ranking`` order (highest importance first), keeps
    each column, and drops any later column whose absolute Pearson
    correlation against any already-kept column exceeds ``corr_threshold``.

    Parameters
    ----------
    X : pd.DataFrame
        Feature frame providing data for the correlation computation.
    ranking : pd.Series
        Importance scores indexed by column; iteration order is the index
        order after sorting descending by value.
    corr_threshold : float
        Absolute correlation above which a candidate is dropped.

    Returns
    -------
    list[str]
        Retained column names, in the order they were kept.
    """
    ordered = [c for c in ranking.sort_values(ascending=False).index if c in X.columns]
    if not ordered:
        return []

    corr = X[ordered].corr().abs()

    kept: list[str] = []
    dropped: set[str] = set()
    for col in ordered:
        if col in dropped:
            continue
        kept.append(col)
        # Mark later, lower-ranked columns highly correlated with this one.
        for other in ordered:
            if other == col or other in dropped or other in kept:
                continue
            if corr.at[col, other] > corr_threshold:
                dropped.add(other)
    return kept


def select_features(
    X: pd.DataFrame,
    y,
    task: str = "regression",
    n_features_to_select: int = 50,
    corr_threshold: float = 0.95,
    shap_sample: Optional[int] = 2000,
) -> dict:
    """Run the full feature-selection pipeline.

    Stages
    ------
    1. ``drop_low_variance`` removes near-constant columns.
    2. ``rfe_rank`` selects a Random-Forest RFE subset.
    3. ``shap_rank`` ranks the RFE subset by mean(|SHAP|).
    4. ``correlation_cluster_prune`` greedily prunes correlated columns.

    Parameters
    ----------
    X : pd.DataFrame
        Input features.
    y : array-like
        Target.
    task : {'regression', 'classification'}
    n_features_to_select : int
        Target size for the RFE stage.
    corr_threshold : float
        Absolute correlation threshold for cluster pruning.
    shap_sample : int, optional
        Subsample size passed to ``shap_rank``.

    Returns
    -------
    dict
        Keys: ``'kept'`` (list[str] final features), ``'shap_ranking'``
        (pd.Series), ``'rfe_selected'`` (list[str]).
    """
    X_var = drop_low_variance(X)
    rfe_selected = rfe_rank(
        X_var, y, task=task, n_features_to_select=n_features_to_select
    )
    X_rfe = X_var[rfe_selected]
    shap_ranking = shap_rank(X_rfe, y, task=task, sample=shap_sample)
    kept = correlation_cluster_prune(
        X_rfe, shap_ranking, corr_threshold=corr_threshold
    )
    return {
        "kept": kept,
        "shap_ranking": shap_ranking,
        "rfe_selected": rfe_selected,
    }
