import { ComponentGauge } from "@/components/ComponentGauge";
import type { RulData, RulPerComponentEntry } from "@/api";

const COMPONENT_ORDER = [
  "hydraulic",
  "screw_check_ring",
  "heaters",
  "drive",
  "mold",
] as const;

const LABELS: Record<(typeof COMPONENT_ORDER)[number], string> = {
  hydraulic: "Hydraulic",
  screw_check_ring: "Screw / Check Ring",
  heaters: "Heaters",
  drive: "Drive",
  mold: "Mold",
};

interface Props {
  health: Record<string, number> | undefined;
  rulPerComponent: Record<string, RulPerComponentEntry> | undefined;
  globalRul?: RulData;
}

export function ComponentGrid({ health, rulPerComponent, globalRul }: Props): JSX.Element {
  const refs = globalRul
    ? {
        failure_threshold: globalRul.failure_threshold,
        optimal_replace_low: globalRul.optimal_replace_low,
        optimal_replace_high: globalRul.optimal_replace_high,
      }
    : undefined;

  // Loading state — no telemetry yet.
  if (!health) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {COMPONENT_ORDER.map((key) => (
          <div
            key={key}
            className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
          >
            <div className="h-[112px] w-[112px] animate-pulse rounded-full border-8 border-[var(--color-border)]/50" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-[var(--color-border)]/60" />
            <div className="mt-1 h-2 w-10 animate-pulse rounded bg-[var(--color-border)]/40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {COMPONENT_ORDER.map((key) => (
        <ComponentGauge
          key={key}
          componentKey={key}
          label={LABELS[key]}
          health={health[key] ?? 1}
          entry={rulPerComponent?.[key]}
          globalRulRefs={refs}
        />
      ))}
    </div>
  );
}
