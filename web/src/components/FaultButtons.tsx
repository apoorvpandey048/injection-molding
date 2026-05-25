import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/InfoHint";

const FAULTS: Array<{ id: string; label: string; hint: string }> = [
  {
    id: "check_ring_wear",
    label: "Check Ring Wear",
    hint: "Simulates a worn screw check-ring: cushion drops and cavity pressure gets noisy. Degrades the Screw / Check-ring gauge. Click to inject, click again to clear.",
  },
  {
    id: "heater_drift",
    label: "Heater Drift",
    hint: "Simulates heater-band drift: barrel/nozzle temperatures wander and injection time stretches. Degrades the Heaters gauge.",
  },
  {
    id: "hydraulic_pump_wear",
    label: "Hydraulic Pump Wear",
    hint: "Simulates a failing hydraulic pump: injection pressure sags and oil heats up. Degrades the Hydraulic gauge (the fastest to fail).",
  },
];

interface Props {
  activeFaults: string[];
  onInject: (fault: string) => Promise<void> | void;
}

export function FaultButtons({ activeFaults, onInject }: Props): JSX.Element {
  const [local, setLocal] = useState<Set<string>>(() => new Set(activeFaults));

  useEffect(() => {
    setLocal(new Set(activeFaults));
  }, [activeFaults]);

  const toggle = async (id: string): Promise<void> => {
    if (local.has(id)) {
      await onInject("clear_" + id);
    } else {
      await onInject(id);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {FAULTS.map((f) => {
        const isActive = local.has(f.id);
        return (
          <Hint key={f.id} side="right" label={f.hint}>
            <button
              onClick={() => void toggle(f.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs font-medium transition-colors",
                isActive
                  ? "border-[var(--color-critical)]/50 bg-[var(--color-critical)]/10 text-[var(--color-critical)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "animate-pulse bg-[var(--color-critical)]" : "bg-[var(--color-text-muted)]",
                )}
              />
              {f.label}
              {isActive && <span className="ml-auto text-[10px] uppercase tracking-wide">active</span>}
            </button>
          </Hint>
        );
      })}
    </div>
  );
}
