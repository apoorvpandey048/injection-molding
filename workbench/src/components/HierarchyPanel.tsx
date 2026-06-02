import { useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListTree,
  Search,
  Shapes,
} from "lucide-react";
import { useStore } from "@/store/store";
import type { TreeNode } from "@/types";
import { subsystemColor, type Subsystem } from "@/subsystems";
import { cn } from "@/lib/cn";

function ancestorIds(id: string): string[] {
  const parts = id.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

/** Uniform subsystem colour for a group, or null if its meshes are mixed/unknown. */
function groupColor(
  node: TreeNode,
  assignments: Record<string, Subsystem>,
): string | null {
  if (node.type === "mesh") {
    const s = assignments[node.id];
    return s && s !== "Unknown" ? subsystemColor(s) : null;
  }
  let first: Subsystem | undefined;
  for (const id of node.meshIds) {
    const s = assignments[id] ?? "Unknown";
    if (first === undefined) first = s;
    else if (first !== s) return null;
  }
  return first && first !== "Unknown" ? subsystemColor(first) : null;
}

export function HierarchyPanel(): React.JSX.Element {
  const index = useStore((s) => s.index);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const expanded = useStore((s) => s.expanded);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const expandAll = useStore((s) => s.expandAll);
  const collapseAll = useStore((s) => s.collapseAll);
  const selection = useStore((s) => s.selection);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const assignments = useStore((s) => s.assignments);
  const selectNode = useStore((s) => s.selectNode);
  const setHovered = useStore((s) => s.setHovered);
  const setExpanded = useStore((s) => s.setExpanded);

  const scrollRef = useRef<HTMLDivElement>(null);
  const q = search.trim().toLowerCase();

  // When a mesh is picked in the 3D view, reveal + scroll its row into the tree.
  useEffect(() => {
    if (!activeNodeId) return;
    setExpanded(ancestorIds(activeNodeId), true);
    const id = window.requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector(`[data-node-id="${CSS.escape(activeNodeId)}"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeNodeId, setExpanded]);

  // Search visibility: a node is shown if it or any descendant matches.
  const visible = useMemo(() => {
    if (!q || !index) return null;
    const set = new Set<string>();
    const matches = (n: TreeNode): boolean =>
      n.name.toLowerCase().includes(q) ||
      (n.type === "mesh" &&
        (index.meshes.get(n.id)?.materialName.toLowerCase().includes(q) ?? false));
    const walk = (n: TreeNode): boolean => {
      let any = matches(n);
      for (const c of n.children) any = walk(c) || any;
      if (any) set.add(n.id);
      return any;
    };
    index.tree.forEach(walk);
    return set;
  }, [q, index]);

  const rows = useMemo(() => {
    if (!index) return [] as React.JSX.Element[];
    const out: React.JSX.Element[] = [];

    const render = (node: TreeNode, depth: number) => {
      if (visible && !visible.has(node.id)) return;
      const isGroup = node.type === "group";
      const open = isGroup && (visible ? true : expanded.has(node.id));
      const selected = node.type === "mesh" ? selection.has(node.id) : node.meshIds.every((m) => selection.has(m)) && selection.size > 0;
      const active = activeNodeId === node.id;
      const color = groupColor(node, assignments);

      out.push(
        <div
          key={node.id}
          data-node-id={node.id}
          className={cn(
            "group flex cursor-pointer items-center gap-1 rounded px-1 py-[3px] text-xs",
            selected ? "bg-sky-500/20 text-sky-100" : "hover:bg-panel-raised text-zinc-300",
            active && "ring-1 ring-inset ring-sky-500/50",
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
          onMouseEnter={() => node.type === "mesh" && setHovered(node.id)}
          onMouseLeave={() => setHovered(null)}
          onClick={(e) => selectNode(node.id, e.shiftKey || e.ctrlKey || e.metaKey)}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500"
            onClick={(e) => {
              if (isGroup) {
                e.stopPropagation();
                toggleExpand(node.id);
              }
            }}
          >
            {isGroup ? (
              open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : null}
          </span>
          {isGroup ? (
            open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          ) : (
            <Shapes className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          )}
          <span className="truncate font-mono">{node.name}</span>
          {color && (
            <span
              className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/30"
              style={{ background: color }}
            />
          )}
          {isGroup && (
            <span className={cn("shrink-0 text-[10px] text-zinc-600", color ? "ml-1.5" : "ml-auto")}>
              {node.meshIds.length}
            </span>
          )}
        </div>,
      );

      if (isGroup && open) for (const c of node.children) render(c, depth + 1);
    };

    index.tree.forEach((n) => render(n, 0));
    return out;
  }, [index, visible, expanded, selection, activeNodeId, assignments, selectNode, setHovered, toggleExpand]);

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-1.5">
          <ListTree className="h-3.5 w-3.5" /> Hierarchy
        </span>
        <span className="flex items-center gap-1 normal-case tracking-normal">
          <button className="text-[10px] text-zinc-500 hover:text-zinc-300" onClick={expandAll}>
            Expand
          </button>
          <span className="text-zinc-700">/</span>
          <button className="text-[10px] text-zinc-500 hover:text-zinc-300" onClick={collapseAll}>
            Collapse
          </button>
        </span>
      </div>

      <div className="relative px-2 py-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components & materials…"
          className="w-full rounded-md border border-panel-border bg-panel-inset py-1.5 pl-8 pr-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/60 focus:outline-none"
        />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {rows.length ? (
          rows
        ) : (
          <div className="px-3 py-6 text-center text-xs text-zinc-600">
            {index ? "No matching components" : "Loading…"}
          </div>
        )}
      </div>
    </div>
  );
}
