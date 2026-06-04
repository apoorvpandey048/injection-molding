// Predicted part-quality distribution as a stacked probability bar.

import type { QualityData } from "@/data/api";
import { pct } from "@/lib/format";
import { cn } from "@/lib/cn";

const SEG: Array<{ key: string; label: string; color: string }> = [
  { key: "good", label: "Good", color: "#34d399" },
  { key: "acceptable", label: "Acceptable", color: "#fbbf24" },
  { key: "waste", label: "Waste", color: "#f4554e" },
];

export function QualityBar({ quality }: { quality: QualityData | null }): React.JSX.Element {
  const p = quality?.probability ?? {};
  const total = SEG.reduce((a, s) => a + (p[s.key] ?? 0), 0) || 1;
  const label = quality?.label ?? "unknown";

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel-inset ring-1 ring-panel-border">
        {SEG.map((s) => {
          const w = ((p[s.key] ?? 0) / total) * 100;
          return w > 0 ? (
            <div key={s.key} style={{ width: `${w}%`, background: s.color }} className="h-full transition-all" />
          ) : null;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {SEG.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="font-mono text-zinc-300">{pct((p[s.key] ?? 0) / total, 0)}</span>
          </span>
        ))}
        <span
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            label === "good" && "bg-emerald-500/15 text-emerald-300",
            label === "acceptable" && "bg-amber-500/15 text-amber-300",
            label === "waste" && "bg-red-500/15 text-red-300",
            label === "unknown" && "bg-zinc-500/15 text-zinc-300",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
