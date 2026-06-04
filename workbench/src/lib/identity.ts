// Subsystem identity — the single canonical bridge between the UI's Subsystem
// enum (from the classification taxonomy) and the backend's component model
// (snake_case health/RUL keys + fault ids), plus the human-facing knowledge
// (what it does, which sensors feed it, how it fails) that powers the
// self-explaining tooltips.
//
// Everything downstream — rail, mesh tint, detail panel, charts, alerts —
// enumerates from here, so adding a subsystem is a one-line change.

import { SUBSYSTEMS, SUBSYSTEM_META, type Subsystem } from "@/subsystems";

export interface SubsystemIdentity {
  subsystem: Subsystem;
  /** Backend health/rul_per_component key (snake_case). Null for Unknown. */
  backendKey: string | null;
  /** Fault id understood by POST /api/fault. Null for Unknown. */
  faultId: string | null;
  /** Identity colour (hex), shared with classification view. */
  color: string;
  /** Short human label. */
  label: string;
  /** One line: what this subsystem is. */
  what: string;
  /** Scalar snapshot channels that report on this subsystem (for the summary). */
  scalarChannels: string[];
  /** Curve snapshot channels that report on this subsystem. */
  curveChannels: string[];
  /** Common degradation signature (what you'd see as it wears). */
  failureSignature: string;
}

const LABELS: Record<Subsystem, string> = {
  Hydraulic: "Hydraulic",
  ScrewCheckRing: "Screw & Check Ring",
  Drive: "Drive",
  Heaters: "Heaters",
  Mold: "Mold & Clamp",
  Unknown: "Structure",
};

export const IDENTITY: Record<Subsystem, SubsystemIdentity> = {
  Hydraulic: {
    subsystem: "Hydraulic",
    backendKey: "hydraulic",
    faultId: "hydraulic_pump_wear",
    color: SUBSYSTEM_META.Hydraulic.color,
    label: LABELS.Hydraulic,
    what: "Pumps, valves, cylinders, accumulators and oil circuit that generate and move hydraulic power.",
    scalarChannels: ["peak_injection_pressure", "oil_temperature", "back_pressure", "switchover_pressure"],
    curveChannels: ["hydraulic_injection_pressure"],
    failureSignature: "Injection pressure sags and oil temperature climbs as the pump loses volumetric efficiency.",
  },
  ScrewCheckRing: {
    subsystem: "ScrewCheckRing",
    backendKey: "screw_check_ring",
    faultId: "check_ring_wear",
    color: SUBSYSTEM_META.ScrewCheckRing.color,
    label: LABELS.ScrewCheckRing,
    what: "Reciprocating screw, non-return check ring, barrel internals and nozzle tip that meter and inject the melt.",
    scalarChannels: ["cushion_min", "peak_cavity_pressure", "shot_volume", "switchover_position"],
    curveChannels: ["cavity_pressure", "screw_position", "screw_velocity"],
    failureSignature: "Cushion drops and cavity-pressure repeatability degrades as the check ring leaks back.",
  },
  Drive: {
    subsystem: "Drive",
    backendKey: "drive",
    faultId: "drive_servo_wear",
    color: SUBSYSTEM_META.Drive.color,
    label: LABELS.Drive,
    what: "Motors, gearboxes, couplings and servo drive that rotate the screw and actuate motion.",
    scalarChannels: ["screw_rpm", "cycle_time"],
    curveChannels: ["screw_velocity"],
    failureSignature: "Screw RPM falls and cycle time stretches as the drive loses torque margin.",
  },
  Heaters: {
    subsystem: "Heaters",
    backendKey: "heaters",
    faultId: "heater_drift",
    color: SUBSYSTEM_META.Heaters.color,
    label: LABELS.Heaters,
    what: "Barrel heater bands, thermocouples and nozzle heaters that hold the melt-temperature profile.",
    scalarChannels: ["injection_time", "hold_time"],
    curveChannels: ["nozzle_temperature"],
    failureSignature: "Barrel-zone temperatures drift off setpoint and injection time stretches as control degrades.",
  },
  Mold: {
    subsystem: "Mold",
    backendKey: "mold",
    faultId: "mold_clamp_wear",
    color: SUBSYSTEM_META.Mold.color,
    label: LABELS.Mold,
    what: "Mold plates, cavities, cores, ejector assembly and the clamp/toggle that holds the tool closed.",
    scalarChannels: ["clamp_force_peak", "cooling_time"],
    curveChannels: [],
    failureSignature: "Clamp force decays and cooling time stretches as platen parallelism and tooling wear.",
  },
  Unknown: {
    subsystem: "Unknown",
    backendKey: null,
    faultId: null,
    color: SUBSYSTEM_META.Unknown.color,
    label: LABELS.Unknown,
    what: "Frame, guards, panels and other structure — not a monitored asset.",
    scalarChannels: [],
    curveChannels: [],
    failureSignature: "",
  },
};

/** The five monitored subsystems, in canonical display order (excludes Unknown). */
export const MONITORED: Subsystem[] = SUBSYSTEMS.filter((s) => IDENTITY[s].backendKey !== null);

const BY_BACKEND: Record<string, Subsystem> = Object.fromEntries(
  SUBSYSTEMS.filter((s) => IDENTITY[s].backendKey).map((s) => [IDENTITY[s].backendKey as string, s]),
);

export function subsystemFromBackendKey(key: string): Subsystem | null {
  return BY_BACKEND[key] ?? null;
}

export function identityOf(s: Subsystem): SubsystemIdentity {
  return IDENTITY[s];
}
