import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { InfoHint } from "@/components/InfoHint";

const CURVES: Array<{ key: string; label: string; unit: string; color: string; hint: string }> = [
  {
    key: "cavity_pressure",
    label: "Cavity pressure",
    unit: "bar",
    color: "#38bdf8",
    hint: "Pressure inside the mold cavity. Stable, repeatable peaks = consistent filling; erratic or low peaks can indicate check-ring wear or short shots.",
  },
  {
    key: "hydraulic_injection_pressure",
    label: "Injection pressure",
    unit: "bar",
    color: "#2dd4bf",
    hint: "Hydraulic pressure driving the injection stroke. A sustained sag points to hydraulic-pump wear.",
  },
  {
    key: "screw_position",
    label: "Screw position",
    unit: "mm",
    color: "#a78bfa",
    hint: "Screw travel during the shot. A falling end position (cushion) suggests material leaking back past the check ring.",
  },
  {
    key: "screw_velocity",
    label: "Screw velocity",
    unit: "mm/s",
    color: "#fbbf24",
    hint: "Screw speed during injection. Sustained drops can indicate drive/servo wear.",
  },
  {
    key: "nozzle_temperature",
    label: "Nozzle temp",
    unit: "°C",
    color: "#fb7185",
    hint: "Melt temperature at the nozzle. Wandering or drifting values signal heater-band problems.",
  },
];

const POINTS = 100;
const GRID = "#1e2939";
const AXIS = "#5f6e87";

interface Props {
  curves: Record<string, number[]> | null;
}

type Series = Record<string, number[]>;

export function ProcessCharts({ curves }: Props): JSX.Element {
  const histRef = useRef<Series>(
    Object.fromEntries(CURVES.map((c) => [c.key, [] as number[]])) as Series,
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!curves) return;
    const hist = histRef.current;
    for (const c of CURVES) {
      const raw = curves[c.key] ?? [];
      if (raw.length === 0) continue;
      const v = raw[raw.length - 1];
      const arr = hist[c.key];
      arr.push(v);
      if (arr.length > POINTS) arr.shift();
    }
    setTick((t) => (t + 1) & 0xffff);
  }, [curves]);

  if (!curves) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[var(--color-text-muted)]">
        Waiting for process curves…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {CURVES.map((c) => {
        const ys = histRef.current[c.key];
        const data = ys.map((y, i) => ({ i, y }));
        return (
          <div key={c.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                {c.label}
                <InfoHint title={c.label} side="right">
                  {c.hint}
                </InfoHint>
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{c.unit}</span>
            </div>
            <div className="h-[64px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
                  <YAxis
                    width={38}
                    tick={{ fill: AXIS, fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickCount={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="y"
                    stroke={c.color}
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
