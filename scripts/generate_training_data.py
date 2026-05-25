"""Generate synthetic training data: N machines × M cycles with random fault onsets."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd

from src.simulator.degradation import (
    BASE_WEAR,
    FAILURE_THRESHOLD,
    DegradationFSM,
)
from src.simulator.faults import FAULT_COMPONENT_MAP, FaultManager
from src.simulator.machine import MachineSimulator
from src.ml.features import extract

FAULTS = list(FAULT_COMPONENT_MAP.keys())
_BIAS_COMPONENTS = {"drive", "mold"}
FAULT_WEIGHTS = np.array(
    [1.5 if FAULT_COMPONENT_MAP[f] in _BIAS_COMPONENTS else 1.0 for f in FAULTS],
    dtype=float,
)
FAULT_WEIGHTS = FAULT_WEIGHTS / FAULT_WEIGHTS.sum()


def simulate_machine(
    machine_id: str,
    n_cycles: int,
    seed: int,
    machine_index: int | None = None,
) -> list[dict]:
    rng = np.random.default_rng(seed)
    machine = MachineSimulator(machine_id=machine_id, seed=seed)
    fsm = DegradationFSM()
    fm = FaultManager()

    fault_onset_cycle = int(rng.integers(n_cycles // 3, 2 * n_cycles // 3))
    if machine_index is None:
        fault_name = str(rng.choice(FAULTS, p=FAULT_WEIGHTS))
    else:
        fault_name = FAULTS[machine_index % len(FAULTS)]
    severity = float(rng.uniform(0.4, 1.0))
    onset_cycles = int(rng.integers(10, 50))

    records = []
    for i in range(n_cycles):
        if i == fault_onset_cycle:
            fm.inject(fault_name, severity, onset_cycles)

        fm.tick()
        for comp, pressure in fm.get_fsm_pressures().items():
            fsm.set_fault_pressure(comp, pressure)
        fsm.step()

        symptom_factors = fm.get_symptom_factors()
        cycle = machine.next_cycle(symptom_factors)

        feats = extract(cycle)
        feats["machine_id"] = machine_id
        feats["cycle_index"] = i

        rul = fsm.cycles_to_failure()
        min_rul = min(rul.values())
        feats["rul_cycles"] = float(min_rul)
        for comp, comp_rul in rul.items():
            feats[f"rul_{comp}_cycles"] = float(comp_rul)

        if fsm.any_failed():
            break

        records.append(feats)

    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--machines", type=int, default=20)
    parser.add_argument("--cycles",   type=int, default=15000)
    parser.add_argument("--out",      type=str, default="data/synthetic/training.parquet")
    args = parser.parse_args()

    all_records: list[dict] = []
    for i in range(args.machines):
        print(f"  machine {i+1}/{args.machines}")
        records = simulate_machine(f"SIM-{i:03d}", args.cycles, seed=i * 137 + 42)
        all_records.extend(records)

    df = pd.DataFrame(all_records)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False)
    print(f"Saved {len(df)} rows → {out_path}")


if __name__ == "__main__":
    main()
