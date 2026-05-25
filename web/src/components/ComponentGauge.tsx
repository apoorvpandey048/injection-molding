import { useState } from "react";
import { Wrench, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { RULBand } from "@/components/RULBand";
import type { RulData, RulPerComponentEntry, Urgency } from "@/api";
import { cn } from "@/lib/utils";
import { formatReplacement } from "@/lib/replacement";
import { Hint } from "@/components/InfoHint";
import type { ReactNode } from "react";

interface Props {
  componentKey: string;
  label: string;
  health: number;
  entry?: RulPerComponentEntry;
  globalRulRefs?: Pick<RulData, "failure_threshold" | "optimal_replace_low" | "optimal_replace_high">;
}

const URGENCY_RING: Record<Urgency, string> = {
  critical: "var(--color-urgency-critical)",
  imminent: "var(--color-urgency-imminent)",
  schedule: "var(--color-urgency-schedule)",
  monitor: "var(--color-urgency-monitor)",
};

const URGENCY_TEXT: Record<Urgency, string> = {
  critical: "text-[var(--color-urgency-critical)]",
  imminent: "text-[var(--color-urgency-imminent)]",
  schedule: "text-[var(--color-urgency-schedule)]",
  monitor: "text-[var(--color-urgency-monitor)]",
};

const URGENCY_BORDER: Record<Urgency, string> = {
  critical: "border-[var(--color-urgency-critical)]/35",
  imminent: "border-[var(--color-urgency-imminent)]/30",
  schedule: "border-[var(--color-urgency-schedule)]/25",
  monitor: "border-[var(--color-urgency-monitor)]/25",
};

const URGENCY_LABEL: Record<Urgency, string> = {
  critical: "Critical",
  imminent: "Imminent",
  schedule: "Schedule",
  monitor: "Monitor",
};

const URGENCY_ADVICE: Record<Urgency, string> = {
  monitor: "Plenty of life left — keep running; re-check next month.",
  schedule: "Plan a replacement in the coming weeks to months.",
  imminent: "Schedule a replacement soon — within weeks.",
  critical: "Replace now — failure is imminent (under a week).",
};

const FAILED_COLOR = "var(--color-failed)";

// Custom 270° SVG arc gauge — smooth CSS transitions, full control of stroke.
const R = 40;
const CIRC = 2 * Math.PI * R;
const SWEEP = 0.75; // 270°
const ARC = CIRC * SWEEP;
const GAP = CIRC - ARC;

export function ComponentGauge({
  label,
  health,
  entry,
  globalRulRefs,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const urgency: Urgency = entry?.urgency ?? "monitor";
  const failureThreshold = globalRulRefs?.failure_threshold;
  const isFailed = failureThreshold !== undefined && health <= failureThreshold;
  const ringColor = isFailed ? FAILED_COLOR : URGENCY_RING[urgency];
  const pct = Math.max(0, Math.min(1, health)) * 100;
  const days = entry?.days_until_replacement;
  const repl = formatReplacement(days, entry?.replacement_date, isFailed);

  const history = entry
    ? [{ p10: entry.p10, p50: entry.p50, p90: entry.p90 }]
    : [];

  const gaugeHint: ReactNode = isFailed ? (
    <>
      This component has <b>stopped</b> — it crossed its failure line. Reset the machine to
      continue.
    </>
  ) : (
    <>
      <b>
        {pct.toFixed(0)}% health · {URGENCY_LABEL[urgency]}.
      </b>{" "}
      The ring shows health, colored by urgency. {URGENCY_ADVICE[urgency]} Click for the full
      forecast.
    </>
  );

  return (
    <>
      <Hint side="right" label={gaugeHint}>
      <button
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${pct.toFixed(0)}% health, ${isFailed ? "stopped" : URGENCY_LABEL[urgency]}`}
        className={cn(
          "group relative flex w-full flex-col items-center rounded-xl border bg-[var(--color-surface)] p-3.5 transition-all duration-200 hover:bg-[var(--color-surface-elevated)] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          isFailed
            ? "border-[var(--color-failed)]/60 bg-[var(--color-surface)]/60 grayscale-[0.4]"
            : URGENCY_BORDER[urgency],
        )}
      >
        <div className="relative h-[112px] w-full">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-0">
            <g transform="rotate(135 50 50)">
              <circle
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${ARC} ${GAP}`}
              />
              <circle
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${(ARC * pct) / 100} ${CIRC}`}
                style={{ transition: "stroke-dasharray 0.6s ease-out, stroke 0.4s ease" }}
              />
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {isFailed ? (
              <>
                <Lock className="h-6 w-6 text-[var(--color-failed)]" />
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-failed)]">
                  Stopped
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-2xl font-bold leading-none text-[var(--color-text-primary)]">
                  {pct.toFixed(0)}
                  <span className="text-sm text-[var(--color-text-muted)]">%</span>
                </span>
                <span className={cn("mt-1 text-xs font-semibold tabular-nums", URGENCY_TEXT[urgency])}>
                  {repl.gauge}
                </span>
                <span className={cn("text-[9px] font-medium uppercase tracking-wider", URGENCY_TEXT[urgency])}>
                  {URGENCY_LABEL[urgency]}
                </span>
              </>
            )}
          </div>
        </div>
        <div
          className={cn(
            "mt-1.5 w-full text-center text-xs font-semibold leading-tight text-[var(--color-text-primary)]",
            isFailed && "text-[var(--color-failed)] line-through decoration-[var(--color-failed)]",
          )}
        >
          {label}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {isFailed ? "Failed" : "Health"}
        </div>
      </button>
      </Hint>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              <span className="text-base">{label}</span>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                  isFailed
                    ? "border-[var(--color-failed)]/50 text-[var(--color-failed)]"
                    : cn("border-current/30", URGENCY_TEXT[urgency]),
                )}
              >
                {isFailed && <Lock className="h-3 w-3" />}
                {isFailed ? "Stopped" : URGENCY_LABEL[urgency]}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="p10 · pessimistic"
                value={entry?.p10}
                hint="Pessimistic estimate: only a 10% chance the true remaining life is below this many cycles."
              />
              <Stat
                label="p50 · median"
                value={entry?.p50}
                accent
                hint="Most-likely estimate (median) — the headline remaining-life number, in cycles."
              />
              <Stat
                label="p90 · optimistic"
                value={entry?.p90}
                hint="Optimistic estimate: a 90% chance the true life is below this — an upper bound, in cycles."
              />
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Remaining useful life
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">cycles</span>
              </div>
              <RULBand history={history} refs={globalRulRefs} height={150} showAxisLabels />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3">
                <div className="text-[var(--color-text-muted)]">Replacement date</div>
                <div className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                  {repl.date ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3">
                <div className="text-[var(--color-text-muted)]">Time remaining</div>
                <div
                  className={cn(
                    "mt-1 text-sm font-semibold tabular-nums",
                    isFailed || repl.kind === "overdue" ? "text-[var(--color-failed)]" : URGENCY_TEXT[urgency],
                  )}
                >
                  {repl.long}
                </div>
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <p>
                {isFailed ? (
                  <>
                    This component has crossed its failure threshold and the machine is
                    stopped. Health is pinned at <span className="font-semibold text-[var(--color-text-primary)]">{pct.toFixed(0)}%</span>;
                    reset the machine to resume monitoring.
                  </>
                ) : (
                  <>
                    The band shows the predicted remaining life in cycles — the{" "}
                    <span className="font-semibold text-[var(--color-text-primary)]">p50</span> line is
                    the most likely estimate, and the shaded p10–p90 range is the
                    pessimistic-to-optimistic spread. Plan the replacement before the band
                    reaches the red failure threshold.
                  </>
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="default" onClick={() => setOpen(false)} className="gap-2">
              <Wrench className="h-4 w-4" />
              Schedule maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({
  label,
  value,
  accent = false,
  hint,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
  hint?: ReactNode;
}): JSX.Element {
  const body = (
    <div
      className={cn(
        "rounded-lg border bg-[var(--color-bg)]/40 p-2.5 text-center",
        hint && "cursor-help",
        accent ? "border-[var(--color-accent)]/40" : "border-[var(--color-border)]",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-base font-bold tabular-nums",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]",
        )}
      >
        {value !== undefined ? Math.round(value).toLocaleString() : "—"}
      </div>
    </div>
  );
  return hint ? <Hint label={hint}>{body}</Hint> : body;
}
