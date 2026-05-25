PROCESS_CURVES = {
    "cavity_pressure":              "bar",
    "hydraulic_injection_pressure": "bar",
    "screw_position":               "mm",
    "screw_velocity":               "mm/s",
    "nozzle_temperature":           "degC",
}

CYCLE_SCALARS = {
    "cycle_time":               "s",
    "injection_time":           "s",
    "hold_time":                "s",
    "cooling_time":             "s",
    "cushion_min":              "mm",
    "peak_injection_pressure":  "bar",
    "peak_cavity_pressure":     "bar",
    "switchover_position":      "mm",
    "switchover_pressure":      "bar",
    "shot_volume":              "cm3",
    "clamp_force_peak":         "kN",
    "back_pressure":            "bar",
    "screw_rpm":                "rpm",
    "oil_temperature":          "degC",
}

HOLD_PRESSURE_STEPS = [f"hold_pressure_step_{i}" for i in range(1, 11)]

BARREL_ZONES = [f"barrel_zone_temp_{i}" for i in range(1, 7)]

COMPONENTS = [
    "hydraulic",
    "screw_check_ring",
    "heaters",
    "drive",
    "mold",
]

FAULTS = ["check_ring_wear", "heater_drift", "hydraulic_pump_wear"]
