import { useEffect, useMemo, useState } from "react";

const REGIONS: Array<{ id: string; label: string; x: number; y: number; w: number; h: number }> = [
  { id: "hydraulic", label: "Hydraulic", x: 10, y: 60, w: 60, h: 80 },
  { id: "drive", label: "Drive", x: 10, y: 155, w: 60, h: 50 },
  { id: "screw_check_ring", label: "Screw/Ring", x: 80, y: 80, w: 100, h: 40 },
  { id: "heaters", label: "Barrel", x: 80, y: 125, w: 100, h: 30 },
  { id: "mold", label: "Mold", x: 195, y: 60, w: 80, h: 100 },
];

function healthColor(h: number): string {
  const r = h > 0.5 ? Math.round(255 * (1 - h) * 2) : 255;
  const g = h > 0.5 ? 255 : Math.round(255 * h * 2);
  return `rgb(${r},${g},60)`;
}

interface Props {
  health: Record<string, number> | undefined;
  activeFaults: string[];
  machineId?: string;
}

export function Twin2D({ health, activeFaults, machineId = "SIM-001" }: Props): JSX.Element {
  const [pulsing, setPulsing] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (activeFaults.length === 0) return;
    setPulsing(new Set(activeFaults));
    const t = window.setTimeout(() => setPulsing(new Set()), 400);
    return () => window.clearTimeout(t);
  }, [activeFaults]);

  const regionViews = useMemo(
    () =>
      REGIONS.map((r) => {
        const h = health?.[r.id] ?? 1;
        const color = healthColor(h);
        const opacity = 0.15 + (1 - h) * 0.4;
        const strokeW = pulsing.has(r.id) ? 3 : 1.5;
        return { ...r, color, opacity, strokeW, h };
      }),
    [health, pulsing],
  );

  return (
    <svg viewBox="0 0 290 230" className="h-auto w-full">
      <rect
        x="5"
        y="5"
        width="280"
        height="220"
        rx="8"
        fill="none"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <polygon points="185,95 185,125 195,110" fill="#475569" />

      {regionViews.map((r) => (
        <g key={r.id}>
          <title>{`${r.label} — ${Math.round(r.h * 100)}% health`}</title>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="4"
            fill={r.color}
            fillOpacity={r.opacity}
            stroke={r.color}
            strokeWidth={r.strokeW}
            style={{ transition: "fill 0.5s, stroke 0.5s" }}
          />
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 + 4}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
          >
            {r.label}
          </text>
        </g>
      ))}

      <text x="145" y="22" textAnchor="middle" fontSize="10" fill="#fbbf24">
        IMM {machineId}
      </text>
    </svg>
  );
}
