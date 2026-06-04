// Sensor Visualization Engine — channel registry + adaptive threshold model.
//
// The simulator's absolute magnitudes aren't fixed contractually, so rather than
// hard-code fragile absolute limits we derive a normal envelope from a rolling
// baseline of the live signal. Each channel still carries units, a plain-English
// description and a "betterWhen" direction so the charts + tooltips can say
// whether a reading is good or bad and what it means operationally.

export interface ChannelMeta {
  key: string;
  label: string;
  unit: string;
  what: string;
  /** Which direction is healthy — used to phrase the interpretation. */
  betterWhen: "high" | "low" | "stable";
}

export const CHANNELS: Record<string, ChannelMeta> = {
  // scalars
  cycle_time: { key: "cycle_time", label: "Cycle Time", unit: "s", what: "Total time for one shot. Creeps up as the drive or heaters lose performance.", betterWhen: "low" },
  injection_time: { key: "injection_time", label: "Injection Time", unit: "s", what: "Fill duration. Stretches when melt temperature drifts or pressure sags.", betterWhen: "stable" },
  hold_time: { key: "hold_time", label: "Hold Time", unit: "s", what: "Pressure-hold duration after fill.", betterWhen: "stable" },
  cooling_time: { key: "cooling_time", label: "Cooling Time", unit: "s", what: "Solidification time in the mold. Rises with clamp/tooling wear.", betterWhen: "low" },
  cushion_min: { key: "cushion_min", label: "Cushion", unit: "mm", what: "Melt pad left at end of hold. Falls as the check ring leaks back.", betterWhen: "high" },
  peak_injection_pressure: { key: "peak_injection_pressure", label: "Peak Inj. Pressure", unit: "bar", what: "Maximum fill pressure. Sags as the hydraulic pump wears.", betterWhen: "stable" },
  peak_cavity_pressure: { key: "peak_cavity_pressure", label: "Peak Cavity Pressure", unit: "bar", what: "Maximum in-cavity pressure — a direct quality driver.", betterWhen: "stable" },
  switchover_position: { key: "switchover_position", label: "Switchover Position", unit: "mm", what: "Screw position at fill→pack transition.", betterWhen: "stable" },
  switchover_pressure: { key: "switchover_pressure", label: "Switchover Pressure", unit: "bar", what: "Pressure at the fill→pack transition.", betterWhen: "stable" },
  shot_volume: { key: "shot_volume", label: "Shot Volume", unit: "cm³", what: "Metered volume per shot.", betterWhen: "stable" },
  clamp_force_peak: { key: "clamp_force_peak", label: "Clamp Force", unit: "kN", what: "Peak force holding the mold shut. Decays as the clamp wears.", betterWhen: "high" },
  back_pressure: { key: "back_pressure", label: "Back Pressure", unit: "bar", what: "Resistance during screw recovery.", betterWhen: "stable" },
  screw_rpm: { key: "screw_rpm", label: "Screw RPM", unit: "rpm", what: "Plastication speed. Falls as the drive loses torque.", betterWhen: "high" },
  oil_temperature: { key: "oil_temperature", label: "Oil Temperature", unit: "°C", what: "Hydraulic oil temperature. Climbs as the pump becomes inefficient.", betterWhen: "low" },
  // curves
  cavity_pressure: { key: "cavity_pressure", label: "Cavity Pressure", unit: "bar", what: "In-cavity pressure trace over the shot — the signature of part quality.", betterWhen: "stable" },
  hydraulic_injection_pressure: { key: "hydraulic_injection_pressure", label: "Hyd. Injection Pressure", unit: "bar", what: "Pump pressure trace driving injection.", betterWhen: "stable" },
  screw_position: { key: "screw_position", label: "Screw Position", unit: "mm", what: "Screw position trace through the shot.", betterWhen: "stable" },
  screw_velocity: { key: "screw_velocity", label: "Screw Velocity", unit: "mm/s", what: "Screw velocity trace through the shot.", betterWhen: "stable" },
  nozzle_temperature: { key: "nozzle_temperature", label: "Nozzle Temperature", unit: "°C", what: "Nozzle setpoint oscillation — heater control quality.", betterWhen: "stable" },
};

export const SCALAR_CHANNELS = [
  "cycle_time", "injection_time", "hold_time", "cooling_time", "cushion_min",
  "peak_injection_pressure", "peak_cavity_pressure", "switchover_position",
  "switchover_pressure", "shot_volume", "clamp_force_peak", "back_pressure",
  "screw_rpm", "oil_temperature",
];
export const CURVE_CHANNELS = [
  "cavity_pressure", "hydraulic_injection_pressure", "screw_position", "screw_velocity", "nozzle_temperature",
];

export function channelMeta(key: string): ChannelMeta {
  return (
    CHANNELS[key] ?? { key, label: key.replace(/_/g, " "), unit: "", what: "", betterWhen: "stable" }
  );
}

export interface Band {
  /** baseline (median of recent samples) */
  base: number;
  warnLo: number;
  warnHi: number;
  critLo: number;
  critHi: number;
  min: number;
  max: number;
}

/**
 * Build a normal/warning/critical envelope from a baseline value. Warning at
 * ±6%, critical at ±12% of the baseline magnitude (with a small absolute floor
 * so near-zero channels still get a sane band).
 */
export function bandFromBaseline(base: number): Band {
  const mag = Math.max(Math.abs(base), 1);
  const warn = mag * 0.06;
  const crit = mag * 0.12;
  return {
    base,
    warnLo: base - warn,
    warnHi: base + warn,
    critLo: base - crit,
    critHi: base + crit,
    min: base - crit * 1.6,
    max: base + crit * 1.6,
  };
}

export type BandLevel = "normal" | "warning" | "critical";

export function levelOf(value: number, band: Band): BandLevel {
  if (value < band.critLo || value > band.critHi) return "critical";
  if (value < band.warnLo || value > band.warnHi) return "warning";
  return "normal";
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
