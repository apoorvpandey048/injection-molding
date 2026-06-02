import type { ComponentMap, ModelIndex } from "@/types";
import { SUBSYSTEMS, type Subsystem } from "@/subsystems";

const MODEL_NAME = "model.dae";

/**
 * Build the exact, minimal Phase 7 contract:
 *
 *   { "Hydraulic": [...ids], "ScrewCheckRing": [...], ..., "Unknown": [...] }
 *
 * Every classifiable mesh appears in exactly one bucket. Meshes with no explicit
 * assignment fall into "Unknown" so the file is a complete, lossless partition of
 * the model — a downstream system can rely on every mesh being accounted for.
 */
export function buildComponentMap(
  index: ModelIndex,
  assignments: Record<string, Subsystem>,
): ComponentMap {
  const map = Object.fromEntries(SUBSYSTEMS.map((s) => [s, [] as string[]])) as ComponentMap;
  for (const id of index.meshes.keys()) {
    const sub = assignments[id] ?? "Unknown";
    map[sub].push(id);
  }
  for (const s of SUBSYSTEMS) map[s].sort();
  return map;
}

/**
 * Derive the set of *group* node ids that are wholly assigned to a single
 * subsystem (every descendant mesh shares it, and it is not the default
 * Unknown). This realises the Phase 7 requirement to store group identifiers,
 * computed rather than tracked so it can never drift from the mesh truth.
 */
export function buildGroupAssignments(
  index: ModelIndex,
  assignments: Record<string, Subsystem>,
): Record<string, Subsystem> {
  const groups: Record<string, Subsystem> = {};
  index.nodesById.forEach((node) => {
    if (node.type !== "group" || node.meshIds.length === 0) return;
    const first = assignments[node.meshIds[0]] ?? "Unknown";
    if (first === "Unknown") return;
    const uniform = node.meshIds.every((id) => (assignments[id] ?? "Unknown") === first);
    if (uniform) groups[node.id] = first;
  });
  return groups;
}

export interface DetailedExport {
  version: 1;
  model: string;
  generatedAt: string;
  subsystems: readonly Subsystem[];
  counts: Record<Subsystem, number>;
  /** The canonical Phase 7 contract, embedded for convenience. */
  componentMap: ComponentMap;
  /** Groups fully classified to one subsystem (group identifiers). */
  groups: Record<string, Subsystem>;
  /** Per-mesh metadata, so a downstream twin needn't re-parse the DAE. */
  meshes: Record<
    string,
    { name: string; subsystem: Subsystem; parent: string | null; material: string; triangles: number }
  >;
}

export function buildDetailedExport(
  index: ModelIndex,
  assignments: Record<string, Subsystem>,
): DetailedExport {
  const componentMap = buildComponentMap(index, assignments);
  const counts = Object.fromEntries(
    SUBSYSTEMS.map((s) => [s, componentMap[s].length]),
  ) as Record<Subsystem, number>;

  const meshes: DetailedExport["meshes"] = {};
  index.meshes.forEach((m) => {
    meshes[m.id] = {
      name: m.name,
      subsystem: assignments[m.id] ?? "Unknown",
      parent: m.parentName,
      material: m.materialName,
      triangles: m.triangles,
    };
  });

  return {
    version: 1,
    model: MODEL_NAME,
    generatedAt: new Date().toISOString(),
    subsystems: SUBSYSTEMS,
    counts,
    componentMap,
    groups: buildGroupAssignments(index, assignments),
    meshes,
  };
}

/**
 * Parse a previously exported file (either the minimal contract or the detailed
 * form) back into a meshId -> subsystem map. Unknown buckets are dropped (they
 * are the implicit default), and ids absent from the current model are ignored
 * so a slightly stale map still imports cleanly.
 */
export function parseImport(
  json: unknown,
  index: ModelIndex,
): { assignments: Record<string, Subsystem>; matched: number; skipped: number } {
  const valid = new Set(index.meshes.keys());
  const out: Record<string, Subsystem> = {};
  let matched = 0;
  let skipped = 0;

  const map: unknown =
    json && typeof json === "object" && "componentMap" in (json as object)
      ? (json as { componentMap: unknown }).componentMap
      : json;

  if (!map || typeof map !== "object") {
    throw new Error("File is not a recognised component-map.json");
  }

  for (const sub of SUBSYSTEMS) {
    const ids = (map as Record<string, unknown>)[sub];
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id !== "string") continue;
      if (sub === "Unknown") continue; // implicit default, no need to store
      if (valid.has(id)) {
        out[id] = sub;
        matched += 1;
      } else {
        skipped += 1;
      }
    }
  }
  return { assignments: out, matched, skipped };
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
