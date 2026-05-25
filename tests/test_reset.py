"""V1 — reset returns the simulator to a pristine state."""
from __future__ import annotations

import itertools

from src.datasource.simulator_source import SimulatorSource


def _drain(src: SimulatorSource, n: int):
    return list(itertools.islice(src.stream(), n))


def test_reset_restores_full_health_no_faults_cycle_zero():
    src = SimulatorSource(machine_id="TEST-RESET", seed=0)
    src.set_speedup(0)  # no wall-clock sleep between cycles

    # Degrade a component and confirm state actually moved off pristine.
    src.inject_fault("hydraulic_pump_wear", severity=1.0, onset_cycles=1)
    _drain(src, 50)

    health_before = src.get_health_snapshot()
    assert min(health_before.values()) < 1.0, "fault should have lowered some health"
    assert src.get_active_faults(), "fault should be active before reset"

    src.reset()

    health_after = src.get_health_snapshot()
    assert all(h == 1.0 for h in health_after.values()), health_after
    assert src.get_active_faults() == []
    assert src.get_rul_cycles()  # RUL recomputed from full health (all positive/inf)

    # The next emitted cycle starts the counter over at 0.
    first = _drain(src, 1)[0]
    assert first["cycle_index"] == 0
