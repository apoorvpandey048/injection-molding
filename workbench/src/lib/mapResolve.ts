// Resolve the ACTIVE component map for a freshly loaded model, with precedence:
//
//   1. committed source-of-truth file  /map/component-map.detailed.json
//   2. runtime spatial+name-hint classifier (and persist it, so the next boot is
//      file-sourced — "no repeated mapping process" from the deployment brief)
//
// Per-reviewer edits made in Inspection mode are layered on top by the store
// (localStorage), so this only establishes the shared baseline.

import type { ModelIndex } from "@/types";
import type { Subsystem } from "@/subsystems";
import { parseImport, buildDetailedExport } from "./exporter";
import { classifyModel } from "./classify";

const MAP_URL = "/map/component-map.detailed.json";

export type MapSource = "file" | "derived";

export interface ResolvedMap {
  assignments: Record<string, Subsystem>;
  source: MapSource;
}

export async function resolveMapping(index: ModelIndex): Promise<ResolvedMap> {
  // 1. committed source of truth
  try {
    const r = await fetch(MAP_URL, { cache: "no-store" });
    if (r.ok) {
      const json = (await r.json()) as unknown;
      const { assignments, matched } = parseImport(json, index);
      if (matched > 0) return { assignments, source: "file" };
    }
  } catch {
    /* no committed map yet — fall through to runtime classify */
  }

  // 2. runtime classify (deterministic) + best-effort persist
  const { assignments } = classifyModel(index);
  try {
    const detailed = buildDetailedExport(index, assignments);
    void fetch("/api/component-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detailed),
    }).catch(() => {});
  } catch {
    /* persistence is best-effort; the derived map still drives this session */
  }
  return { assignments, source: "derived" };
}
