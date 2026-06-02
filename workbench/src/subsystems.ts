// Single source of truth for the machine subsystem taxonomy and its colour
// scheme. Both the classification UI (Phase 5) and the visual overlay (Phase 6)
// read from here, and the export contract (Phase 7) uses `SUBSYSTEMS` as the
// canonical key order. Adding a future subsystem only requires editing this list.

export const SUBSYSTEMS = [
  "Hydraulic",
  "ScrewCheckRing",
  "Drive",
  "Heaters",
  "Mold",
  "Unknown",
] as const;

export type Subsystem = (typeof SUBSYSTEMS)[number];

/** The category every mesh starts in until an expert assigns it. */
export const DEFAULT_SUBSYSTEM: Subsystem = "Unknown";

export interface SubsystemMeta {
  /** Phase 6 colour, as a CSS / hex string. */
  color: string;
  /** Short label for keyboard-shortcut hints. */
  hotkey: string;
  /** One-line description shown in tooltips to guide domain experts. */
  hint: string;
}

export const SUBSYSTEM_META: Record<Subsystem, SubsystemMeta> = {
  Hydraulic: {
    color: "#3b82f6", // Blue
    hotkey: "1",
    hint: "Pumps, valves, cylinders, accumulators, hoses — anything carrying hydraulic oil.",
  },
  ScrewCheckRing: {
    color: "#f97316", // Orange
    hotkey: "2",
    hint: "Reciprocating screw, non-return check ring, barrel internals, nozzle tip.",
  },
  Drive: {
    color: "#22c55e", // Green
    hotkey: "3",
    hint: "Motors, gearboxes, couplings, toggle linkage and clamp drive.",
  },
  Heaters: {
    color: "#eab308", // Yellow
    hotkey: "4",
    hint: "Barrel heater bands, thermocouples, nozzle heaters, insulation.",
  },
  Mold: {
    color: "#a855f7", // Purple
    hotkey: "5",
    hint: "Mold plates, cavities, cores, ejector assembly, mounting platens.",
  },
  Unknown: {
    color: "#9ca3af", // Gray
    hotkey: "0",
    hint: "Unclassified — frame, guards, panels, or anything not yet identified.",
  },
};

export function subsystemColor(s: Subsystem): string {
  return SUBSYSTEM_META[s].color;
}

/** Map a single-key press to a subsystem (used for fast keyboard classification). */
export const HOTKEY_TO_SUBSYSTEM: Record<string, Subsystem> = Object.fromEntries(
  SUBSYSTEMS.map((s) => [SUBSYSTEM_META[s].hotkey, s]),
) as Record<string, Subsystem>;
