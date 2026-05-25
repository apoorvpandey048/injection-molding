import type { QualityData } from "@/api";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/InfoHint";

const LABELS = ["good", "acceptable", "waste"] as const;
type Label = (typeof LABELS)[number];

const CLASS_HINT: Record<Label, string> = {
  good: "Part is within spec — the safe state. You want this bar near 100%.",
  acceptable: "Usable but drifting from nominal. Worth watching if it keeps climbing.",
  waste: "Predicted scrap/defect. A rising Waste bar means the process is degrading — investigate before it's all scrap.",
};

const BAR_COLOR: Record<Label, string> = {
  good: "var(--color-success)",
  acceptable: "var(--color-warning)",
  waste: "var(--color-critical)",
};

const PILL: Record<QualityData["label"], string> = {
  good: "border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)]",
  acceptable: "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  waste: "border-[var(--color-critical)]/40 bg-[var(--color-critical)]/10 text-[var(--color-critical)]",
  unknown: "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]",
};

interface Props {
  quality: QualityData | null;
}

export function QualityCard({ quality }: Props): JSX.Element {
  const label = quality?.label ?? "unknown";

  if (!quality) {
    return (
      <div className="flex h-28 items-center justify-center text-xs text-[var(--color-text-muted)]">
        Waiting for shot quality…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Hint label="The most-likely quality class for the latest molded shot, from the calibrated classifier.">
          <span
            className={cn(
              "cursor-help rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-wider",
              PILL[label],
            )}
          >
            {label}
          </span>
        </Hint>
        <span className="text-xs text-[var(--color-text-muted)]">predicted shot class</span>
      </div>

      <div className="space-y-2.5">
        {LABELS.map((lbl) => {
          const pct = (quality.probability[lbl] ?? 0) * 100;
          const active = label === lbl;
          return (
            <Hint key={lbl} label={CLASS_HINT[lbl]} side="left">
              <div className="flex cursor-help items-center gap-3">
                <span
                  className={cn(
                    "w-20 text-xs capitalize",
                    active ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]",
                  )}
                >
                  {lbl}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${pct.toFixed(1)}%`, background: BAR_COLOR[lbl] }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </Hint>
          );
        })}
      </div>
    </div>
  );
}
