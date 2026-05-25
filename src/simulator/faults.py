"""Fault injection handlers. Each handler maps a fault name to FSM pressure.

Faults ramp from 0 to target_pressure over onset_cycles using a linear ramp.
The machine.py cycle generator reads symptom_modifiers() to perturb observables.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

FAULT_COMPONENT_MAP: Dict[str, str] = {
    "check_ring_wear":     "screw_check_ring",
    "heater_drift":        "heaters",
    "hydraulic_pump_wear": "hydraulic",
    "drive_servo_wear":    "drive",
    "mold_clamp_wear":     "mold",
}

# Wear acceleration per unit severity
FAULT_WEAR_RATE: Dict[str, float] = {
    "check_ring_wear":     8e-4,
    "heater_drift":        6e-4,
    "hydraulic_pump_wear": 1e-3,
    "drive_servo_wear":    7e-4,
    "mold_clamp_wear":     7e-4,
}


@dataclass
class ActiveFault:
    name: str
    severity: float
    onset_cycles: int
    cycles_elapsed: int = 0

    @property
    def ramp_factor(self) -> float:
        if self.onset_cycles <= 0:
            return self.severity
        return min(1.0, self.cycles_elapsed / self.onset_cycles) * self.severity

    def tick(self) -> None:
        self.cycles_elapsed += 1


@dataclass
class FaultManager:
    _active: Dict[str, ActiveFault] = field(default_factory=dict)

    def inject(self, fault: str, severity: float, onset_cycles: int) -> None:
        if fault not in FAULT_COMPONENT_MAP:
            raise ValueError(f"Unknown fault: {fault!r}. Valid: {list(FAULT_COMPONENT_MAP)}")
        self._active[fault] = ActiveFault(fault, severity, onset_cycles)

    def tick(self) -> None:
        for af in self._active.values():
            af.tick()

    def get_fsm_pressures(self) -> Dict[str, float]:
        """Returns per-component extra wear pressure from active faults."""
        pressures: Dict[str, float] = {}
        for af in self._active.values():
            comp = FAULT_COMPONENT_MAP[af.name]
            base_rate = FAULT_WEAR_RATE[af.name]
            pressures[comp] = pressures.get(comp, 0.0) + base_rate * af.ramp_factor
        return pressures

    def get_symptom_factors(self) -> Dict[str, float]:
        """Returns named symptom modifiers for machine.py to apply to observables."""
        factors: Dict[str, float] = {}
        for af in self._active.values():
            f = af.ramp_factor
            if af.name == "check_ring_wear":
                factors["cushion_min_drop"] = factors.get("cushion_min_drop", 0.0) + f
                factors["cavity_pressure_var"] = factors.get("cavity_pressure_var", 0.0) + f
            elif af.name == "heater_drift":
                factors["barrel_temp_drift"] = factors.get("barrel_temp_drift", 0.0) + f
                factors["injection_time_stretch"] = factors.get("injection_time_stretch", 0.0) + f
            elif af.name == "hydraulic_pump_wear":
                factors["injection_pressure_sag"] = factors.get("injection_pressure_sag", 0.0) + f
                factors["oil_temp_rise"] = factors.get("oil_temp_rise", 0.0) + f
            elif af.name == "drive_servo_wear":
                factors["screw_rpm_drop"]     = factors.get("screw_rpm_drop", 0.0) + f
                factors["cycle_time_stretch"] = factors.get("cycle_time_stretch", 0.0) + f
            elif af.name == "mold_clamp_wear":
                factors["clamp_force_drop"]     = factors.get("clamp_force_drop", 0.0) + f
                factors["cooling_time_stretch"] = factors.get("cooling_time_stretch", 0.0) + f
        return factors

    def clear(self, fault: str) -> None:
        self._active.pop(fault, None)

    def clear_all(self) -> None:
        """Drop every active fault (used by machine reset)."""
        self._active.clear()

    def active_names(self) -> list[str]:
        return list(self._active.keys())

    def get_active(self, name: str) -> Optional[ActiveFault]:
        return self._active.get(name)
