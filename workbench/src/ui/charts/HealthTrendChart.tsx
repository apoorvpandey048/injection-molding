// Health Trend — the selected subsystem's recent health history with the real
// failure / maintenance thresholds overlaid as warning + critical regions, plus
// a crosshair readout. Answers "is it getting better or worse, and how close to
// the line is it?"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Refs } from "@/lib/health";
import { pct } from "@/lib/format";

const C = { grid: "#1e2939", axis: "#5f6e87", text: "#9babc4", critical: "#f4554e", warn: "#fbbf24" };

export function HealthTrendChart({
  history,
  refs,
  color = "#38bdf8",
  height = 150,
}: {
  history: number[];
  refs: Refs;
  color?: string;
  height?: number;
}): React.JSX.Element {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-md text-xs text-zinc-500" style={{ height }}>
        Building trend…
      </div>
    );
  }
  const data = history.map((y, i) => ({ i: i - (history.length - 1), y }));
  const yMin = Math.max(0, Math.min(refs.failure_threshold - 0.05, Math.min(...history) - 0.05));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="ht-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          {/* critical region (below maintenance low) + warning region */}
          <ReferenceArea y1={yMin} y2={refs.optimal_replace_low} fill={C.critical} fillOpacity={0.07} />
          <ReferenceArea
            y1={refs.optimal_replace_low}
            y2={refs.optimal_replace_high}
            fill={C.warn}
            fillOpacity={0.08}
          />
          <ReferenceLine y={refs.failure_threshold} stroke={C.critical} strokeDasharray="4 3" strokeWidth={1.2}>
            <Label value="Failure" position="insideTopRight" fill={C.critical} fontSize={9} />
          </ReferenceLine>
          <XAxis dataKey="i" tick={{ fill: C.axis, fontSize: 9 }} axisLine={{ stroke: C.grid }} tickLine={false} />
          <YAxis
            domain={[yMin, 1]}
            tick={{ fill: C.axis, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={38}
            tickFormatter={(v: number) => pct(v)}
          />
          <Tooltip
            cursor={{ stroke: color, strokeDasharray: "3 3", strokeOpacity: 0.5 }}
            contentStyle={{ background: "#161c24", border: "1px solid #232c38", borderRadius: 8, fontSize: 12, color: C.text }}
            labelFormatter={(v) => `${v === 0 ? "now" : `${v} cycles`}`}
            formatter={(value: unknown) => [pct(value as number), "health"]}
          />
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill="url(#ht-grad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
