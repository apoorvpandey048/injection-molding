import { useMemo } from "react";
import { useStore } from "@/store/store";

export function StatusBar(): React.JSX.Element {
  const index = useStore((s) => s.index);
  const assignments = useStore((s) => s.assignments);
  const selectionSize = useStore((s) => s.selection.size);
  const hovered = useStore((s) => s.hovered);
  const displayMode = useStore((s) => s.displayMode);
  const viewMode = useStore((s) => s.viewMode);
  const isolated = useStore((s) => s.isolated);

  const stats = useMemo(() => {
    if (!index) return null;
    const total = index.meshes.size;
    let classified = 0;
    index.meshes.forEach((m) => {
      const s = assignments[m.id];
      if (s && s !== "Unknown") classified += 1;
    });
    return { total, classified, tris: index.totalTriangles };
  }, [index, assignments]);

  const hoveredName = hovered ? index?.meshes.get(hovered)?.name : null;

  return (
    <footer className="flex items-center gap-4 border-t border-panel-border bg-panel px-3 py-1 font-mono text-[11px] text-zinc-500">
      <span>
        {stats ? `${stats.total.toLocaleString()} meshes` : "—"} ·{" "}
        {stats ? `${stats.tris.toLocaleString()} tris` : "—"}
      </span>
      <span className="text-zinc-700">|</span>
      <span className="text-zinc-400">
        {stats ? `${stats.classified}/${stats.total} classified` : "—"}
      </span>
      <span className="text-zinc-700">|</span>
      <span>{selectionSize} selected</span>
      {isolated && <span className="text-amber-400">· isolating {isolated.size}</span>}
      <div className="flex-1" />
      {hoveredName && <span className="truncate text-zinc-400">⌖ {hoveredName}</span>}
      <span className="text-zinc-700">|</span>
      <span>
        {viewMode === "classification" ? "class colors" : "materials"} · {displayMode}
      </span>
    </footer>
  );
}
