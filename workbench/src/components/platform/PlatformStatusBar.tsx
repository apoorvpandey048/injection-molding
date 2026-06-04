import { useStore } from "@/store/store";
import { MONITORED, identityOf } from "@/lib/identity";
import { deriveSubsystemHealth, worstSubsystem } from "@/lib/health";
import { formatHorizon, pct } from "@/lib/format";

const SOURCE_LABEL: Record<string, string> = {
  file: "map: source-of-truth file",
  derived: "map: auto-derived",
  local: "map: local edits",
};

export function PlatformStatusBar(): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const connected = useStore((s) => s.connected);
  const index = useStore((s) => s.index);
  const mapSource = useStore((s) => s.mapSource);
  const mode = useStore((s) => s.mode);
  const selectionSize = useStore((s) => s.selection.size);

  const worst = worstSubsystem(snapshot, MONITORED);
  const worstSh = worst ? deriveSubsystemHealth(snapshot, worst) : null;
  const alerts = (snapshot?.active_faults?.length ?? 0) + (snapshot?.machine_state === "failed" ? 1 : 0);

  return (
    <footer className="flex items-center gap-3 border-t border-panel-border bg-panel px-4 py-1 font-mono text-[11px] text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
        {connected ? "connected" : "offline"}
      </span>
      <span className="text-zinc-700">|</span>
      <span>cycle #{(snapshot?.cycle_index ?? 0).toLocaleString()}</span>
      <span className="text-zinc-700">|</span>
      {worstSh ? (
        <span>
          worst: <span className="text-zinc-300">{identityOf(worstSh.subsystem).label}</span> {pct(worstSh.health)} · {formatHorizon(worstSh.daysUntil)}
        </span>
      ) : (
        <span>worst: —</span>
      )}
      <span className="text-zinc-700">|</span>
      <span className={alerts > 0 ? "text-amber-400" : ""}>{alerts} alert{alerts === 1 ? "" : "s"}</span>

      <div className="flex-1" />

      {mode === "inspection" && <span>{selectionSize} selected · </span>}
      <span>{index ? `${index.meshes.size.toLocaleString()} meshes` : "loading…"}</span>
      <span className="text-zinc-700">|</span>
      <span>{mapSource ? SOURCE_LABEL[mapSource] ?? "map: —" : "map: …"}</span>
    </footer>
  );
}
