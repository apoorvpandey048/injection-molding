// A compact sensor-trend chart for one scalar channel, with an adaptive
// normal/warning/critical envelope derived from the signal's own rolling
// baseline (see channels.ts). The live trace drifting out of the green envelope
// is the enterprise "is this reading abnormal?" cue.

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { type ChannelMeta, bandFromBaseline, levelOf, median } from "@/lib/channels";
import { fmt } from "@/lib/format";

const C = { grid: "#1e2939", axis: "#5f6e87", text: "#9babc4", critical: "#f4554e", warn: "#fbbf24", line: "#7dd3fc" };

export function SensorMiniChart({
  values,
  meta,
  height = 56,
}: {
  values: number[];
  meta: ChannelMeta;
  height?: number;
}): React.JSX.Element {
  if (values.length < 2) {
    return <div className="flex items-center text-[10px] text-zinc-600" style={{ height }}>collecting…</div>;
  }
  const base = median(values.slice(0, Math.max(8, Math.floor(values.length / 2))));
  const band = bandFromBaseline(base);
  const data = values.map((y, i) => ({ i, y }));
  const cur = values[values.length - 1];
  const level = levelOf(cur, band);
  const lineColor = level === "critical" ? C.critical : level === "warning" ? C.warn : C.line;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <ReferenceArea y1={band.warnLo} y2={band.warnHi} fill="#34d399" fillOpacity={0.06} />
          <ReferenceLine y={band.warnHi} stroke={C.warn} strokeOpacity={0.4} strokeDasharray="2 2" />
          <ReferenceLine y={band.warnLo} stroke={C.warn} strokeOpacity={0.4} strokeDasharray="2 2" />
          <YAxis hide domain={[band.min, band.max]} />
          <Tooltip
            cursor={{ stroke: lineColor, strokeDasharray: "3 3", strokeOpacity: 0.5 }}
            contentStyle={{ background: "#161c24", border: "1px solid #232c38", borderRadius: 8, fontSize: 11, color: C.text }}
            labelFormatter={() => meta.label}
            formatter={(value: unknown) => {
              const v = value as number;
              const lv = levelOf(v, band);
              return [`${fmt(v)} ${meta.unit} (${lv})`, ""];
            }}
          />
          <Area type="monotone" dataKey="y" stroke={lineColor} strokeWidth={1.6} fill="none" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
