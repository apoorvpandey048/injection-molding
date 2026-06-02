import { useMemo } from "react";
import { Eraser, FileJson, Tag, Trash2 } from "lucide-react";
import { useStore } from "@/store/store";
import { SUBSYSTEMS, SUBSYSTEM_META, subsystemColor, type Subsystem } from "@/subsystems";
import { buildDetailedExport, downloadJSON } from "@/lib/exporter";
import { cn } from "@/lib/cn";

export function ClassificationPanel(): React.JSX.Element {
  const index = useStore((s) => s.index);
  const assignments = useStore((s) => s.assignments);
  const selectionSize = useStore((s) => s.selection.size);
  const assignSelection = useStore((s) => s.assignSelection);
  const clearAssignment = useStore((s) => s.clearAssignment);
  const setSelection = useStore((s) => s.setSelection);
  const resetAssignments = useStore((s) => s.resetAssignments);
  const setToast = useStore((s) => s.setToast);

  const { counts, total, bySub } = useMemo(() => {
    const counts = Object.fromEntries(SUBSYSTEMS.map((s) => [s, 0])) as Record<Subsystem, number>;
    const bySub = Object.fromEntries(SUBSYSTEMS.map((s) => [s, [] as string[]])) as Record<Subsystem, string[]>;
    let total = 0;
    index?.meshes.forEach((m) => {
      total += 1;
      const sub = assignments[m.id] ?? "Unknown";
      counts[sub] += 1;
      bySub[sub].push(m.id);
    });
    return { counts, total, bySub };
  }, [index, assignments]);

  const classified = total - counts.Unknown;
  const pct = total ? Math.round((classified / total) * 100) : 0;

  const handleReset = () => {
    if (confirm("Clear ALL subsystem assignments? This cannot be undone.")) {
      resetAssignments();
      setToast("All assignments cleared");
    }
  };

  const handleDetailed = () => {
    if (!index) return;
    downloadJSON("component-map.detailed.json", buildDetailedExport(index, assignments));
    setToast("Exported component-map.detailed.json");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Classification
        </span>
        <span className="font-mono text-[10px] normal-case tracking-normal text-zinc-500">
          {classified}/{total} · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-3 pt-2">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-panel-inset">
          {SUBSYSTEMS.filter((s) => s !== "Unknown").map((s) =>
            counts[s] ? (
              <div
                key={s}
                style={{ width: `${(counts[s] / total) * 100}%`, background: subsystemColor(s) }}
                title={`${s}: ${counts[s]}`}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Assign buttons (Phase 5) */}
      <div className="px-3 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">Assign selection</span>
          <span className="font-mono text-[11px] text-zinc-400">
            {selectionSize} mesh{selectionSize === 1 ? "" : "es"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SUBSYSTEMS.map((s) => (
            <button
              key={s}
              disabled={selectionSize === 0}
              onClick={() => assignSelection(s)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                "border-panel-border bg-panel-raised text-zinc-200 hover:bg-panel-border",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              title={SUBSYSTEM_META[s].hint}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/30"
                style={{ background: subsystemColor(s) }}
              />
              <span className="truncate">{s}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-500">{SUBSYSTEM_META[s].hotkey}</span>
            </button>
          ))}
        </div>
        <button
          disabled={selectionSize === 0}
          onClick={() => {
            clearAssignment([...useStore.getState().selection]);
          }}
          className="btn mt-1.5 w-full justify-center"
        >
          <Eraser className="h-3.5 w-3.5" /> Reset selection to Unknown
        </button>
      </div>

      {/* Legend + counts (Phase 6) */}
      <div className="mt-3 min-h-0 flex-1 overflow-auto px-3">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
          Subsystems · click to select
        </div>
        <div className="space-y-0.5">
          {SUBSYSTEMS.map((s) => (
            <button
              key={s}
              onClick={() => setSelection(bySub[s], null)}
              disabled={counts[s] === 0}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-panel-raised disabled:opacity-40"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/30"
                style={{ background: subsystemColor(s) }}
              />
              <span className="text-zinc-300">{s}</span>
              <span className="ml-auto font-mono text-zinc-500">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Export / reset (Phase 7) */}
      <div className="flex gap-1.5 border-t border-panel-border p-2">
        <button className="btn flex-1 justify-center" onClick={handleDetailed} title="Rich export with metadata + group ids">
          <FileJson className="h-3.5 w-3.5" /> Detailed
        </button>
        <button className="btn justify-center text-red-300/80 hover:text-red-200" onClick={handleReset} title="Clear all assignments">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
