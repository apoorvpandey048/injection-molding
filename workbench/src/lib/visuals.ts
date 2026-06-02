import {
  type Material,
  Color,
  MeshStandardMaterial,
} from "three";
import type { DisplayMode, ModelIndex, ViewMode } from "@/types";
import { subsystemColor, type Subsystem } from "@/subsystems";
import { wb } from "./model";

export interface VisualState {
  assignments: Record<string, Subsystem>;
  selection: Set<string>;
  hovered: string | null;
  isolated: Set<string> | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showEdges: boolean;
}

const XRAY_OPACITY = 0.12;
const BLACK = new Color(0x000000);
const SELECT_EMISSIVE = new Color(0x0c4a52); // subtle teal lift; outline is the primary cue
const HOVER_EMISSIVE = new Color(0x1f2937);

function forEachMat(m: Material | Material[] | null, fn: (mm: Material) => void): void {
  if (!m) return;
  if (Array.isArray(m)) m.forEach(fn);
  else fn(m);
}

function setEmissive(m: Material, c: Color): void {
  const em = (m as unknown as { emissive?: Color }).emissive;
  if (em) em.copy(c);
}

/**
 * Imperatively reconcile every mesh's three.js material/visibility with the
 * current workbench state. Called whenever any visual slice of the store
 * changes. O(#meshes) and runs in well under a millisecond for this model, so a
 * full re-apply on each change keeps the logic simple and always-consistent
 * rather than trying to diff individual meshes.
 */
export function applyVisuals(index: ModelIndex, s: VisualState): void {
  const isolating = s.isolated != null && s.isolated.size > 0;
  const xray = s.displayMode === "xray";
  const wireframe = s.displayMode === "wireframe";

  index.meshes.forEach((info) => {
    const obj = info.object;
    const u = wb(obj);
    if (!u) return;

    const inIsolation = !isolating || s.isolated!.has(info.id);
    obj.visible = inIsolation;
    if (!inIsolation) return; // hidden — nothing else to do

    const selected = s.selection.has(info.id);
    const hovered = s.hovered === info.id;

    // 1. Pick the active material set: authored textures or flat class colour.
    let active: Material | Material[];
    if (s.viewMode === "classification") {
      if (!u.klass) {
        u.klass = new MeshStandardMaterial({ roughness: 0.82, metalness: 0.04 });
        u.klass.userData.baseOpacity = 1;
        u.klass.userData.baseTransparent = false;
      }
      const sub = s.assignments[info.id] ?? "Unknown";
      u.klass.color.set(subsystemColor(sub));
      active = u.klass;
    } else {
      active = u.original ?? new MeshStandardMaterial();
    }
    obj.material = active;

    // 2. Wireframe + transparency + highlight applied to every active material.
    forEachMat(active, (mm) => {
      (mm as Material & { wireframe?: boolean }).wireframe = wireframe;

      if (xray && !selected) {
        mm.transparent = true;
        mm.opacity = XRAY_OPACITY;
        mm.depthWrite = false;
      } else {
        mm.transparent = Boolean(mm.userData.baseTransparent);
        mm.opacity = (mm.userData.baseOpacity as number | undefined) ?? 1;
        mm.depthWrite = true;
      }

      setEmissive(mm, selected ? SELECT_EMISSIVE : hovered ? HOVER_EMISSIVE : BLACK);
    });
  });

  // Edges: shown for definition, hidden while isolating to reduce clutter.
  const edgesVisible = s.showEdges && !isolating;
  for (const e of index.edges) e.visible = edgesVisible;
}
