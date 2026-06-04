// Component Health Engine + RUL Engine (derivation layer).
//
// Turns the raw backend snapshot into the per-subsystem condition objects the
// UI renders: health %, status band, trend direction, RUL horizon, failure
// probability and a maintenance recommendation. The judgments here are reused by
// the self-explaining tooltips so the words always match the numbers.

import type { Snapshot } from "@/data/api";
import { gradient } from "./format";
import { identityOf } from "./identity";
import type { Subsystem } from "@/subsystems";

export type HealthStatus = "healthy" | "watch" | "critical" | "failed";
export type Trend = "improving" | "stable" | "degrading";

export interface Refs {
  failure_threshold: number;
  optimal_replace_low: number;
  optimal_replace_high: number;
}

export const DEFAULT_REFS: Refs = {
  failure_threshold: 0.2,
  optimal_replace_low: 0.35,
  optimal_replace_high: 0.42,
};

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: "#34d399",
  watch: "#fbbf24",
  critical: "#f4554e",
  failed: "#8a7374",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  watch: "Watch",
  critical: "Critical",
  failed: "Failed",
};

/** Continuous health → colour for mesh tint and gauges (green→amber→red). */
export function healthColor(h: number): string {
  return gradient(
    [
      [0.15, "#dc2626"],
      [0.25, "#f4554e"],
      [0.42, "#fbbf24"],
      [0.7, "#34d399"],
      [1.0, "#22c55e"],
    ],
    h,
  );
}

export function statusColor(s: HealthStatus): string {
  return STATUS_COLOR[s];
}
export function statusLabel(s: HealthStatus): string {
  return STATUS_LABEL[s];
}

/** Map a health value to a status band, mirroring the backend's machine-state logic. */
export function healthStatus(h: number, refs: Refs = DEFAULT_REFS): HealthStatus {
  if (h <= refs.failure_threshold) return "failed";
  if (h <= refs.optimal_replace_low) return "critical";
  if (h <= refs.optimal_replace_high) return "watch";
  return "healthy";
}

/** Failure probability heuristic from headroom above the failure threshold. */
export function failureProbability(h: number, refs: Refs = DEFAULT_REFS): number {
  const span = Math.max(1e-6, refs.optimal_replace_high - refs.failure_threshold);
  const headroom = (h - refs.failure_threshold) / span; // 1 at watch boundary, 0 at failure
  return Math.max(0, Math.min(1, 1 - headroom)) ** 1.4;
}

/** Trend from a short health history (newest last). */
export function trendFrom(history: number[]): Trend {
  if (history.length < 4) return "stable";
  const n = history.length;
  const recent = history.slice(Math.max(0, n - 12));
  const slope = recent[recent.length - 1] - recent[0];
  if (slope < -0.004) return "degrading";
  if (slope > 0.004) return "improving";
  return "stable";
}

export interface SubsystemHealth {
  subsystem: Subsystem;
  health: number;
  status: HealthStatus;
  color: string; // health-tint colour
  trend: Trend;
  failureProbability: number;
  /** RUL p50 in cycles (most-likely). */
  rulCycles: number | null;
  rulP10: number | null;
  rulP90: number | null;
  daysUntil: number | null;
  replacementDate: string | null;
  recommendation: string;
}

export function recommendation(status: HealthStatus, label: string, daysUntil: number | null): string {
  switch (status) {
    case "failed":
      return `${label} has crossed its failure threshold — stop and replace before resuming production.`;
    case "critical":
      return daysUntil != null && daysUntil > 0
        ? `Below the maintenance window — schedule replacement within ${Math.max(1, Math.round(daysUntil))} day(s).`
        : `Below the maintenance window — schedule replacement now to avoid unplanned downtime.`;
    case "watch":
      return `Entering the optimal replacement window — plan a maintenance slot soon to preserve resale value.`;
    default:
      return `Operating normally — continue routine monitoring; no action required.`;
  }
}

/** Derive one subsystem's full condition from the live snapshot + its history. */
export function deriveSubsystemHealth(
  snap: Snapshot | null,
  subsystem: Subsystem,
  history: number[] = [],
): SubsystemHealth {
  const id = identityOf(subsystem);
  const refs: Refs = snap?.rul
    ? {
        failure_threshold: snap.rul.failure_threshold,
        optimal_replace_low: snap.rul.optimal_replace_low,
        optimal_replace_high: snap.rul.optimal_replace_high,
      }
    : DEFAULT_REFS;

  const h = id.backendKey ? snap?.health?.[id.backendKey] ?? 1 : 1;
  const status = healthStatus(h, refs);
  const per = id.backendKey ? snap?.rul_per_component?.[id.backendKey] : undefined;

  return {
    subsystem,
    health: h,
    status,
    color: healthColor(h),
    trend: trendFrom(history),
    failureProbability: failureProbability(h, refs),
    rulCycles: per?.p50 ?? null,
    rulP10: per?.p10 ?? null,
    rulP90: per?.p90 ?? null,
    daysUntil: per?.days_until_replacement ?? null,
    replacementDate: per?.replacement_date ?? null,
    recommendation: recommendation(status, id.label, per?.days_until_replacement ?? null),
  };
}

/** Per-subsystem live health map (monitored subsystems only). */
export function subsystemHealthMap(
  snap: Snapshot | null,
  subsystems: Subsystem[],
): Partial<Record<Subsystem, number>> {
  const out: Partial<Record<Subsystem, number>> = {};
  for (const s of subsystems) {
    const key = identityOf(s).backendKey;
    if (key) out[s] = snap?.health?.[key] ?? 1;
  }
  return out;
}

/** Worst monitored subsystem (lowest health), for the overview rollup. */
export function worstSubsystem(snap: Snapshot | null, subsystems: Subsystem[]): Subsystem | null {
  if (!snap) return null;
  let worst: Subsystem | null = null;
  let lowest = Infinity;
  for (const s of subsystems) {
    const key = identityOf(s).backendKey;
    if (!key) continue;
    const h = snap.health?.[key] ?? 1;
    if (h < lowest) {
      lowest = h;
      worst = s;
    }
  }
  return worst;
}
