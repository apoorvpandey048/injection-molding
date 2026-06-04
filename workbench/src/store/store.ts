import { create } from "zustand";
import type { DisplayMode, MeshInfo, ModelIndex, TreeNode, ViewMode } from "@/types";
import type { Subsystem } from "@/subsystems";
import { SUBSYSTEMS } from "@/subsystems";
import type { Snapshot } from "@/data/api";
import { resolveMapping, type MapSource } from "@/lib/mapResolve";

const STORAGE_KEY = "imm-platform:v1";
const HISTORY_CAP = 300;

export type AppMode = "operations" | "inspection";

interface Persisted {
  assignments: Record<string, Subsystem>;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showEdges: boolean;
  mode: AppMode;
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

function computeSubsystemMeshes(
  index: ModelIndex | null,
  assignments: Record<string, Subsystem>,
): Record<Subsystem, string[]> {
  const out = Object.fromEntries(SUBSYSTEMS.map((s) => [s, [] as string[]])) as Record<Subsystem, string[]>;
  if (!index) return out;
  index.meshes.forEach((_info, id) => {
    out[assignments[id] ?? "Unknown"].push(id);
  });
  return out;
}

export interface PlatformState {
  // ---- model ----
  index: ModelIndex | null;
  loadError: string | null;
  setIndex: (index: ModelIndex) => void;
  setLoadError: (msg: string) => void;

  // ---- live data (Operations) ----
  snapshot: Snapshot | null;
  connected: boolean;
  /** Per-backend-key health history ring-buffer (newest last). */
  history: Record<string, number[]>;
  ingestSnapshot: (snap: Snapshot) => void;
  setConnected: (b: boolean) => void;

  // ---- app mode + active context ----
  mode: AppMode;
  setMode: (m: AppMode) => void;
  selectedSubsystem: Subsystem | null;
  hoveredSubsystem: Subsystem | null;
  selectSubsystem: (sub: Subsystem | null) => void;
  setHoveredSubsystem: (sub: Subsystem | null) => void;

  // ---- component mapping ----
  assignments: Record<string, Subsystem>;
  subsystemMeshes: Record<Subsystem, string[]>;
  mapSource: MapSource | "local" | null;
  initMapping: (index: ModelIndex) => Promise<void>;
  assignSelection: (subsystem: Subsystem) => void;
  assignIds: (ids: string[], subsystem: Subsystem) => void;
  assignGroup: (groupId: string, subsystem: Subsystem) => void;
  clearAssignment: (ids: string[]) => void;
  resetAssignments: () => void;
  importAssignments: (a: Record<string, Subsystem>) => void;

  // ---- mesh-level selection (Inspection) ----
  selection: Set<string>;
  activeNodeId: string | null;
  hovered: string | null;
  selectMesh: (id: string, additive?: boolean) => void;
  selectNode: (nodeId: string, additive?: boolean) => void;
  setSelection: (ids: string[], activeNodeId?: string | null) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;

  // ---- isolation / display (Inspection) ----
  isolated: Set<string> | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showEdges: boolean;
  isolateSelection: () => void;
  clearIsolation: () => void;
  setViewMode: (m: ViewMode) => void;
  setDisplayMode: (m: DisplayMode) => void;
  toggleEdges: () => void;

  // ---- hierarchy explorer (Inspection) ----
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

function persist(state: PlatformState) {
  const data: Persisted = {
    assignments: state.assignments,
    viewMode: state.viewMode,
    displayMode: state.displayMode,
    showEdges: state.showEdges,
    mode: state.mode,
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

export const useStore = create<PlatformState>((set, get) => {
  let nonce = 0;
  const next = () => (nonce += 1);

  const recompute = () =>
    set((s) => ({ subsystemMeshes: computeSubsystemMeshes(s.index, s.assignments) }));
  const afterAssign = () => {
    recompute();
    persist(get());
  };

  return {
    index: null,
    loadError: null,
    setIndex: (index) => set({ index, subsystemMeshes: computeSubsystemMeshes(index, get().assignments) }),
    setLoadError: (msg) => set({ loadError: msg }),

    // ---- live data ----
    snapshot: null,
    connected: false,
    history: {},
    ingestSnapshot: (snap) =>
      set((s) => {
        const prev = s.snapshot;
        const base = prev && snap.cycle_index < prev.cycle_index ? {} : s.history;
        const hist: Record<string, number[]> = { ...base };
        for (const key of Object.keys(snap.health ?? {})) {
          const arr = hist[key] ? hist[key].slice() : [];
          arr.push(snap.health[key]);
          if (arr.length > HISTORY_CAP) arr.shift();
          hist[key] = arr;
        }
        return { snapshot: snap, history: hist, connected: true };
      }),
    setConnected: (b) => set({ connected: b }),

    // ---- mode + context ----
    mode: persisted.mode ?? "operations",
    setMode: (m) =>
      set((s) => {
        // leaving inspection: drop mesh-level state so operations renders cleanly
        const leaving = m === "operations";
        persist({ ...s, mode: m } as PlatformState);
        return leaving
          ? { mode: m, isolated: null, selection: new Set<string>(), hovered: null, activeNodeId: null }
          : { mode: m };
      }),
    selectedSubsystem: null,
    hoveredSubsystem: null,
    selectSubsystem: (sub) => {
      if (sub == null) {
        set({ selectedSubsystem: null });
        return;
      }
      const ids = get().subsystemMeshes[sub] ?? [];
      set({
        selectedSubsystem: sub,
        cameraCommand: ids.length ? { kind: "focus", ids, nonce: next() } : get().cameraCommand,
      });
    },
    setHoveredSubsystem: (sub) => {
      if (get().hoveredSubsystem !== sub) set({ hoveredSubsystem: sub });
    },

    // ---- mapping ----
    assignments: persisted.assignments ?? {},
    subsystemMeshes: computeSubsystemMeshes(null, persisted.assignments ?? {}),
    mapSource: null,
    initMapping: async (index) => {
      // The committed component map is the SOURCE OF TRUTH and wins for
      // determinism (a fresh clone / a returning reviewer both see the same map).
      // localStorage edits only apply when there is no committed file; otherwise
      // unsaved inspection edits are session-local until exported.
      const total = index.meshes.size;
      const { assignments, source } = await resolveMapping(index);
      if (source === "file") {
        set({ assignments, mapSource: "file", subsystemMeshes: computeSubsystemMeshes(index, assignments) });
        return;
      }
      const existing = get().assignments;
      if (Object.keys(existing).length >= total * 0.5) {
        set({ mapSource: "local", subsystemMeshes: computeSubsystemMeshes(index, existing) });
        return;
      }
      set({ assignments, mapSource: source, subsystemMeshes: computeSubsystemMeshes(index, assignments) });
      persist(get());
    },
    assignIds: (ids, subsystem) => {
      if (!ids.length) return;
      set((s) => {
        const a = { ...s.assignments };
        for (const id of ids) a[id] = subsystem;
        return { assignments: a };
      });
      afterAssign();
    },
    assignSelection: (subsystem) => get().assignIds([...get().selection], subsystem),
    assignGroup: (groupId, subsystem) => get().assignIds(meshIdsOf(get().index, groupId), subsystem),
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

    // ---- mesh selection ----
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
        const fully = ids.every((i) => sel.has(i));
        if (additive && fully) ids.forEach((i) => sel.delete(i));
        else ids.forEach((i) => sel.add(i));
        return { selection: sel, activeNodeId: nodeId };
      }),
    setSelection: (ids, activeNodeId = null) => set({ selection: new Set(ids), activeNodeId }),
    clearSelection: () => set({ selection: new Set(), activeNodeId: null }),
    setHovered: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },

    // ---- isolation / display ----
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

    // ---- hierarchy ----
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

    // ---- camera ----
    cameraCommand: null,
    fitView: () => set({ cameraCommand: { kind: "fit", nonce: next() } }),
    focusSelection: () => {
      const ids = [...get().selection];
      if (ids.length) set({ cameraCommand: { kind: "focus", ids, nonce: next() } });
    },
    resetView: () => set({ cameraCommand: { kind: "reset", nonce: next() } }),

    // ---- toast ----
    toast: null,
    setToast: (msg) => set({ toast: msg }),
  };
});

// ---- selectors / derived helpers ----
export function subsystemOf(assignments: Record<string, Subsystem>, meshId: string): Subsystem {
  return assignments[meshId] ?? "Unknown";
}
export function meshInfoById(index: ModelIndex | null, id: string): MeshInfo | undefined {
  return index?.meshes.get(id);
}
