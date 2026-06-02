import { create } from "zustand";
import type { DisplayMode, MeshInfo, ModelIndex, TreeNode, ViewMode } from "@/types";
import type { Subsystem } from "@/subsystems";

const STORAGE_KEY = "imm-workbench:v1";

interface Persisted {
  assignments: Record<string, Subsystem>;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showEdges: boolean;
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

/** Camera commands are fire-and-forget signals consumed by the viewport. */
export type CameraCommand =
  | { kind: "fit"; nonce: number }
  | { kind: "focus"; ids: string[]; nonce: number }
  | { kind: "reset"; nonce: number }
  | null;

export interface WorkbenchState {
  // ---- model ----
  index: ModelIndex | null;
  loadError: string | null;
  setIndex: (index: ModelIndex) => void;
  setLoadError: (msg: string) => void;

  // ---- assignment (Phase 5) ----
  /** meshId -> subsystem. Absent means the implicit "Unknown" default. */
  assignments: Record<string, Subsystem>;
  assignSelection: (subsystem: Subsystem) => void;
  assignIds: (ids: string[], subsystem: Subsystem) => void;
  assignGroup: (groupId: string, subsystem: Subsystem) => void;
  clearAssignment: (ids: string[]) => void;
  resetAssignments: () => void;
  importAssignments: (a: Record<string, Subsystem>) => void;

  // ---- selection (Phase 2/3) ----
  selection: Set<string>;
  /** The last mesh or group node the user activated — drives the inspector + tree scroll. */
  activeNodeId: string | null;
  hovered: string | null;
  selectMesh: (id: string, additive?: boolean) => void;
  selectNode: (nodeId: string, additive?: boolean) => void;
  setSelection: (ids: string[], activeNodeId?: string | null) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;

  // ---- isolation / display (Phase 4 + 6) ----
  isolated: Set<string> | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showEdges: boolean;
  isolateSelection: () => void;
  clearIsolation: () => void;
  setViewMode: (m: ViewMode) => void;
  setDisplayMode: (m: DisplayMode) => void;
  toggleEdges: () => void;

  // ---- hierarchy explorer (Phase 3) ----
  search: string;
  expanded: Set<string>;
  setSearch: (s: string) => void;
  toggleExpand: (id: string) => void;
  setExpanded: (ids: string[], on: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // ---- camera commands ----
  cameraCommand: CameraCommand;
  fitView: () => void;
  focusSelection: () => void;
  resetView: () => void;

  // ---- transient toast ----
  toast: string | null;
  setToast: (msg: string | null) => void;
}

const persisted = loadPersisted();

function persist(state: WorkbenchState) {
  const data: Persisted = {
    assignments: state.assignments,
    viewMode: state.viewMode,
    displayMode: state.displayMode,
    showEdges: state.showEdges,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / unavailable — session still works, just not durable */
  }
}

/** Resolve a node id to the set of mesh ids it covers (a mesh is itself). */
function meshIdsOf(index: ModelIndex | null, nodeId: string): string[] {
  if (!index) return [];
  const node: TreeNode | undefined = index.nodesById.get(nodeId);
  return node ? node.meshIds : index.meshes.has(nodeId) ? [nodeId] : [];
}

export const useStore = create<WorkbenchState>((set, get) => {
  let nonce = 0;
  const next = () => (nonce += 1);

  const afterAssign = () => persist(get());

  return {
    index: null,
    loadError: null,
    setIndex: (index) => set({ index }),
    setLoadError: (msg) => set({ loadError: msg }),

    assignments: persisted.assignments ?? {},
    assignIds: (ids, subsystem) => {
      if (!ids.length) return;
      set((s) => {
        const a = { ...s.assignments };
        for (const id of ids) a[id] = subsystem;
        return { assignments: a };
      });
      afterAssign();
    },
    assignSelection: (subsystem) => {
      const ids = [...get().selection];
      get().assignIds(ids, subsystem);
    },
    assignGroup: (groupId, subsystem) => {
      get().assignIds(meshIdsOf(get().index, groupId), subsystem);
    },
    clearAssignment: (ids) => {
      set((s) => {
        const a = { ...s.assignments };
        for (const id of ids) delete a[id];
        return { assignments: a };
      });
      afterAssign();
    },
    resetAssignments: () => {
      set({ assignments: {} });
      afterAssign();
    },
    importAssignments: (a) => {
      set({ assignments: { ...a } });
      afterAssign();
    },

    selection: new Set(),
    activeNodeId: null,
    hovered: null,
    selectMesh: (id, additive = false) =>
      set((s) => {
        const sel = new Set(additive ? s.selection : []);
        if (additive && sel.has(id)) sel.delete(id);
        else sel.add(id);
        return { selection: sel, activeNodeId: id };
      }),
    selectNode: (nodeId, additive = false) =>
      set((s) => {
        const ids = meshIdsOf(s.index, nodeId);
        if (!ids.length) return {};
        const sel = new Set(additive ? s.selection : []);
        // Toggle the group as a unit when additive and already fully selected.
        const fully = ids.every((i) => sel.has(i));
        if (additive && fully) ids.forEach((i) => sel.delete(i));
        else ids.forEach((i) => sel.add(i));
        return { selection: sel, activeNodeId: nodeId };
      }),
    setSelection: (ids, activeNodeId = null) =>
      set({ selection: new Set(ids), activeNodeId }),
    clearSelection: () => set({ selection: new Set(), activeNodeId: null }),
    setHovered: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },

    isolated: null,
    viewMode: persisted.viewMode ?? "original",
    displayMode: persisted.displayMode ?? "solid",
    showEdges: persisted.showEdges ?? true,
    isolateSelection: () => {
      const sel = get().selection;
      if (sel.size) set({ isolated: new Set(sel) });
    },
    clearIsolation: () => set({ isolated: null }),
    setViewMode: (m) => {
      set({ viewMode: m });
      persist(get());
    },
    setDisplayMode: (m) => {
      set({ displayMode: m });
      persist(get());
    },
    toggleEdges: () => {
      set((s) => ({ showEdges: !s.showEdges }));
      persist(get());
    },

    search: "",
    expanded: new Set(),
    setSearch: (s) => set({ search: s }),
    toggleExpand: (id) =>
      set((s) => {
        const e = new Set(s.expanded);
        if (e.has(id)) e.delete(id);
        else e.add(id);
        return { expanded: e };
      }),
    setExpanded: (ids, on) =>
      set((s) => {
        const e = new Set(s.expanded);
        for (const id of ids) on ? e.add(id) : e.delete(id);
        return { expanded: e };
      }),
    expandAll: () =>
      set((s) => {
        const e = new Set<string>();
        s.index?.nodesById.forEach((n) => {
          if (n.type === "group") e.add(n.id);
        });
        return { expanded: e };
      }),
    collapseAll: () => set({ expanded: new Set() }),

    cameraCommand: null,
    fitView: () => set({ cameraCommand: { kind: "fit", nonce: next() } }),
    focusSelection: () => {
      const ids = [...get().selection];
      if (ids.length) set({ cameraCommand: { kind: "focus", ids, nonce: next() } });
    },
    resetView: () => set({ cameraCommand: { kind: "reset", nonce: next() } }),

    toast: null,
    setToast: (msg) => set({ toast: msg }),
  };
});

// ---- selectors / derived helpers (kept outside the store to avoid re-renders) ----

export function subsystemOf(assignments: Record<string, Subsystem>, meshId: string): Subsystem {
  return assignments[meshId] ?? "Unknown";
}

export function meshInfoById(index: ModelIndex | null, id: string): MeshInfo | undefined {
  return index?.meshes.get(id);
}
