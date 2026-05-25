"""A-T1 through A-T6: simulator + feature + ML split tests."""
from __future__ import annotations

import ast
import itertools
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_cycles(n: int, fault: str | None = None, severity: float = 0.8):
    from src.datasource.simulator_source import SimulatorSource

    src = SimulatorSource(machine_id="TEST-001", seed=0)
    if fault:
        src.inject_fault(fault, severity, onset_cycles=5)
    return list(itertools.islice(src.stream(), n))


# ---------------------------------------------------------------------------
# A-T1 — Schema: cycle output contains required top-level keys
# ---------------------------------------------------------------------------

def test_at1_cycle_schema():
    cycles = _run_cycles(3)
    required = {
        "cycle_index", "timestamp", "machine_id",
        "scalars", "curves", "hold_profile", "barrel_temps",
    }
    for c in cycles:
        missing = required - c.keys()
        assert not missing, f"Cycle missing keys: {missing}"
    assert cycles[0]["machine_id"] == "TEST-001"
    assert isinstance(cycles[0]["scalars"], dict)
    assert isinstance(cycles[0]["curves"], dict)
    assert len(cycles[0]["hold_profile"]) > 0
    assert len(cycles[0]["barrel_temps"]) > 0


# ---------------------------------------------------------------------------
# A-T2 — cushion_min drops when check_ring_wear is injected
# ---------------------------------------------------------------------------

def test_at2_check_ring_wear_cushion_drop():
    baseline = _run_cycles(15)
    worn = _run_cycles(15, fault="check_ring_wear", severity=0.9)

    cushion_baseline = [c["scalars"]["cushion_min"] for c in baseline[5:]]
    cushion_worn = [c["scalars"]["cushion_min"] for c in worn[5:]]

    avg_baseline = sum(cushion_baseline) / len(cushion_baseline)
    avg_worn = sum(cushion_worn) / len(cushion_worn)

    assert avg_worn < avg_baseline, (
        f"Expected cushion_min to drop with check_ring_wear fault: "
        f"baseline={avg_baseline:.3f}, worn={avg_worn:.3f}"
    )


# ---------------------------------------------------------------------------
# A-T3 — AST lint: features.py MUST NOT import src.simulator.*
# ---------------------------------------------------------------------------

def test_at3_features_no_simulator_import():
    features_path = Path(__file__).parent.parent / "src" / "ml" / "features.py"
    tree = ast.parse(features_path.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert not alias.name.startswith("src.simulator"), (
                    f"features.py must not import src.simulator.* (found: {alias.name})"
                )
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            assert not module.startswith("src.simulator"), (
                f"features.py must not import from src.simulator.* (found: {module})"
            )


# ---------------------------------------------------------------------------
# A-T4 — injection pressure sags with hydraulic_pump_wear
# ---------------------------------------------------------------------------

def test_at4_hydraulic_pump_wear_pressure_sag():
    baseline = _run_cycles(15)
    worn = _run_cycles(15, fault="hydraulic_pump_wear", severity=0.9)

    p_baseline = [c["scalars"]["peak_injection_pressure"] for c in baseline[5:]]
    p_worn = [c["scalars"]["peak_injection_pressure"] for c in worn[5:]]

    avg_baseline = sum(p_baseline) / len(p_baseline)
    avg_worn = sum(p_worn) / len(p_worn)

    assert avg_worn < avg_baseline, (
        f"Expected peak_injection_pressure to sag with hydraulic_pump_wear: "
        f"baseline={avg_baseline:.1f}, worn={avg_worn:.1f}"
    )


# ---------------------------------------------------------------------------
# A-T5 — barrel temps drift with heater_drift
# ---------------------------------------------------------------------------

def test_at5_heater_drift_barrel_temp():
    baseline = _run_cycles(15)
    drifted = _run_cycles(15, fault="heater_drift", severity=0.9)

    def _temp_std(cycles):
        from src.ml.features import extract
        stds = [extract(c)["barrel_temp_std"] for c in cycles[5:]]
        return sum(stds) / len(stds)

    std_baseline = _temp_std(baseline)
    std_drifted = _temp_std(drifted)

    assert std_drifted > std_baseline, (
        f"Expected barrel_temp_std to increase with heater_drift: "
        f"baseline={std_baseline:.4f}, drifted={std_drifted:.4f}"
    )


# ---------------------------------------------------------------------------
# A-T6 — GroupKFold: no machine_id leakage across splits
# ---------------------------------------------------------------------------

def test_at6_group_kfold_no_leakage():
    from sklearn.model_selection import GroupKFold
    import numpy as np

    machine_ids = ["M-001"] * 40 + ["M-002"] * 40 + ["M-003"] * 40
    X = np.zeros((len(machine_ids), 2))
    groups = np.array(machine_ids)

    gkf = GroupKFold(n_splits=3)
    for train_idx, val_idx in gkf.split(X, groups=groups):
        train_machines = set(groups[train_idx])
        val_machines = set(groups[val_idx])
        overlap = train_machines & val_machines
        assert not overlap, (
            f"GroupKFold leakage: machines {overlap} appear in both train and val"
        )
