import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useStore } from "@/store/store";
import { MONITORED, identityOf } from "@/lib/identity";
import {
  deriveSubsystemHealth,
  statusColor,
  statusLabel,
  worstSubsystem,
  type Trend,
} from "@/lib/health";
import { Explain, type Tone } from "@/ui/Explain";
import { pct, formatHorizon } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Subsystem } from "@/subsystems";

const TREND_ICON: Record<Trend, typeof Minus> = {
  improving: TrendingUp,
  stable: Minus,
  degrading: TrendingDown,
};
const STATUS_TONE = { healthy: "normal", watch: "warning", critical: "critical", failed: "failed" } as const;

function RailItem({ subsystem }: { subsystem: Subsystem }): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const history = useStore((s) => s.history);
  const selected = useStore((s) => s.selectedSubsystem);
  const hovered = useStore((s) => s.hoveredSubsystem);
  const selectSubsystem = useStore((s) => s.selectSubsystem);
  const setHoveredSubsystem = useStore((s) => s.setHoveredSubsystem);

  const id = identityOf(subsystem);
  const sh = deriveSubsystemHealth(snapshot, subsystem, id.backendKey ? history[id.backendKey] : []);
  const isActive = selected === subsystem;
  const isHover = hovered === subsystem;
  const Trend = TREND_ICON[sh.trend];

  return (
    <Explain
      side="right"
      tone={STATUS_TONE[sh.status] as Tone}
      title={`${id.label} — ${statusLabel(sh.status)}`}
      what={id.what}
      reading={`Health ${pct(sh.health)} · ${sh.trend}. ${sh.rulCycles != null ? `~${formatHorizon(sh.daysUntil)} of life remaining.` : ""}`}
      action={sh.recommendation}
    >
      <button
        onClick={() => selectSubsystem(isActive ? null : subsystem)}
        onMouseEnter={() => setHoveredSubsystem(subsystem)}
        onMouseLeave={() => setHoveredSubsystem(null)}
        className={cn(
          "group w-full rounded-lg border px-3 py-2.5 text-left transition-all",
          isActive
            ? "border-sky-500/50 bg-sky-500/10"
            : isHover
              ? "border-panel-border bg-panel-raised"
              : "border-transparent hover:bg-panel-raised/60",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: id.color }} />
          <span className="truncate text-[13px] font-medium text-zinc-200">{id.label}</span>
          <Trend
            className={cn(
              "ml-auto h-3.5 w-3.5",
              sh.trend === "degrading" ? "text-red-400" : sh.trend === "improving" ? "text-emerald-400" : "text-zinc-600",
            )}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-inset">
            <div className="h-full rounded-full transition-all" style={{ width: pct(sh.health), background: sh.color }} />
          </div>
          <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums" style={{ color: sh.color }}>
            {pct(sh.health)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className="font-medium uppercase tracking-wide" style={{ color: statusColor(sh.status) }}>
            {statusLabel(sh.status)}
          </span>
          <span className="text-zinc-500">{sh.rulCycles != null ? formatHorizon(sh.daysUntil) : "—"}</span>
        </div>
      </button>
    </Explain>
  );
}

export function SubsystemRail(): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const selectSubsystem = useStore((s) => s.selectSubsystem);
  const selected = useStore((s) => s.selectedSubsystem);

  const worst = worstSubsystem(snapshot, MONITORED);
  const worstSh = worst ? deriveSubsystemHealth(snapshot, worst) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Subsystems</h2>
        {selected && (
          <button onClick={() => selectSubsystem(null)} className="text-[10px] text-sky-400 hover:text-sky-300">
            clear
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {MONITORED.map((s) => (
          <RailItem key={s} subsystem={s} />
        ))}
      </div>

      {/* Overall rollup */}
      <div className="border-t border-panel-border px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Machine health</div>
        {worstSh ? (
          <Explain
            side="top"
            tone={STATUS_TONE[worstSh.status] as Tone}
            title="Worst component"
            what="The subsystem with the least remaining life — act on this one first."
            reading={`${identityOf(worstSh.subsystem).label} at ${pct(worstSh.health)} (${statusLabel(worstSh.status)}).`}
            action={worstSh.recommendation}
          >
            <div className="mt-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: worstSh.color }}>
                  {pct(worstSh.health)}
                </span>
                <span className="text-xs text-zinc-400">worst: {identityOf(worstSh.subsystem).label}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                replace in <span className="font-medium text-zinc-300">{formatHorizon(worstSh.daysUntil)}</span>
              </div>
            </div>
          </Explain>
        ) : (
          <div className="mt-1.5 text-xs text-zinc-600">awaiting data…</div>
        )}
      </div>
    </div>
  );
}
