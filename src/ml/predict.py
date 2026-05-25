"""Load trained artifacts and run inference on a single CycleOutput."""
from __future__ import annotations

import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from src.ml.features import extract
from src.ml.urgency import classify, cycles_to_date, days_until

DEFAULT_CYCLES_PER_DAY = 4000.0

DEFAULT_QUALITY_PATH = Path("artifacts/models/quality.pkl")
DEFAULT_RUL_PATH     = Path("artifacts/models/rul.pkl")

_quality_artifact: dict | None = None
_rul_artifact:     dict | None = None


def _load_quality(path: Path) -> dict:
    global _quality_artifact
    if _quality_artifact is None:
        with open(path, "rb") as f:
            _quality_artifact = pickle.load(f)
    return _quality_artifact


def _load_rul(path: Path) -> dict:
    global _rul_artifact
    if _rul_artifact is None:
        with open(path, "rb") as f:
            _rul_artifact = pickle.load(f)
    return _rul_artifact


def predict_rul_per_component(
    feats: Dict[str, float],
    rul_artifact: Dict[str, Any],
) -> Dict[str, Dict[str, float]]:
    """Per-component p10/p50/p90 prediction. Enforces p10 <= p50 <= p90 by sorting
    to absorb quantile-regressor crossings (independent GBR heads are not monotonic)."""
    out: Dict[str, Dict[str, float]] = {}
    for comp, comp_art in rul_artifact["components"].items():
        X_c = [[feats[c] for c in comp_art["feature_cols"]]]
        models = comp_art["models"]
        raw = [
            float(models["p10"].predict(X_c)[0]),
            float(models["p50"].predict(X_c)[0]),
            float(models["p90"].predict(X_c)[0]),
        ]
        raw.sort()
        out[comp] = {
            "p10": max(0.0, raw[0]),
            "p50": max(0.0, raw[1]),
            "p90": max(0.0, raw[2]),
        }
    return out


def predict(
    cycle: Dict[str, Any],
    quality_path: Path = DEFAULT_QUALITY_PATH,
    rul_path: Path = DEFAULT_RUL_PATH,
    cycles_per_day: float = DEFAULT_CYCLES_PER_DAY,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Return quality + per-component RUL + replacement_date/urgency. No simulator state used."""
    feats = extract(cycle)
    if now is None:
        now = datetime.now(timezone.utc)

    # ── quality ───────────────────────────────────────────────────────────
    qa = _load_quality(quality_path)
    X_q = [[feats[c] for c in qa["feature_cols"]]]
    proba = qa["model"].predict_proba(X_q)[0]
    classes = qa["label_encoder"].classes_
    quality_proba = {str(cls): float(p) for cls, p in zip(classes, proba)}
    quality_label = str(classes[int(proba.argmax())])

    # ── RUL (per-component quantile band + urgency) ──────────────────────
    ra = _load_rul(rul_path)
    rul_per_component = predict_rul_per_component(feats, ra)

    for comp, band in rul_per_component.items():
        replacement_date = cycles_to_date(band["p50"], cycles_per_day, now)
        days = days_until(replacement_date, now)
        band["replacement_date"] = replacement_date.isoformat()
        band["days_until_replacement"] = float(days)
        band["urgency"] = classify(days)

    worst_comp = min(rul_per_component, key=lambda c: rul_per_component[c]["p50"])
    worst = rul_per_component[worst_comp]

    return {
        "quality": {
            "label":       quality_label,
            "probability": quality_proba,
        },
        "rul": {
            "p10":             worst["p10"],
            "p50":             worst["p50"],
            "p90":             worst["p90"],
            "worst_component": worst_comp,
            "replacement_date": worst["replacement_date"],
            "urgency":          worst["urgency"],
        },
        "rul_per_component": rul_per_component,
    }
