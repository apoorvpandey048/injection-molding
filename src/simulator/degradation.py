"""Hidden degradation FSM. State is NEVER exposed outside this module.

Each component has health h in [0,1]. Per cycle:
    h_next = h - base_wear[c] - fault_pressure[c]   (clipped to [0,1])

Failure threshold: h < 0.2
Optimal replacement sweet spot: h ~ 0.35-0.40  (retains resale value)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

BASE_WEAR: Dict[str, float] = {
    "hydraulic":        2e-4,
    "screw_check_ring": 1.5e-4,
    "heaters":          1e-4,
    "drive":            8e-5,
    "mold":             6e-5,
}

FAILURE_THRESHOLD = 0.20
OPTIMAL_REPLACE_LOW = 0.35
OPTIMAL_REPLACE_HIGH = 0.42


@dataclass
class DegradationFSM:
    _health: Dict[str, float] = field(default_factory=lambda: {
        "hydraulic":        1.0,
        "screw_check_ring": 1.0,
        "heaters":          1.0,
        "drive":            1.0,
        "mold":             1.0,
    })
    _fault_pressure: Dict[str, float] = field(default_factory=lambda: {
        "hydraulic":        0.0,
        "screw_check_ring": 0.0,
        "heaters":          0.0,
        "drive":            0.0,
        "mold":             0.0,
    })

    def step(self) -> None:
        for c in self._health:
            wear = BASE_WEAR[c] + self._fault_pressure[c]
            self._health[c] = float(max(0.0, min(1.0, self._health[c] - wear)))

    def reset(self) -> None:
        """Return every component to pristine health (1.0) and clear fault pressure."""
        for c in self._health:
            self._health[c] = 1.0
            self._fault_pressure[c] = 0.0

    def set_fault_pressure(self, component: str, pressure: float) -> None:
        self._fault_pressure[component] = pressure

    def clear_fault_pressure(self, component: str) -> None:
        self._fault_pressure[component] = 0.0

    def get_health(self, component: str) -> float:
        return self._health[component]

    def any_failed(self) -> bool:
        return any(h < FAILURE_THRESHOLD for h in self._health.values())

    def cycles_to_failure(self) -> Dict[str, float]:
        result: Dict[str, float] = {}
        for c, h in self._health.items():
            total_wear = BASE_WEAR[c] + self._fault_pressure[c]
            if total_wear <= 0:
                result[c] = float("inf")
            else:
                result[c] = max(0.0, (h - FAILURE_THRESHOLD) / total_wear)
        return result

    def most_degraded_component(self) -> str:
        return min(self._health, key=lambda c: self._health[c])
