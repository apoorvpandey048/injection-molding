// Component Mapping Engine — automatic subsystem classifier.
//
// The COLLADA model has ~1114 mesh instances but only ~30 descriptive node
// names, so keyword matching alone cannot partition it. This classifier combines
// two deterministic signals:
//
//   1. NAME HINTS  — strong, applied first, for the handful of descriptive nodes
//      (hopper, platen, oil_cooler, …).
//   2. SPATIAL ZONES — for the unnamed `instance_N` majority: each mesh centroid
//      is projected onto the machine's principal axis (t) and vertical (v) and
//      mapped to the region that best matches a real injection-molding layout:
//
//        base (low v) ............................. Hydraulic power pack
//        top, injection end ....................... Screw & Check Ring
//        top, barrel ............................... Heaters
//        top, centre ............................... Drive
//        clamp end (full height) .................. Mold & Clamp
//
// Structural items (frames, guards, panels, fasteners, lights) are routed to
// Unknown so monitored assets stand out. The result is a complete, reproducible
// partition (every mesh in exactly one subsystem), refinable by an expert in
// Inspection mode. See DECISIONS.md D-02.

import { Box3, Vector3 } from "three";
import type { ModelIndex } from "@/types";
import type { Subsystem } from "@/subsystems";

type Axis = 0 | 1 | 2;

const NAME_HINTS: [RegExp, Subsystem][] = [
  // Structure first (so "screw_mount" / "light_cover" don't get pulled into a subsystem).
  [/guard|panel|door|cover|light|lamp|bolt|nut|hex|ubolt|screw_mount|bracket|frame|leg|foot|wheel|caster|label|logo|sticker|window|glass|base_triangle|stair|ladder|rail_base/, "Unknown"],
  // Mold & clamp.
  [/mold|mould|platen|clamp|tie[_-]?bar|ejector|bolster|cavity|core|toggle/, "Mold"],
  // Screw / check ring / barrel feed.
  [/hopper|barrel|nozzle|\bscrew\b|check[_-]?ring|feed[_-]?throat|feed[_-]?screw/, "ScrewCheckRing"],
  // Heaters.
  [/heater|heat[_-]?band|thermo|thermocouple|insulation/, "Heaters"],
  // Drive.
  [/motor|gearbox|gear|servo|coupling|belt|pulley|\bdrive\b/, "Mold" /* placeholder, overridden below */],
  // Hydraulic.
  [/hydraulic|\boil\b|cooler|tank|reservoir|hose|valve|cylinder|accumulator|\bpump\b|manifold|filter|pipe/, "Hydraulic"],
];
// Fix the Drive entry explicitly (kept separate to avoid the regex-array typo trap).
NAME_HINTS[4] = [/motor|gearbox|gear|servo|coupling|belt|pulley|\bdrive\b/, "Drive"];

function nameHint(name: string, parent: string | null): Subsystem | null {
  const hay = `${name} ${parent ?? ""}`.toLowerCase();
  for (const [re, sub] of NAME_HINTS) if (re.test(hay)) return sub;
  return null;
}

function spatialZone(t: number, v: number): Subsystem {
  // t: 0 = injection end → 1 = clamp/mold end.  v: 0 = floor → 1 = top.
  if (t >= 0.62) return "Mold"; // clamp / mold end, full height
  if (v < 0.4) {
    // lower body: power pack at the injection end, clamp-drive/motor toward centre
    return t < 0.42 ? "Hydraulic" : "Drive";
  }
  // upper body, injection end → centre
  if (t < 0.26) return "ScrewCheckRing"; // barrel / screw / hopper
  if (t < 0.46) return "Heaters"; // barrel heater bands
  return "Drive"; // upper centre (motor / gearbox / linkage)
}

export interface ClassifyResult {
  assignments: Record<string, Subsystem>;
  /** Diagnostic: principal axis and per-subsystem counts. */
  axis: Axis;
  counts: Record<string, number>;
}

export function classifyModel(index: ModelIndex): ClassifyResult {
  index.root.updateWorldMatrix(true, true);

  // 1. Centroids + global bounds.
  const centroids = new Map<string, Vector3>();
  const tmp = new Box3();
  const global = new Box3();
  index.meshes.forEach((info, id) => {
    tmp.setFromObject(info.object);
    if (tmp.isEmpty()) return;
    const c = tmp.getCenter(new Vector3());
    centroids.set(id, c);
    global.union(tmp);
  });

  const size = global.getSize(new Vector3());
  // Principal horizontal axis = the larger of X / Z (Y is vertical post-up-axis fix).
  const longAxis: Axis = size.x >= size.z ? 0 : 2;
  const vAxis: Axis = 1;
  const lo = global.min.getComponent(longAxis);
  const span = Math.max(1e-6, size.getComponent(longAxis));
  const vLo = global.min.y;
  const vSpan = Math.max(1e-6, size.y);

  const tOf = (c: Vector3) => (c.getComponent(longAxis) - lo) / span;
  const vOf = (c: Vector3) => (c.getComponent(vAxis) - vLo) / vSpan;

  // 2. Pre-pass: name hints (also used to orient the long axis).
  const hinted = new Map<string, Subsystem>();
  index.meshes.forEach((info, id) => {
    const h = nameHint(info.name, info.parentName);
    if (h) hinted.set(id, h);
  });

  // Orientation: ensure t increases toward the Mold/clamp end. Compare mean-t of
  // Mold-hinted vs ScrewCheckRing-hinted meshes; flip if reversed.
  const meanT = (sub: Subsystem): number | null => {
    let sum = 0;
    let n = 0;
    hinted.forEach((s, id) => {
      const c = centroids.get(id);
      if (s === sub && c) {
        sum += tOf(c);
        n++;
      }
    });
    return n ? sum / n : null;
  };
  const moldT = meanT("Mold");
  const screwT = meanT("ScrewCheckRing");
  const flip = moldT != null && screwT != null ? moldT < screwT : false;

  // 3. Assign every mesh.
  const assignments: Record<string, Subsystem> = {};
  const counts: Record<string, number> = {};
  index.meshes.forEach((_info, id) => {
    let sub = hinted.get(id);
    if (!sub) {
      const c = centroids.get(id);
      if (c) {
        let t = tOf(c);
        if (flip) t = 1 - t;
        sub = spatialZone(t, vOf(c));
      } else {
        sub = "Unknown";
      }
    }
    assignments[id] = sub;
    counts[sub] = (counts[sub] ?? 0) + 1;
  });

  return { assignments, axis: longAxis, counts };
}
