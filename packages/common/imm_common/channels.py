"""Locked IMM channel taxonomy — single source of truth.

Grounded in:
  - Aslantas et al. (2022), JAIDA — Vestel IMM tag list.
  - Rousopoulou et al. (2020), Frontiers in AI — CERTH IMM channel set.
  - Nagorny et al. (2017), CIVEMSA — 100 Hz in-mold + machine signals.
  - Michiels et al. (2022), arXiv — Moldflow simulation parameters.

Adding or renaming a channel REQUIRES amending docs/adr/0001-channel-set.md.
"""
from __future__ import annotations

from enum import StrEnum


class SampleRateTier(StrEnum):
    """Sample-rate tiers, per docs/plan.md §3.1."""

    A_HIGH = "A"        # ~100-1000 Hz, intra-cycle curves
    B_MEDIUM = "B"      # ~1-10 Hz, slow continuous (temps, currents)
    C_PER_CYCLE = "C"   # one value per cycle (scalars)
    D_CONTEXT = "D"     # static / per-shift context


# ---------------------------------------------------------------------------
# Tier A — intra-cycle continuous curves (100 Hz canonical, Nagorny 2017)
# ---------------------------------------------------------------------------
TIER_A_CURVES: dict[str, str] = {
    "cavity_pressure_1":          "In-mold cavity pressure, sensor 1 [bar]",
    "cavity_pressure_2":          "In-mold cavity pressure, sensor 2 [bar]",
    "cavity_temperature_1":       "In-mold cavity temperature, sensor 1 [K]",
    "cavity_temperature_2":       "In-mold cavity temperature, sensor 2 [K]",
    "hydraulic_injection_pressure": "Hydraulic injection-side pressure [bar]",
    "screw_position":             "Screw axial position [mm]",
    "screw_velocity":             "Screw axial velocity [mm/s]",
    "ram_position":               "Ram (toggle) position [mm]",
}

# ---------------------------------------------------------------------------
# Tier B — slow continuous (1-10 Hz)
# ---------------------------------------------------------------------------
TIER_B_SLOW: dict[str, str] = {
    "barrel_zone_temp_1":         "Barrel heater zone 1 temperature [K]",
    "barrel_zone_temp_2":         "Barrel heater zone 2 temperature [K]",
    "barrel_zone_temp_3":         "Barrel heater zone 3 temperature [K]",
    "barrel_zone_temp_4":         "Barrel heater zone 4 temperature [K]",
    "barrel_zone_temp_5":         "Barrel heater zone 5 temperature [K]",
    "barrel_zone_temp_6":         "Barrel heater zone 6 temperature [K]",
    "nozzle_temp":                "Nozzle temperature [K]",
    "oil_temperature":            "Hydraulic oil temperature [K] (Aslantas OIL_TEMPERATURE)",
    "cooling_water_in_temp":      "Cooling water inlet temperature [K]",
    "cooling_water_out_temp":     "Cooling water outlet temperature [K]",
    "motor_current":              "Main motor current [A]",
    "vibration_pump_x":           "Hydraulic pump housing vibration X [g]",
    "vibration_pump_y":           "Hydraulic pump housing vibration Y [g]",
    "vibration_pump_z":           "Hydraulic pump housing vibration Z [g]",
    "vibration_motor_x":          "Drive motor housing vibration X [g]",
    "vibration_motor_y":          "Drive motor housing vibration Y [g]",
    "vibration_motor_z":          "Drive motor housing vibration Z [g]",
}

# ---------------------------------------------------------------------------
# Tier C — per-cycle scalars (union of Aslantas + Rousopoulou tag lists)
# ---------------------------------------------------------------------------
TIER_C_SCALARS: dict[str, str] = {
    # Timing
    "cycle_time_actual":          "Actual cycle time [s] (Aslantas ZUx-actual)",
    "cycle_time_set":             "Setpoint cycle time [s] (Aslantas ZU-sets)",
    "injection_time_actual":      "Actual injection time [s] (Aslantas ZSx-actual)",
    "injection_time_set":         "Setpoint injection time [s]",
    "cooling_time":               "Cooling time [s]",
    "plasticizing_time":          "Plasticizing time [s]",
    "mold_protection_time":       "Mold-protection guard time [s]",

    # Hold profile (10 programmable steps — see ADR-0001 §B)
    "hold_pressure_step_1":       "Hold pressure step 1 [bar] (Aslantas HOLD_PRESS_STEP_1)",
    "hold_pressure_step_2":       "Hold pressure step 2 [bar]",
    "hold_pressure_step_3":       "Hold pressure step 3 [bar]",
    "hold_pressure_step_4":       "Hold pressure step 4 [bar]",
    "hold_pressure_step_5":       "Hold pressure step 5 [bar]",
    "hold_pressure_step_6":       "Hold pressure step 6 [bar]",
    "hold_pressure_step_7":       "Hold pressure step 7 [bar]",
    "hold_pressure_step_8":       "Hold pressure step 8 [bar]",
    "hold_pressure_step_9":       "Hold pressure step 9 [bar]",
    "hold_pressure_step_10":      "Hold pressure step 10 [bar]",
    "hydr_hold_pressure_peak":    "Hydraulic hold pressure peak [bar] (Aslantas HYDR_HOLD_PRESS)",

    # Injection / switchover
    "injection_pressure_peak":    "Peak injection pressure [bar]",
    "injection_pressure_mean":    "Mean injection pressure during fill [bar]",
    "switchover_pressure":        "Pressure at velocity→pressure switchover [bar]",
    "switchover_position":        "Screw position at switchover [mm]",

    # Screw / cushion
    "plasticizing_position_corrected": "Corrected plasticizing position [mm]",
    "cushion_min":                "Minimum material cushion [mm] (Aslantas CPx)",

    # Clamp
    "clamp_force_actual":         "Actual clamping force [kN]",
    "clamp_force_set":            "Setpoint clamping force [kN]",
    "closing_force_actual":       "Closing force actual [kN] (Aslantas Skx)",

    # Counters
    "shot_counter":               "Lifetime shot counter",
    "bad_shot_counter":           "Lifetime bad-shot counter",
    "part_counter":               "Lifetime part counter",
    "bad_part_counter_indicator": "Bad-part indicator (current cycle)",

    # Config
    "cavities_active":            "Active cavity count (3 or 4 per Rousopoulou)",
}

# ---------------------------------------------------------------------------
# Tier D — contextual / per-shift / static
# ---------------------------------------------------------------------------
TIER_D_CONTEXT: dict[str, str] = {
    "material_lot_id":            "Material lot identifier",
    "mold_id":                    "Mold/tool identifier",
    "operator_id":                "Operator identifier",
    "ambient_temp":               "Factory ambient temperature [K]",
    "ambient_humidity":           "Factory ambient relative humidity [%]",
}


class Channel(StrEnum):
    """Enum of every legal channel name. Use this for tag-bound code paths."""

    # Tier A
    CAVITY_PRESSURE_1 = "cavity_pressure_1"
    CAVITY_PRESSURE_2 = "cavity_pressure_2"
    CAVITY_TEMPERATURE_1 = "cavity_temperature_1"
    CAVITY_TEMPERATURE_2 = "cavity_temperature_2"
    HYDRAULIC_INJECTION_PRESSURE = "hydraulic_injection_pressure"
    SCREW_POSITION = "screw_position"
    SCREW_VELOCITY = "screw_velocity"
    RAM_POSITION = "ram_position"

    # Tier B
    BARREL_ZONE_TEMP_1 = "barrel_zone_temp_1"
    BARREL_ZONE_TEMP_2 = "barrel_zone_temp_2"
    BARREL_ZONE_TEMP_3 = "barrel_zone_temp_3"
    BARREL_ZONE_TEMP_4 = "barrel_zone_temp_4"
    BARREL_ZONE_TEMP_5 = "barrel_zone_temp_5"
    BARREL_ZONE_TEMP_6 = "barrel_zone_temp_6"
    NOZZLE_TEMP = "nozzle_temp"
    OIL_TEMPERATURE = "oil_temperature"
    COOLING_WATER_IN_TEMP = "cooling_water_in_temp"
    COOLING_WATER_OUT_TEMP = "cooling_water_out_temp"
    MOTOR_CURRENT = "motor_current"
    VIBRATION_PUMP_X = "vibration_pump_x"
    VIBRATION_PUMP_Y = "vibration_pump_y"
    VIBRATION_PUMP_Z = "vibration_pump_z"
    VIBRATION_MOTOR_X = "vibration_motor_x"
    VIBRATION_MOTOR_Y = "vibration_motor_y"
    VIBRATION_MOTOR_Z = "vibration_motor_z"


def tier_of(name: str) -> SampleRateTier:
    if name in TIER_A_CURVES:
        return SampleRateTier.A_HIGH
    if name in TIER_B_SLOW:
        return SampleRateTier.B_MEDIUM
    if name in TIER_C_SCALARS:
        return SampleRateTier.C_PER_CYCLE
    if name in TIER_D_CONTEXT:
        return SampleRateTier.D_CONTEXT
    raise KeyError(f"Unknown channel {name!r} — amend ADR-0001 before using.")


ALL_CHANNELS: dict[str, str] = {
    **TIER_A_CURVES,
    **TIER_B_SLOW,
    **TIER_C_SCALARS,
    **TIER_D_CONTEXT,
}

# Per-component hint: which channels are leading indicators for each subsystem.
# Used by the rules engine (M11) and feature->task mapping (docs/plan.md §5.3).
COMPONENT_LEADING_CHANNELS: dict[str, tuple[str, ...]] = {
    "hydraulic": (
        "hydraulic_injection_pressure", "oil_temperature",
        "hydr_hold_pressure_peak", "vibration_pump_x", "vibration_pump_y", "vibration_pump_z",
    ),
    "screw": (
        "cushion_min", "injection_pressure_peak", "plasticizing_time",
        "plasticizing_position_corrected", "hold_pressure_step_3",
    ),
    "mold": (
        "cavity_pressure_1", "cavity_pressure_2",
        "cavity_temperature_1", "cavity_temperature_2",
        "cooling_water_in_temp", "cooling_water_out_temp", "cooling_time",
    ),
    "heater": (
        "barrel_zone_temp_1", "barrel_zone_temp_2", "barrel_zone_temp_3",
        "barrel_zone_temp_4", "barrel_zone_temp_5", "barrel_zone_temp_6",
        "nozzle_temp",
    ),
    "motor": (
        "motor_current", "vibration_motor_x", "vibration_motor_y", "vibration_motor_z",
    ),
    "clamp": (
        "clamp_force_actual", "closing_force_actual", "mold_protection_time",
    ),
}
