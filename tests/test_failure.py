"""V2 — failure behavior: machine_state progression, post-failure emission, health floor."""
from __future__ import annotations

from src.datasource.simulator_source import SimulatorSource

ORDER = ["running", "warning", "critical", "failed"]


def test_machine_state_transitions_and_failure_latch():
    src = SimulatorSource(machine_id="TEST-FAIL", seed=0)
    src.set_speedup(0)  # disables the inter-cycle wall-clock sleep
    src.inject_fault("hydraulic_pump_wear", severity=1.0, onset_cycles=1)

    states: list[str] = []
    min_health_seen = 1.0
    post_failure_cycles = 0
    stream = src.stream()

    for _ in range(5000):  # hydraulic crosses the threshold in ~700 cycles
        next(stream)
        states.append(src.get_machine_state())
        min_health_seen = min(min_health_seen, min(src.get_health_snapshot().values()))
        if states[-1] == "failed":
            post_failure_cycles += 1
            if post_failure_cycles >= 10:
                break

    # reached failure, and cycles kept emitting afterward
    assert "failed" in states, "machine never reached the failed state"
    assert post_failure_cycles >= 10, "no cycles emitted after failure"

    # health never goes negative
    assert min_health_seen >= 0.0, min_health_seen

    # distinct states appeared in exactly running -> warning -> critical -> failed
    seen_order: list[str] = []
    for s in states:
        if s not in seen_order:
            seen_order.append(s)
    assert seen_order == ORDER, f"unexpected progression: {seen_order}"

    # once failed, it stays failed (latched)
    first_fail = states.index("failed")
    assert all(s == "failed" for s in states[first_fail:])

    # failure metadata is consistent with the crossing
    info = src.get_failure_info()
    assert info is not None
    assert info["component"] == "hydraulic"
    assert 0.0 <= info["health"] <= 0.20


def test_health_pinned_after_failure():
    src = SimulatorSource(machine_id="TEST-PIN", seed=1)
    src.set_speedup(0)
    src.inject_fault("hydraulic_pump_wear", severity=1.0, onset_cycles=1)
    stream = src.stream()

    for _ in range(5000):
        next(stream)
        if src.is_failed():
            break
    assert src.is_failed(), "did not reach failure"

    h_at_fail = src.get_health_snapshot()
    for _ in range(50):  # post-failure cycles must not degrade further
        next(stream)
    h_after = src.get_health_snapshot()
    assert h_after == h_at_fail, f"health moved after failure: {h_at_fail} -> {h_after}"
