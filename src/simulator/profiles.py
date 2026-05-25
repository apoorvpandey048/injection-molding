"""Parametric curve templates for injection molding cycle phases.

Based on Aslantas (2022) and Rousopoulou (2020) signal shapes.
All templates return numpy arrays normalized to [0,1] time axis.
Callers scale to physical units and sample count.
"""
from __future__ import annotations

import numpy as np


def injection_pressure_curve(n: int, peak: float, ramp_frac: float = 0.15) -> np.ndarray:
    """Rising ramp to peak then sharp drop at switchover."""
    t = np.linspace(0, 1, n)
    ramp = np.minimum(t / ramp_frac, 1.0)
    hold = np.where(t < 0.6, 1.0, np.exp(-8 * (t - 0.6)))
    return peak * ramp * hold


def cavity_pressure_curve(n: int, peak: float, switchover_frac: float = 0.55) -> np.ndarray:
    """Delayed rise (cavity fills after switchover) then hold then cool decay."""
    t = np.linspace(0, 1, n)
    delay = switchover_frac
    rise = np.clip((t - delay) / 0.12, 0, 1)
    decay = np.where(t > 0.72, np.exp(-5 * (t - 0.72)), 1.0)
    return peak * rise * decay


def screw_position_curve(n: int, stroke: float, cushion: float) -> np.ndarray:
    """Screw moves forward (injection) then retracts (recovery)."""
    t = np.linspace(0, 1, n)
    forward = stroke * np.clip(1 - t / 0.45, 0, 1)
    retract = np.where(t > 0.6, cushion + (stroke - cushion) * np.clip((t - 0.6) / 0.35, 0, 1), 0)
    return np.where(t < 0.6, forward, retract)


def screw_velocity_curve(n: int, v_max: float) -> np.ndarray:
    """Derivative-shaped: fast during fill, zero during hold, negative during recovery."""
    t = np.linspace(0, 1, n)
    fill = v_max * np.exp(-((t - 0.1) ** 2) / 0.01) * (t < 0.45)
    recovery = -v_max * 0.4 * np.exp(-((t - 0.7) ** 2) / 0.015) * (t > 0.6)
    return fill + recovery


def nozzle_temperature_curve(n: int, setpoint: float, amplitude: float = 1.5) -> np.ndarray:
    """Slow sinusoidal oscillation around setpoint (heater cycling)."""
    t = np.linspace(0, 2 * np.pi, n)
    return setpoint + amplitude * np.sin(t)


def barrel_zone_temps(setpoints: list[float], noise_std: float = 0.3) -> list[float]:
    """Per-zone scalar temperatures with small noise."""
    rng = np.random.default_rng()
    return [float(s + rng.normal(0, noise_std)) for s in setpoints]


def hold_pressure_profile(p0: float, decay: float = 0.05, n_steps: int = 10) -> list[float]:
    """Exponentially decaying hold pressure over 10 steps."""
    return [float(p0 * np.exp(-decay * i)) for i in range(n_steps)]
