import { type ReactNode } from "react";
import { useStore } from "@/store/store";
import { useScalarHistory } from "@/data/useScalarHistory";
import { identityOf, MONITORED } from "@/lib/identity";
import {
  DEFAULT_REFS,
  deriveSubsystemHealth,
  statusColor,
  statusLabel,
  worstSubsystem,
  type Refs,
  type SubsystemHealth,
} from "@/lib/health";
import { SCALAR_CHANNELS, bandFromBaseline, channelMeta, levelOf, median } from "@/lib/channels";
import { Explain, InfoDot, type Tone } from "@/ui/Explain";
import { RulForecastChart } from "@/ui/charts/RulForecastChart";
import { HealthTrendChart } from "@/ui/charts/HealthTrendChart";
import { SensorMiniChart } from "@/ui/charts/SensorMiniChart";
import { QualityBar } from "@/ui/charts/QualityBar";
import { DemoControls } from "./DemoControls";
import { fmt, formatCycles, formatHorizon, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Subsystem } from "@/subsystems";

const STATUS_TONE = { healthy: "normal", watch: "warning", critical: "critical", failed: "failed" } as const;

function refsOf(snap: ReturnType<typeof useStore.getState>["snapshot"]): Refs {
  return snap?.rul
    ? {
        failure_threshold: snap.rul.failure_threshold,
        optimal_replace_low: snap.rul.optimal_replace_low,
        optimal_replace_high: snap.rul.optimal_replace_high,
      }
    : DEFAULT_REFS;
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="border-t border-panel-border px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
        {hint && <Explain title={title} what={hint}><InfoDot /></Explain>}
      </div>
      {children}
    </div>
  );
}

function HealthRing({ sh }: { sh: SubsystemHealth }): React.JSX.Element {
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1b2230" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={sh.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - sh.health)}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-semibold tabular-nums text-zinc-100">{pct(sh.health)}</span>
        <span className="text-[9px] uppercase tracking-wide" style={{ color: statusColor(sh.status) }}>
          {statusLabel(sh.status)}
        </span>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, hint, tone = "info" }: { label: string; value: ReactNode; sub?: ReactNode; hint: ReactNode; tone?: Tone }): React.JSX.Element {
  return (
    <Explain title={label} what={hint} tone={tone}>
      <div className="rounded-lg border border-panel-border bg-panel-inset px-2.5 py-2">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
        <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">{value}</div>
        {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
      </div>
    </Explain>
  );
}

function SensorRow({ channel, values }: { channel: string; values: number[] }): React.JSX.Element {
  const meta = channelMeta(channel);
  const cur = values.length ? values[values.length - 1] : null;
  const base = values.length > 4 ? median(values.slice(0, Math.max(8, values.length >> 1))) : cur ?? 0;
  const band = bandFromBaseline(base);
  const level = cur != null ? levelOf(cur, band) : "normal";
  const tone: Tone = level === "critical" ? "critical" : level === "warning" ? "warning" : "normal";
  const dir = meta.betterWhen === "high" ? "higher is healthier" : meta.betterWhen === "low" ? "lower is healthier" : "should stay stable";

  return (
    <div className="rounded-lg border border-panel-border bg-panel-inset/60 p-2">
      <div className="flex items-center justify-between">
        <Explain
          title={meta.label}
          what={meta.what}
          reading={cur != null ? `${fmt(cur)} ${meta.unit} — ${level} (${dir}).` : "collecting…"}
          action={level === "normal" ? "Within the normal envelope — no action." : "Reading is drifting from baseline — correlate with subsystem health."}
          tone={tone}
        >
          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-300">
            {meta.label}
          </span>
        </Explain>
        <span className={cn("font-mono text-xs tabular-nums", tone === "critical" ? "text-red-300" : tone === "warning" ? "text-amber-300" : "text-zinc-300")}>
          {cur != null ? `${fmt(cur)} ${meta.unit}` : "—"}
        </span>
      </div>
      <SensorMiniChart values={values} meta={meta} />
    </div>
  );
}

function SubsystemDetail({ subsystem }: { subsystem: Subsystem }): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const history = useStore((s) => s.history);
  const scalars = useScalarHistory(SCALAR_CHANNELS);
  const id = identityOf(subsystem);
  const refs = refsOf(snapshot);
  const cpd = snapshot?.config?.cycles_per_day ?? 4000;
  const sh = deriveSubsystemHealth(snapshot, subsystem, id.backendKey ? history[id.backendKey] : []);
  const tone = STATUS_TONE[sh.status] as Tone;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="h-3 w-3 rounded-sm" style={{ background: id.color }} />
        <div>
          <div className="text-sm font-semibold text-zinc-100">{id.label}</div>
          <div className="text-[10px] text-zinc-500">{id.what}</div>
        </div>
      </div>

      {/* gauge + KPIs */}
      <div className="flex items-center gap-3 px-4">
        <Explain title="Health score" what="The component's true condition, 100% = new." reading={`${pct(sh.health)} — ${statusLabel(sh.status)}.`} action={sh.recommendation} tone={tone}>
          <HealthRing sh={sh} />
        </Explain>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <Kpi
            label="RUL (p50)"
            value={sh.rulCycles != null ? `${formatCycles(sh.rulCycles)} cyc` : "—"}
            sub={sh.rulCycles != null ? `~${formatHorizon(sh.daysUntil)}` : undefined}
            hint="Remaining Useful Life — the most-likely number of cycles until this component crosses its failure threshold."
            tone={tone}
          />
          <Kpi
            label="Failure prob."
            value={pct(sh.failureProbability)}
            hint="Estimated probability of failure within the near maintenance horizon, from the headroom above the failure threshold."
            tone={sh.failureProbability > 0.5 ? "critical" : sh.failureProbability > 0.2 ? "warning" : "normal"}
          />
          <Kpi label="Status" value={statusLabel(sh.status)} hint="Condition band: Healthy → Watch → Critical → Failed, by health thresholds." tone={tone} />
          <Kpi label="Trend" value={sh.trend} hint="Direction of health over recent cycles (improving / stable / degrading)." tone={sh.trend === "degrading" ? "warning" : "normal"} />
        </div>
      </div>

      {/* recommendation */}
      <div className="px-4 pt-3">
        <div className={cn("rounded-lg border px-3 py-2 text-xs",
          tone === "critical" || tone === "failed" ? "border-red-500/30 bg-red-500/10 text-red-200"
          : tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200")}
        >
          <span className="font-semibold uppercase tracking-wide">Recommendation · </span>
          {sh.recommendation}
        </div>
      </div>

      <Section title="RUL Forecast" hint="Projected health decline to the failure threshold, with the p10–p90 uncertainty band and the predicted-failure marker. Hover for the value, calendar horizon and risk band at any point.">
        <RulForecastChart sh={sh} refs={refs} cyclesPerDay={cpd} />
      </Section>

      <Section title="Health Trend" hint="Recent health history with the maintenance (amber) and failure (red) regions overlaid. Falling toward the red line means act soon.">
        <HealthTrendChart history={id.backendKey ? history[id.backendKey] ?? [] : []} refs={refs} color={id.color} />
      </Section>

      <Section title="Sensor Summary" hint={`Live signals that report on the ${id.label}. ${id.failureSignature}`}>
        <div className="flex flex-col gap-1.5">
          {id.scalarChannels.length ? (
            id.scalarChannels.map((ch) => <SensorRow key={ch} channel={ch} values={scalars[ch] ?? []} />)
          ) : (
            <div className="text-xs text-zinc-600">No scalar sensors mapped.</div>
          )}
        </div>
      </Section>
    </div>
  );
}

function OverviewCard({ subsystem }: { subsystem: Subsystem }): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const selectSubsystem = useStore((s) => s.selectSubsystem);
  const setHoveredSubsystem = useStore((s) => s.setHoveredSubsystem);
  const id = identityOf(subsystem);
  const sh = deriveSubsystemHealth(snapshot, subsystem);
  return (
    <button
      onClick={() => selectSubsystem(subsystem)}
      onMouseEnter={() => setHoveredSubsystem(subsystem)}
      onMouseLeave={() => setHoveredSubsystem(null)}
      className="rounded-lg border border-panel-border bg-panel-inset px-2.5 py-2 text-left transition-colors hover:border-sky-500/40"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: id.color }} />
        <span className="truncate text-[11px] font-medium text-zinc-300">{id.label}</span>
      </div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums" style={{ color: sh.color }}>{pct(sh.health)}</div>
      <div className="text-[10px] text-zinc-500">{statusLabel(sh.status)} · {formatHorizon(sh.daysUntil)}</div>
    </button>
  );
}

function MachineOverview(): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const refs = refsOf(snapshot);
  const cpd = snapshot?.config?.cycles_per_day ?? 4000;
  const worst = worstSubsystem(snapshot, MONITORED);
  const worstSh = worst ? deriveSubsystemHealth(snapshot, worst, useStore.getState().history[identityOf(worst).backendKey ?? ""] ?? []) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-3">
        <div className="text-sm font-semibold text-zinc-100">Machine Overview</div>
        <div className="text-[11px] text-zinc-500">Select a subsystem (rail or 3D model) to drill in.</div>
      </div>

      <Section title="Subsystem Health">
        <div className="grid grid-cols-2 gap-1.5">
          {MONITORED.map((s) => <OverviewCard key={s} subsystem={s} />)}
        </div>
      </Section>

      <Section title="Predicted Quality" hint="The predicted quality class of the most recent molded part. You want the Good (green) share near 100%.">
        <QualityBar quality={snapshot?.quality ?? null} />
      </Section>

      {worstSh && (
        <Section title="Worst-Component Forecast" hint="RUL forecast for the component with the least remaining life — the one to act on first.">
          <div className="mb-1.5 text-[11px] text-zinc-400">
            {identityOf(worstSh.subsystem).label} · replace in <span className="font-medium text-zinc-200">{formatHorizon(worstSh.daysUntil)}</span>
          </div>
          <RulForecastChart sh={worstSh} refs={refs} cyclesPerDay={cpd} />
        </Section>
      )}
    </div>
  );
}

export function ContextPanel(): React.JSX.Element {
  const selected = useStore((s) => s.selectedSubsystem);
  return (
    <div className="flex h-full flex-col">
      {selected ? <SubsystemDetail subsystem={selected} /> : <MachineOverview />}
      <DemoControls />
    </div>
  );
}
