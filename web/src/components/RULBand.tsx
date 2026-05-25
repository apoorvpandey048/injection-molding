import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const HISTORY = 60;

// Chart ink — literal hexes mirroring styles/tokens.css (SVG attrs don't resolve CSS vars reliably).
const C = {
  accent: "#38bdf8",
  band: "#38bdf8",
  grid: "#1e2939",
  axis: "#5f6e87",
  text: "#9babc4",
  critical: "#f4554e",
};

export interface RULBandPoint {
  p10: number;
  p50: number;
  p90: number;
}

export interface RULBandRefs {
  failure_threshold?: number;
  optimal_replace_low?: number;
  optimal_replace_high?: number;
}

interface Props {
  /** Current cycle reading; pushed into the rolling buffer. */
  current?: RULBandPoint | null;
  /** Static reference info (presence enables the failure line). */
  refs?: RULBandRefs;
  /** Optional pre-built history (e.g. component-scoped single-point band). */
  history?: RULBandPoint[];
  height?: number;
  /** Show axis titles with units. */
  showAxisLabels?: boolean;
}

interface ChartRow {
  i: number;
  p50: number;
  band: [number, number];
}

export function RULBand({
  current,
  refs,
  history,
  height = 160,
  showAxisLabels = false,
}: Props): JSX.Element {
  const buf = useRef<RULBandPoint[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!current) return;
    buf.current.push(current);
    if (buf.current.length > HISTORY) buf.current.shift();
    setTick((t) => (t + 1) & 0xffff);
  }, [current]);

  const source: RULBandPoint[] = history && history.length > 0 ? history : buf.current;

  // A single point can't draw an area — mirror it so the band reads as a flat span.
  const points = source.length === 1 ? [source[0], source[0]] : source;

  const data: ChartRow[] = points.map((p, i) => ({
    i,
    p50: p.p50,
    band: [p.p10, p.p90],
  }));

  const maxVal = Math.max(...points.map((p) => p.p90), 1) * 1.1;
  const showFailureLine = refs?.failure_threshold !== undefined;

  if (data.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-md text-xs text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Waiting for forecast…
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 10, left: showAxisLabels ? 8 : 4, bottom: showAxisLabels ? 18 : 4 }}
        >
          <defs>
            <linearGradient id="rul-band-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.band} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.band} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="i"
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={{ stroke: C.grid }}
            tickLine={false}
            tickFormatter={(v: number) => String(v)}
          >
            {showAxisLabels && (
              <Label
                value="recent samples"
                position="insideBottom"
                offset={-12}
                fill={C.axis}
                fontSize={10}
              />
            )}
          </XAxis>
          <YAxis
            domain={[0, maxVal]}
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={showAxisLabels ? 52 : 42}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)))}
          >
            {showAxisLabels && (
              <Label
                value="RUL (cycles)"
                angle={-90}
                position="insideLeft"
                offset={8}
                style={{ textAnchor: "middle" }}
                fill={C.axis}
                fontSize={10}
              />
            )}
          </YAxis>
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              color: C.text,
            }}
            labelStyle={{ color: C.text, marginBottom: 2 }}
            labelFormatter={(v) => `Sample ${v}`}
            formatter={(value: unknown) => {
              if (Array.isArray(value)) {
                const [lo, hi] = value as [number, number];
                return [`${Math.round(lo).toLocaleString()} – ${Math.round(hi).toLocaleString()} cyc`, "p10–p90"];
              }
              return [`${Math.round(value as number).toLocaleString()} cyc`, "p50 (median)"];
            }}
          />
          {showFailureLine && (
            <ReferenceLine y={0} stroke={C.critical} strokeWidth={1.5} strokeDasharray="4 3">
              <Label
                value="Failure · RUL 0"
                position="insideBottomLeft"
                fill={C.critical}
                fontSize={10}
              />
            </ReferenceLine>
          )}
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="url(#rul-band-grad)"
            isAnimationActive={false}
            name="p10–p90"
          />
          <Area
            type="monotone"
            dataKey="p50"
            stroke={C.accent}
            strokeWidth={2.5}
            fill="none"
            dot={false}
            activeDot={{ r: 3, fill: C.accent }}
            isAnimationActive={false}
            name="p50"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
