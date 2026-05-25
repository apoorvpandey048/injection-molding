"""SimulatorSource: DataSource implementation backed by the hidden-state simulator."""
from __future__ import annotations

import time
from typing import Any, Dict, Iterator, Optional

from contracts.datasource import CycleOutput, DataSource
from src.simulator.degradation import (
    FAILURE_THRESHOLD,
    OPTIMAL_REPLACE_HIGH,
    OPTIMAL_REPLACE_LOW,
    DegradationFSM,
)
from src.simulator.faults import FaultManager
from src.simulator.machine import MachineSimulator


class SimulatorSource(DataSource):
    def __init__(self, machine_id: str = "SIM-001", seed: Optional[int] = None) -> None:
        self._machine = MachineSimulator(machine_id=machine_id, seed=seed)
        self._fsm = DegradationFSM()
        self._fault_manager = FaultManager()
        self._cycles_per_second: float = 1.0
        self._machine_id = machine_id
        # Failure latch (V2). Set once any component crosses FAILURE_THRESHOLD;
        # cleared only by reset(). While latched, degradation is frozen.
        self._failed: bool = False
        self._failed_component: Optional[str] = None
        self._failed_at_cycle: Optional[int] = None
        self._failed_health: Optional[float] = None

    @property
    def machine_id(self) -> str:
        return self._machine_id

    def stream(self) -> Iterator[CycleOutput]:
        while True:
            if not self._failed:
                self._fault_manager.tick()
                for comp, pressure in self._fault_manager.get_fsm_pressures().items():
                    self._fsm.set_fault_pressure(comp, pressure)
                self._fsm.step()
                if self._fsm.any_failed():
                    self._latch_failure()

            # Even after failure new cycles still emit; degraded symptom factors
            # stay frozen at their last value so the curves keep reading "broken".
            symptom_factors = self._fault_manager.get_symptom_factors()
            cycle: Dict[str, Any] = self._machine.next_cycle(symptom_factors)

            yield cycle

            if self._cycles_per_second > 0:
                time.sleep(1.0 / self._cycles_per_second)

    def _latch_failure(self) -> None:
        comp = self._fsm.most_degraded_component()
        self._failed = True
        self._failed_component = comp
        # cycle_index is the index the cycle emitted this iteration will carry —
        # the first cycle that reports the failed state.
        self._failed_at_cycle = self._machine.cycle_index
        self._failed_health = self._fsm.get_health(comp)

    def reset(self) -> None:
        """Return the machine to pristine state: health 1.0, no faults, cycle 0."""
        self._fsm.reset()
        self._fault_manager.clear_all()
        self._machine.reset()
        self._failed = False
        self._failed_component = None
        self._failed_at_cycle = None
        self._failed_health = None

    def get_machine_state(self) -> str:
        """Ground-truth machine condition derived from the worst component's true
        health. Distinct from the gauge urgency band (which is days-based and
        ML-predicted). Computed server-side; never fed to any model.

            worst > 0.42 (OPTIMAL_REPLACE_HIGH) -> running
            0.35 - 0.42                         -> warning
            0.20 - 0.35                         -> critical
            <= 0.20 (FAILURE_THRESHOLD)         -> failed (latched)
        """
        if self._failed:
            return "failed"
        worst = min(self.get_health_snapshot().values())
        if worst > OPTIMAL_REPLACE_HIGH:
            return "running"
        if worst > OPTIMAL_REPLACE_LOW:
            return "warning"
        if worst > FAILURE_THRESHOLD:
            return "critical"
        return "failed"

    def is_failed(self) -> bool:
        return self._failed

    def get_failure_info(self) -> Optional[Dict[str, Any]]:
        if not self._failed:
            return None
        return {
            "component":   self._failed_component,
            "cycle_index": self._failed_at_cycle,
            "health":      self._failed_health,
        }

    def inject_fault(self, fault: str, severity: float, onset_cycles: int) -> None:
        self._fault_manager.inject(fault, severity, onset_cycles)

    def clear_fault(self, fault: str) -> None:
        self._fault_manager.clear(fault)

    def set_speedup(self, cycles_per_second: float) -> None:
        self._cycles_per_second = max(0.0, cycles_per_second)

    def get_health_snapshot(self) -> Dict[str, float]:
        """Returns current FSM health for all components. For server use only — never forwarded to ML."""
        from src.simulator.degradation import BASE_WEAR, FAILURE_THRESHOLD, OPTIMAL_REPLACE_HIGH, OPTIMAL_REPLACE_LOW
        return {
            "hydraulic":        self._fsm.get_health("hydraulic"),
            "screw_check_ring": self._fsm.get_health("screw_check_ring"),
            "heaters":          self._fsm.get_health("heaters"),
            "drive":            self._fsm.get_health("drive"),
            "mold":             self._fsm.get_health("mold"),
        }

    def get_rul_cycles(self) -> Dict[str, float]:
        """RUL in cycles to failure threshold for each component."""
        return self._fsm.cycles_to_failure()

    def get_active_faults(self) -> list[str]:
        return self._fault_manager.active_names()

    def any_failed(self) -> bool:
        return self._fsm.any_failed()
