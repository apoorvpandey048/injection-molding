"""Cycle generator. Emits one CycleOutput per call to next_cycle().

Observable signals only — no health state crosses this boundary.
The DegradationFSM and FaultManager are injected so machine.py never imports them directly;
the caller (SimulatorSource) owns the FSM and passes symptom factors here.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from src.simulator.profiles import (
    barrel_zone_temps,
    cavity_pressure_curve,
    hold_pressure_profile,
    injection_pressure_curve,
    nozzle_temperature_curve,
    screw_position_curve,
    screw_velocity_curve,
)

CURVE_POINTS = 100

NOMINAL = {
    "cycle_time":               28.0,
    "injection_time":            2.4,
    "hold_time":                 4.0,
    "cooling_time":             14.0,
    "cushion_min":               6.5,
    "peak_injection_pressure": 140.0,
    "peak_cavity_pressure":     80.0,
    "switchover_position":      18.0,
    "switchover_pressure":     120.0,
    "shot_volume":              42.0,
    "clamp_force_peak":        850.0,
    "back_pressure":            10.0,
    "screw_rpm":                80.0,
    "oil_temperature":          45.0,
    "nozzle_setpoint":         230.0,
    "barrel_setpoints":        [220.0, 225.0, 230.0, 235.0, 230.0, 220.0],
    "screw_stroke":             85.0,
    "hold_p0":                 100.0,
}


class MachineSimulator:
    def __init__(self, machine_id: str = "SIM-001", seed: Optional[int] = None) -> None:
        self.machine_id = machine_id
        self._rng = np.random.default_rng(seed)
        self._cycle_index = 0

    @property
    def cycle_index(self) -> int:
        """Index that the *next* emitted cycle will carry."""
        return self._cycle_index

    def reset(self) -> None:
        """Restore the cycle counter to 0. The RNG stream is intentionally left
        running (reset restores machine state, not the noise sequence)."""
        self._cycle_index = 0

    def next_cycle(
        self,
        symptom_factors: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        sf = symptom_factors or {}
        rng = self._rng

        # ── scalars with noise ────────────────────────────────────────────
        cushion_drop = sf.get("cushion_min_drop", 0.0)
        cushion = float(
            NOMINAL["cushion_min"] * (1.0 - 0.35 * cushion_drop) + rng.normal(0, 0.15)
        )
        cushion = max(0.5, cushion)

        pressure_sag = sf.get("injection_pressure_sag", 0.0)
        peak_inj = float(
            NOMINAL["peak_injection_pressure"] * (1.0 - 0.25 * pressure_sag) + rng.normal(0, 1.2)
        )

        cav_var = sf.get("cavity_pressure_var", 0.0)
        peak_cav = float(
            NOMINAL["peak_cavity_pressure"] + rng.normal(0, 1.0 + 4.0 * cav_var)
        )

        oil_rise = sf.get("oil_temp_rise", 0.0)
        oil_temp = float(NOMINAL["oil_temperature"] + 12.0 * oil_rise + rng.normal(0, 0.4))

        inj_stretch = sf.get("injection_time_stretch", 0.0)
        injection_time = float(NOMINAL["injection_time"] * (1.0 + 0.4 * inj_stretch) + rng.normal(0, 0.05))

        rpm_drop = sf.get("screw_rpm_drop", 0.0)
        cyc_stretch = sf.get("cycle_time_stretch", 0.0)
        clamp_drop = sf.get("clamp_force_drop", 0.0)
        cool_stretch = sf.get("cooling_time_stretch", 0.0)

        scalars: Dict[str, float] = {
            "cycle_time":               float(NOMINAL["cycle_time"] * (1.0 + 0.25 * cyc_stretch) + rng.normal(0, 0.3)),
            "injection_time":           injection_time,
            "hold_time":                float(NOMINAL["hold_time"] + rng.normal(0, 0.1)),
            "cooling_time":             float(NOMINAL["cooling_time"] * (1.0 + 0.30 * cool_stretch) + rng.normal(0, 0.5)),
            "cushion_min":              cushion,
            "peak_injection_pressure":  peak_inj,
            "peak_cavity_pressure":     peak_cav,
            "switchover_position":      float(NOMINAL["switchover_position"] + rng.normal(0, 0.2)),
            "switchover_pressure":      float(NOMINAL["switchover_pressure"] + rng.normal(0, 1.5)),
            "shot_volume":              float(NOMINAL["shot_volume"] + rng.normal(0, 0.2)),
            "clamp_force_peak":         float(NOMINAL["clamp_force_peak"] * (1.0 - 0.20 * clamp_drop) + rng.normal(0, 5.0)),
            "back_pressure":            float(NOMINAL["back_pressure"] + rng.normal(0, 0.3)),
            "screw_rpm":                float(NOMINAL["screw_rpm"] * (1.0 - 0.25 * rpm_drop) + rng.normal(0, 1.0)),
            "oil_temperature":          oil_temp,
        }

        # ── barrel temps ──────────────────────────────────────────────────
        temp_drift = sf.get("barrel_temp_drift", 0.0)
        drift_sign = 1.0 if (self._cycle_index // 200) % 2 == 0 else -1.0
        barrel_setpoints = [
            s + drift_sign * 8.0 * temp_drift for s in NOMINAL["barrel_setpoints"]
        ]
        b_temps = barrel_zone_temps(barrel_setpoints, noise_std=0.4)

        # ── hold profile ──────────────────────────────────────────────────
        hold_p0 = NOMINAL["hold_p0"] * (1.0 - 0.2 * pressure_sag)
        h_profile = hold_pressure_profile(hold_p0)

        # ── curves ────────────────────────────────────────────────────────
        n = CURVE_POINTS
        hyd_inj = injection_pressure_curve(n, peak_inj)
        hyd_inj += rng.normal(0, 0.8, n)

        cav_noise_scale = 1.0 + 3.0 * cav_var
        cav = cavity_pressure_curve(n, peak_cav)
        cav += rng.normal(0, cav_noise_scale, n)

        screw_pos = screw_position_curve(n, NOMINAL["screw_stroke"], cushion)
        screw_vel = screw_velocity_curve(n, 60.0)

        nozzle_sp = NOMINAL["nozzle_setpoint"] + drift_sign * 3.0 * temp_drift
        nozzle = nozzle_temperature_curve(n, nozzle_sp)

        curves: Dict[str, List[float]] = {
            "cavity_pressure":              cav.tolist(),
            "hydraulic_injection_pressure": hyd_inj.tolist(),
            "screw_position":               screw_pos.tolist(),
            "screw_velocity":               screw_vel.tolist(),
            "nozzle_temperature":           nozzle.tolist(),
        }

        output: Dict[str, Any] = {
            "cycle_index":  self._cycle_index,
            "timestamp":    datetime.now(timezone.utc).isoformat(),
            "machine_id":   self.machine_id,
            "curves":       curves,
            "scalars":      scalars,
            "hold_profile": h_profile,
            "barrel_temps": b_temps,
        }

        self._cycle_index += 1
        return output
