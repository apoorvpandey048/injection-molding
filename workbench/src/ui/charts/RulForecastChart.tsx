// RUL Forecast Band — the hero enterprise chart. Projects the selected
// subsystem's health forward to its failure threshold, showing the p10–p90
// uncertainty band around the p50 (most-likely) decline, the maintenance window,
// the failure line, and a predicted-failure marker. Crosshair tooltip reads out
// the value, the calendar horizon and the risk band at the cursor.

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Label,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Refs, SubsystemHealth } from "@/lib/health";
import { formatHorizon, pct } from "@/lib/format";

const C = {
  accent: "#38bdf8",
  grid: "#1e2939",
  axis: "#5f6e87",
  text: "#9babc4",
  critical: "#f4554e",
  warn: "#fbbf24",
};

interface Row {
  x: number; // cycles from now
  p50: number;
  band: [number, number];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function RulForecastChart({
  sh,
  refs,
  cyclesPerDay,
  height = 190,
}: {
  sh: SubsystemHealth;
  refs: Refs;
  cyclesPerDay: number;
  height?: number;
}): React.JSX.Element {
  const h0 = sh.health;
  const thr = refs.failure_threshold;
  const p50c = sh.rulCycles;
  const p10c = sh.rulP10;
  const p90c = sh.rulP90;

  if (p50c == null || p10c == null || p90c == null) {
    return (
      <div
        className="flex items-center justify-center rounded-md text-xs text-zinc-500"
        style={{ height }}
      >
        Waiting for forecast…
      </div>
    );
  }

  const declineTo = (x: number, horizon: number): number =>
    clamp01(h0 + (thr - h0) * (x / Math.max(1, horizon)));

  const xMax = Math.max(p90c, p50c, 1) * 1.08;
  const N = 48;
  const data: Row[] = Array.from({ length: N + 1 }, (_, i) => {
    const x = (xMax * i) / N;
    return {
      x,
      p50: declineTo(x, p50c),
      band: [declineTo(x, p10c), declineTo(x, p90c)],
    };
  });

  const fmtCyc = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
          <defs>
            <linearGradient id="rul-fc-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.26} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, xMax]}
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={{ stroke: C.grid }}
            tickLine={false}
            tickFormatter={fmtCyc}
          >
            <Label value="cycles from now" position="insideBottom" offset={-10} fill={C.axis} fontSize={10} />
          </XAxis>
          <YAxis
            domain={[0, 1]}
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => pct(v)}
          />

          {/* maintenance window + failure threshold */}
          <ReferenceArea
            y1={refs.optimal_replace_low}
            y2={refs.optimal_replace_high}
            fill={C.warn}
            fillOpacity={0.1}
            ifOverflow="extendDomain"
          />
          <ReferenceLine y={thr} stroke={C.critical} strokeWidth={1.4} strokeDasharray="4 3">
            <Label value="Failure threshold" position="insideBottomLeft" fill={C.critical} fontSize={10} />
          </ReferenceLine>
          {/* predicted-failure marker (p50 crosses threshold at p50c) */}
          <ReferenceLine x={p50c} stroke={C.critical} strokeWidth={1.2} strokeDasharray="2 3">
            <Label value="Predicted failure" position="top" fill={C.critical} fontSize={10} />
          </ReferenceLine>

          <Tooltip
            cursor={{ stroke: C.accent, strokeDasharray: "3 3", strokeOpacity: 0.6 }}
            contentStyle={{
              background: "#161c24",
              border: "1px solid #232c38",
              borderRadius: 8,
              fontSize: 12,
              color: C.text,
            }}
            labelFormatter={(v) => {
              const cyc = Number(v);
              const days = cyclesPerDay > 0 ? cyc / cyclesPerDay : 0;
              return `+${fmtCyc(cyc)} cycles · ~${formatHorizon(days)}`;
            }}
            formatter={(value: unknown) => {
              if (Array.isArray(value)) {
                const [lo, hi] = value as [number, number];
                return [`${pct(lo)} – ${pct(hi)}`, "p10–p90 band"];
              }
              const v = value as number;
              const band = v <= thr ? "failed" : v <= refs.optimal_replace_low ? "critical" : v <= refs.optimal_replace_high ? "watch" : "healthy";
              return [`${pct(v)} (${band})`, "p50 health"];
            }}
          />

          <Area type="monotone" dataKey="band" stroke="none" fill="url(#rul-fc-band)" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="p50"
            stroke={C.accent}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 3, fill: C.accent }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
