import { useMemo } from "react";
import { Info, MousePointerSquareDashed } from "lucide-react";
import { useStore } from "@/store/store";
import { subsystemColor, type Subsystem } from "@/subsystems";

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`truncate text-right text-xs text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function AssignmentBadge({ subsystem }: { subsystem: Subsystem }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full ring-1 ring-black/30"
        style={{ background: subsystemColor(subsystem) }}
      />
      {subsystem}
    </span>
  );
}

export function InspectorPanel(): React.JSX.Element {
  const index = useStore((s) => s.index);
  const selection = useStore((s) => s.selection);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const assignments = useStore((s) => s.assignments);

  const view = useMemo(() => {
    if (!index || selection.size === 0) return { kind: "empty" as const };

    // Single active mesh → full metadata.
    const activeMesh = activeNodeId ? index.meshes.get(activeNodeId) : undefined;
    if (selection.size === 1 || activeMesh) {
      const mesh = activeMesh ?? index.meshes.get([...selection][0]);
      if (mesh) {
        return { kind: "mesh" as const, mesh, subsystem: assignments[mesh.id] ?? ("Unknown" as Subsystem) };
      }
    }

    // Group / multi-selection → aggregate summary.
    const ids = [...selection];
    let triangles = 0;
    const breakdown: Record<string, number> = {};
    for (const id of ids) {
      const m = index.meshes.get(id);
      if (!m) continue;
      triangles += m.triangles;
      const sub = assignments[id] ?? "Unknown";
      breakdown[sub] = (breakdown[sub] ?? 0) + 1;
    }
    const groupNode = activeNodeId ? index.nodesById.get(activeNodeId) : undefined;
    return {
      kind: "multi" as const,
      count: ids.length,
      triangles,
      breakdown,
      groupName: groupNode?.type === "group" ? groupNode.name : null,
    };
  }, [index, selection, activeNodeId, assignments]);

  return (
    <div className="flex flex-col">
      <div className="panel-header">
        <Info className="h-3.5 w-3.5" /> Inspector
      </div>
      <div className="px-3 py-2">
        {view.kind === "empty" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-zinc-600">
            <MousePointerSquareDashed className="h-6 w-6" />
            <div className="text-xs">Hover to identify · click to select</div>
            <div className="text-[11px] text-zinc-700">Shift / Ctrl-click to add to selection</div>
          </div>
        )}

        {view.kind === "mesh" && (
          <div className="divide-y divide-panel-border/60">
            <Row label="Mesh" value={view.mesh.name} />
            <Row label="Parent" value={view.mesh.parentName ?? "—"} />
            <Row label="Material" value={view.mesh.materialName} />
            <Row label="Triangles" value={view.mesh.triangles.toLocaleString()} />
            <Row label="Vertices" value={view.mesh.vertices.toLocaleString()} />
            <Row label="Assignment" value={<AssignmentBadge subsystem={view.subsystem} />} mono={false} />
            <Row label="ID" value={<span className="text-[10px] text-zinc-500">{view.mesh.id}</span>} />
          </div>
        )}

        {view.kind === "multi" && (
          <div className="divide-y divide-panel-border/60">
            {view.groupName && <Row label="Group" value={view.groupName} />}
            <Row label="Selected" value={`${view.count} mesh${view.count === 1 ? "" : "es"}`} />
            <Row label="Triangles" value={view.triangles.toLocaleString()} />
            <div className="py-2">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Breakdown</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(view.breakdown).map(([sub, n]) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1 rounded border border-panel-border bg-panel-inset px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: subsystemColor(sub as Subsystem) }}
                    />
                    {sub} · {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
