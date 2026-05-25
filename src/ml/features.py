"""Observable-only feature extraction. MUST NOT import src.simulator.*"""
from __future__ import annotations

import numpy as np
import pandas as pd

CURVE_KEYS = [
    "cavity_pressure",
    "hydraulic_injection_pressure",
    "screw_position",
    "screw_velocity",
    "nozzle_temperature",
]
SCALAR_KEYS = [
    "cycle_time", "injection_time", "hold_time", "cooling_time",
    "cushion_min", "peak_injection_pressure", "peak_cavity_pressure",
    "switchover_position", "switchover_pressure", "shot_volume",
    "clamp_force_peak", "back_pressure", "screw_rpm", "oil_temperature",
]


def _curve_stats(arr: list[float], prefix: str) -> dict[str, float]:
    a = np.asarray(arr, dtype=float)
    return {
        f"{prefix}_mean":   float(np.mean(a)),
        f"{prefix}_std":    float(np.std(a)),
        f"{prefix}_max":    float(np.max(a)),
        f"{prefix}_min":    float(np.min(a)),
        f"{prefix}_range":  float(np.max(a) - np.min(a)),
        f"{prefix}_auc":    float(np.trapezoid(a)),
    }


def extract(cycle: dict) -> dict[str, float]:
    """Extract a flat feature dict from a single CycleOutput. No simulator state."""
    feats: dict[str, float] = {}

    scalars = cycle.get("scalars", {})
    for k in SCALAR_KEYS:
        feats[k] = float(scalars.get(k, 0.0))

    curves = cycle.get("curves", {})
    for k in CURVE_KEYS:
        feats.update(_curve_stats(curves.get(k, [0.0]), k))

    hp = cycle.get("hold_profile", [0.0] * 10)
    hp_arr = np.asarray(hp, dtype=float)
    feats["hold_p_mean"] = float(np.mean(hp_arr))
    feats["hold_p_decay"] = float(hp_arr[0] - hp_arr[-1]) if len(hp_arr) > 1 else 0.0

    bt = cycle.get("barrel_temps", [0.0] * 6)
    bt_arr = np.asarray(bt, dtype=float)
    feats["barrel_temp_mean"] = float(np.mean(bt_arr))
    feats["barrel_temp_std"]  = float(np.std(bt_arr))
    feats["barrel_temp_max_dev"] = float(np.max(np.abs(bt_arr - np.mean(bt_arr))))

    return feats


def build_dataframe(cycles: list[dict]) -> pd.DataFrame:
    return pd.DataFrame([extract(c) for c in cycles])
