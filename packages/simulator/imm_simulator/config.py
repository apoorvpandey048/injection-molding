"""Simulator configuration — setpoints and Michiels et al. (2022) parameter ranges."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class HoldStep:
    """One programmable hold-pressure step (Aslantas HOLD_PRESS_STEP_N)."""

    duration_s: float
    pressure_bar: float


@dataclass
class Setpoints:
    """Process setpoints. Defaults pulled from Michiels et al. (2022) medians."""

    # Michiels Table 1 medians
    cooling_water_temp_k: float = 313.4
    melt_temp_k: float = 503.2
    flowrate_cm3_s: float = 40.0
    packing_pressure_bar: float = 400.1
    viscosity_n: float = 0.23
    viscosity_d1_pa_s: float = 5.8e13

    # Cycle structure (Nagorny: ~30 s total)
    clamp_close_s: float = 1.5
    injection_s: float = 1.8
    pack_s: float = 4.0
    cool_s: float = 16.0
    plasticize_s: float = 4.0
    clamp_open_s: float = 1.2
    ejection_s: float = 1.5

    # Mechanical setpoints
    shot_volume_cm3: float = 72.0  # ⇒ injection_s × flowrate_cm3_s ≈ shot vol
    clamp_force_kn: float = 1200.0
    cushion_target_mm: float = 4.5
    switchover_position_mm: float = 8.0

    # Hold profile — 10 steps (ADR-0001 §B). Default: ramp down packing pressure.
    hold_profile: list[HoldStep] = field(
        default_factory=lambda: [
            HoldStep(0.4, 400.1),
            HoldStep(0.4, 395.0),
            HoldStep(0.4, 388.0),  # step 3 — leading indicator slot
            HoldStep(0.4, 380.0),
            HoldStep(0.4, 372.0),
            HoldStep(0.4, 360.0),
            HoldStep(0.4, 340.0),
            HoldStep(0.4, 310.0),
            HoldStep(0.4, 270.0),
            HoldStep(0.4, 220.0),
        ]
    )

    # Barrel zone setpoints (6 zones, melt-temp profile)
    barrel_zone_temps_k: tuple[float, ...] = (483.2, 493.2, 498.2, 503.2, 508.2, 510.2)
    nozzle_temp_k: float = 513.2

    # Hydraulic / oil
    oil_temp_k: float = 318.0  # ~45°C steady state

    # Ambient
    ambient_temp_k: float = 295.0
    ambient_humidity_pct: float = 45.0


@dataclass(frozen=True)
class MachineConfig:
    machine_id: str
    model: str = "Virtual-IMM-Horizontal-1200kN"
    sample_rate_hz_tier_a: float = 100.0   # Nagorny 2017
    sample_rate_hz_tier_b: float = 5.0
    packet_rate_hz: float = 10.0           # ~10 packets/s/machine
    rng_seed: int = 42
    setpoints: Setpoints = field(default_factory=Setpoints)
