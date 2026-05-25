"""Process model — phase FSM + parametric curve generators for one IMM cycle.

Healthy baseline only (M2). No degradation, no shock noise, no sensor faults.
M5 will extend this with the hidden component-health state.

All curves are analytic (piecewise functions), not ODE-integrated, for speed
and reproducibility. The shapes were calibrated against the published curves
in Nagorny et al. (2017) Fig. 2 and Michiels et al. (2022) Fig. 1b.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from .config import MachineConfig, Setpoints


# ---------------------------------------------------------------------------
# Phase timing
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class PhaseTimings:
    """Boundary times within one cycle, all relative to cycle start (seconds)."""

    t_clamp_close_end: float
    t_inj_end: float        # end of injection (== start of pack)
    t_pack_end: float       # end of pack (== start of cool)
    t_cool_end: float
    t_plasticize_end: float
    t_clamp_open_end: float
    t_eject_end: float      # == total cycle length

    @classmethod
    def from_setpoints(cls, sp: Setpoints) -> "PhaseTimings":
        t0 = sp.clamp_close_s
        t1 = t0 + sp.injection_s
        t2 = t1 + sp.pack_s
        t3 = t2 + sp.cool_s
        t4 = t3 + sp.plasticize_s
        t5 = t4 + sp.clamp_open_s
        t6 = t5 + sp.ejection_s
        return cls(t0, t1, t2, t3, t4, t5, t6)

    @property
    def total_s(self) -> float:
        return self.t_eject_end


# ---------------------------------------------------------------------------
# Parametric curves (single cycle, vectorised)
# ---------------------------------------------------------------------------
def _hold_profile_eval(t_in_pack: np.ndarray, sp: Setpoints) -> np.ndarray:
    """Piecewise-constant 10-step hold pressure profile during pack."""
    out = np.zeros_like(t_in_pack)
    edges = np.cumsum([s.duration_s for s in sp.hold_profile])
    pressures = np.array([s.pressure_bar for s in sp.hold_profile])
    idx = np.searchsorted(edges, t_in_pack, side="right")
    idx = np.clip(idx, 0, len(pressures) - 1)
    out[:] = pressures[idx]
    return out


def cavity_pressure(t: np.ndarray, ph: PhaseTimings, sp: Setpoints) -> np.ndarray:
    """In-mold cavity pressure [bar]. Ramps during fill, follows hold profile,
    exponential decay during cool, ~0 elsewhere."""
    p = np.zeros_like(t)
    # Fill: piecewise-linear 0 → peak (10% above pack)
    fill_mask = (t >= ph.t_clamp_close_end) & (t < ph.t_inj_end)
    if fill_mask.any():
        prog = (t[fill_mask] - ph.t_clamp_close_end) / (ph.t_inj_end - ph.t_clamp_close_end)
        p[fill_mask] = 1.1 * sp.packing_pressure_bar * prog
    # Pack: follow programmed hold profile
    pack_mask = (t >= ph.t_inj_end) & (t < ph.t_pack_end)
    if pack_mask.any():
        p[pack_mask] = _hold_profile_eval(t[pack_mask] - ph.t_inj_end, sp)
    # Cool: exponential decay
    cool_mask = (t >= ph.t_pack_end) & (t < ph.t_cool_end)
    if cool_mask.any():
        p0 = _hold_profile_eval(np.array([ph.t_pack_end - ph.t_inj_end - 1e-6]), sp)[0]
        tau = max(0.6 * (ph.t_cool_end - ph.t_pack_end), 1.0)
        p[cool_mask] = p0 * np.exp(-(t[cool_mask] - ph.t_pack_end) / tau)
    return p


def hydraulic_injection_pressure(t: np.ndarray, ph: PhaseTimings, sp: Setpoints) -> np.ndarray:
    """Hydraulic side of the injection unit. ~30% higher than cavity at peak."""
    cav = cavity_pressure(t, ph, sp)
    return cav * 1.3


def screw_position(t: np.ndarray, ph: PhaseTimings, sp: Setpoints) -> np.ndarray:
    """Screw axial position [mm]. Starts at shot_pos, moves to cushion during
    injection, holds during pack, retracts during plasticize."""
    # Shot position derived from shot volume (assume effective screw area)
    area_cm2 = 8.0
    shot_pos_mm = (sp.shot_volume_cm3 / area_cm2) * 10.0 + sp.cushion_target_mm
    pos = np.full_like(t, shot_pos_mm)
    # Injection: linear from shot_pos to cushion
    inj_mask = (t >= ph.t_clamp_close_end) & (t < ph.t_inj_end)
    if inj_mask.any():
        prog = (t[inj_mask] - ph.t_clamp_close_end) / (ph.t_inj_end - ph.t_clamp_close_end)
        pos[inj_mask] = shot_pos_mm + (sp.cushion_target_mm - shot_pos_mm) * prog
    # Pack: hold at cushion
    pack_mask = (t >= ph.t_inj_end) & (t < ph.t_pack_end)
    pos[pack_mask] = sp.cushion_target_mm
    # Cool: still at cushion
    cool_mask = (t >= ph.t_pack_end) & (t < ph.t_cool_end)
    pos[cool_mask] = sp.cushion_target_mm
    # Plasticize: ramp back up to shot position
    plast_mask = (t >= ph.t_cool_end) & (t < ph.t_plasticize_end)
    if plast_mask.any():
        prog = (t[plast_mask] - ph.t_cool_end) / (ph.t_plasticize_end - ph.t_cool_end)
        pos[plast_mask] = sp.cushion_target_mm + (shot_pos_mm - sp.cushion_target_mm) * prog
    return pos


def screw_velocity(pos: np.ndarray, dt: float) -> np.ndarray:
    """Numerical derivative of screw position [mm/s]."""
    v = np.gradient(pos, dt)
    return v


def ram_position(t: np.ndarray, ph: PhaseTimings, stroke_mm: float = 400.0) -> np.ndarray:
    """Clamp ram position [mm]. 0 at open, stroke at closed."""
    pos = np.full_like(t, stroke_mm)
    # Clamp close ramp
    close_mask = t < ph.t_clamp_close_end
    if close_mask.any():
        prog = t[close_mask] / max(ph.t_clamp_close_end, 1e-6)
        pos[close_mask] = prog * stroke_mm
    # Clamp open ramp
    open_mask = (t >= ph.t_plasticize_end) & (t < ph.t_clamp_open_end)
    if open_mask.any():
        prog = (t[open_mask] - ph.t_plasticize_end) / (ph.t_clamp_open_end - ph.t_plasticize_end)
        pos[open_mask] = stroke_mm * (1.0 - prog)
    # Ejection: stays at 0
    eject_mask = t >= ph.t_clamp_open_end
    pos[eject_mask] = 0.0
    return pos


def cavity_temperature(t: np.ndarray, ph: PhaseTimings, sp: Setpoints) -> np.ndarray:
    """In-mold temperature [K]. Rises during inject+pack, decays during cool."""
    T_ambient = sp.cooling_water_temp_k
    T_melt = sp.melt_temp_k
    T = np.full_like(t, T_ambient)
    # Rise during fill+pack: 1 - exp(-(t-t0)/tau)
    heat_mask = (t >= ph.t_clamp_close_end) & (t < ph.t_pack_end)
    if heat_mask.any():
        tau = 0.5 * (ph.t_pack_end - ph.t_clamp_close_end)
        T[heat_mask] = T_ambient + (T_melt - T_ambient) * (
            1.0 - np.exp(-(t[heat_mask] - ph.t_clamp_close_end) / tau)
        )
    # Decay during cool
    cool_mask = (t >= ph.t_pack_end) & (t < ph.t_cool_end)
    if cool_mask.any():
        T0 = T_ambient + (T_melt - T_ambient) * (1.0 - np.exp(-(ph.t_pack_end - ph.t_clamp_close_end) / (0.5 * (ph.t_pack_end - ph.t_clamp_close_end))))
        tau_c = 0.4 * (ph.t_cool_end - ph.t_pack_end)
        T[cool_mask] = T_ambient + (T0 - T_ambient) * np.exp(-(t[cool_mask] - ph.t_pack_end) / tau_c)
    return T


def barrel_zone_temp(zone_setpoint_k: float, n: int, rng: np.random.Generator) -> np.ndarray:
    """6 barrel zones — slowly varying around setpoint. PID is fast on these
    so std is small (~0.5 K)."""
    return zone_setpoint_k + rng.normal(0.0, 0.5, size=n)


def vibration(n: int, drive_hz: float, fs: float, amp: float, rng: np.random.Generator) -> np.ndarray:
    """Drive-frequency baseline + harmonics + white noise. Units: g."""
    t = np.arange(n) / fs
    sig = (
        amp * np.sin(2 * np.pi * drive_hz * t)
        + 0.4 * amp * np.sin(2 * np.pi * 2 * drive_hz * t)
        + 0.2 * amp * np.sin(2 * np.pi * 3 * drive_hz * t)
    )
    sig += rng.normal(0.0, 0.15 * amp, size=n)
    return sig


def motor_current(t: np.ndarray, ph: PhaseTimings) -> np.ndarray:
    """Motor current [A]. Spikes during injection and plasticizing."""
    base = 15.0
    out = np.full_like(t, base)
    inj_mask = (t >= ph.t_clamp_close_end) & (t < ph.t_inj_end)
    out[inj_mask] = base + 35.0
    plast_mask = (t >= ph.t_cool_end) & (t < ph.t_plasticize_end)
    out[plast_mask] = base + 25.0
    return out


# ---------------------------------------------------------------------------
# Per-cycle scalar extraction (Tier C)
# ---------------------------------------------------------------------------
def cycle_scalars(
    ph: PhaseTimings,
    sp: Setpoints,
    cav_p: np.ndarray,
    hyd_p: np.ndarray,
    screw_pos: np.ndarray,
    rng: np.random.Generator,
) -> dict[str, float]:
    """Compute the locked Tier-C scalar set for one healthy cycle."""
    inj_dur = ph.t_inj_end - ph.t_clamp_close_end
    s: dict[str, float] = {
        "cycle_time_actual":          ph.total_s + float(rng.normal(0.0, 0.02)),
        "cycle_time_set":             ph.total_s,
        "injection_time_actual":      inj_dur + float(rng.normal(0.0, 0.01)),
        "injection_time_set":         sp.injection_s,
        "cooling_time":               sp.cool_s,
        "plasticizing_time":          sp.plasticize_s + float(rng.normal(0.0, 0.05)),
        "mold_protection_time":       1.0,
        "hydr_hold_pressure_peak":    float(hyd_p.max()),
        "injection_pressure_peak":    float(cav_p.max()),
        "injection_pressure_mean":    float(cav_p[(cav_p > 0)].mean()) if (cav_p > 0).any() else 0.0,
        "switchover_pressure":        float(cav_p.max()) * 0.95,
        "switchover_position":        sp.switchover_position_mm + float(rng.normal(0.0, 0.05)),
        "plasticizing_position_corrected": float(screw_pos.max()),
        "cushion_min":                sp.cushion_target_mm + float(rng.normal(0.0, 0.03)),
        "clamp_force_actual":         sp.clamp_force_kn + float(rng.normal(0.0, 5.0)),
        "clamp_force_set":            sp.clamp_force_kn,
        "closing_force_actual":       sp.clamp_force_kn * 0.98 + float(rng.normal(0.0, 5.0)),
        "cavities_active":            4.0,
    }
    # Hold profile actuals — small noise around setpoints
    for i, step in enumerate(sp.hold_profile, start=1):
        s[f"hold_pressure_step_{i}"] = step.pressure_bar + float(rng.normal(0.0, 1.5))
    return s


# ---------------------------------------------------------------------------
# Full cycle generator
# ---------------------------------------------------------------------------
@dataclass
class CycleOutput:
    """Everything generated for one cycle."""

    cycle_id: int
    t_start: datetime
    t_end: datetime
    phases: PhaseTimings
    fs_a: float
    fs_b: float
    # channel name -> np.ndarray (Tier-A + Tier-B continuous channels)
    streams: dict[str, np.ndarray]
    # Tier-C scalars
    scalars: dict[str, float]


def simulate_cycle(
    cfg: MachineConfig,
    cycle_id: int,
    t_start: datetime,
    rng: np.random.Generator,
) -> CycleOutput:
    sp = cfg.setpoints
    ph = PhaseTimings.from_setpoints(sp)
    fs_a = cfg.sample_rate_hz_tier_a
    fs_b = cfg.sample_rate_hz_tier_b
    n_a = int(ph.total_s * fs_a)
    t_a = np.arange(n_a) / fs_a

    cav_p1 = cavity_pressure(t_a, ph, sp) + rng.normal(0.0, 2.0, size=n_a)
    cav_p2 = cavity_pressure(t_a, ph, sp) * 0.97 + rng.normal(0.0, 2.0, size=n_a)
    cav_T1 = cavity_temperature(t_a, ph, sp) + rng.normal(0.0, 0.3, size=n_a)
    cav_T2 = cavity_temperature(t_a, ph, sp) * 0.99 + rng.normal(0.0, 0.3, size=n_a)
    hyd_p = hydraulic_injection_pressure(t_a, ph, sp) + rng.normal(0.0, 3.0, size=n_a)
    screw_pos = screw_position(t_a, ph, sp) + rng.normal(0.0, 0.02, size=n_a)
    screw_vel = screw_velocity(screw_pos, 1.0 / fs_a)
    ram_pos = ram_position(t_a, ph) + rng.normal(0.0, 0.05, size=n_a)
    mot_i = motor_current(t_a, ph) + rng.normal(0.0, 0.5, size=n_a)

    # Vibration — Tier A. 25 Hz drive frequency (1500 rpm) is plausible.
    vib_p_x = vibration(n_a, drive_hz=25.0, fs=fs_a, amp=0.15, rng=rng)
    vib_p_y = vibration(n_a, drive_hz=25.0, fs=fs_a, amp=0.10, rng=rng)
    vib_p_z = vibration(n_a, drive_hz=25.0, fs=fs_a, amp=0.08, rng=rng)
    vib_m_x = vibration(n_a, drive_hz=50.0, fs=fs_a, amp=0.20, rng=rng)
    vib_m_y = vibration(n_a, drive_hz=50.0, fs=fs_a, amp=0.18, rng=rng)
    vib_m_z = vibration(n_a, drive_hz=50.0, fs=fs_a, amp=0.12, rng=rng)

    # Tier B — sampled at the same length as Tier A for simplicity (publisher
    # will downsample). The slow signals are slowly varying.
    bz = [barrel_zone_temp(zk, n_a, rng) for zk in sp.barrel_zone_temps_k]
    nozzle = sp.nozzle_temp_k + rng.normal(0.0, 0.5, size=n_a)
    oil = sp.oil_temp_k + rng.normal(0.0, 0.2, size=n_a)
    cw_in = sp.cooling_water_temp_k + rng.normal(0.0, 0.1, size=n_a)
    cw_out = (sp.cooling_water_temp_k + 4.0) + rng.normal(0.0, 0.15, size=n_a)

    streams: dict[str, np.ndarray] = {
        # Tier A
        "cavity_pressure_1": cav_p1,
        "cavity_pressure_2": cav_p2,
        "cavity_temperature_1": cav_T1,
        "cavity_temperature_2": cav_T2,
        "hydraulic_injection_pressure": hyd_p,
        "screw_position": screw_pos,
        "screw_velocity": screw_vel,
        "ram_position": ram_pos,
        # Tier B
        "barrel_zone_temp_1": bz[0],
        "barrel_zone_temp_2": bz[1],
        "barrel_zone_temp_3": bz[2],
        "barrel_zone_temp_4": bz[3],
        "barrel_zone_temp_5": bz[4],
        "barrel_zone_temp_6": bz[5],
        "nozzle_temp": nozzle,
        "oil_temperature": oil,
        "cooling_water_in_temp": cw_in,
        "cooling_water_out_temp": cw_out,
        "motor_current": mot_i,
        "vibration_pump_x": vib_p_x,
        "vibration_pump_y": vib_p_y,
        "vibration_pump_z": vib_p_z,
        "vibration_motor_x": vib_m_x,
        "vibration_motor_y": vib_m_y,
        "vibration_motor_z": vib_m_z,
    }

    scalars = cycle_scalars(ph, sp, cav_p1, hyd_p, screw_pos, rng)

    return CycleOutput(
        cycle_id=cycle_id,
        t_start=t_start,
        t_end=t_start + timedelta(seconds=ph.total_s),
        phases=ph,
        fs_a=fs_a,
        fs_b=fs_b,
        streams=streams,
        scalars=scalars,
    )
