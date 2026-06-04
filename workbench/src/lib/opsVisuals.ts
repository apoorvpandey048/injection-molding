// Operations-mode rendering: tint every monitored mesh by its subsystem's LIVE
// health (green→amber→red), render structure as neutral metal, and emphasise the
// active subsystem (selected or hovered) by ghosting everything else. This is the
// "condition at a glance on the model itself" channel (DECISIONS.md D-05).
//
// Like the workbench's classification view it reconciles imperatively over the
// ~1114 meshes in well under a millisecond, so it stays at 60 FPS without any
// per-mesh React nodes.

import { Color, type Material, MeshStandardMaterial } from "three";
import type { ModelIndex } from "@/types";
import type { Subsystem } from "@/subsystems";
import { wb } from "./model";
import { healthColor } from "./health";

const STRUCTURE = new Color(0x47505f); // neutral metal for unmonitored frame/guards
const GHOST = new Color(0x232a33); // faint neutral for ghosted (non-active) meshes
const BLACK = new Color(0x000000);
const _e = new Color();

export interface OpsVisualState {
  assignments: Record<string, Subsystem>;
  /** Per-subsystem live health 0..1 (monitored only). */
  health: Partial<Record<Subsystem, number>>;
  selected: Subsystem | null;
  hovered: Subsystem | null;
  showEdges: boolean;
}

function setEmissive(m: Material, c: Color): void {
  const em = (m as unknown as { emissive?: Color }).emissive;
  if (em) em.copy(c);
}

export function applyOpsVisuals(index: ModelIndex, s: OpsVisualState): void {
  const active = s.selected ?? s.hovered;

  index.meshes.forEach((info) => {
    const obj = info.object;
    const u = wb(obj);
    if (!u) return;
    obj.visible = true;

    if (!u.klass) {
      u.klass = new MeshStandardMaterial({ roughness: 0.78, metalness: 0.12 });
      u.klass.userData.baseOpacity = 1;
    }
    const mat = u.klass;
    obj.material = mat;
    mat.wireframe = false;

    const sub = s.assignments[info.id] ?? "Unknown";
    const monitored = sub !== "Unknown";
    const isActive = active != null && sub === active;
    const isGhost = active != null && sub !== active;

    // 1. base colour — ghosts fade to faint neutral so the active subsystem pops
    //    regardless of its (possibly green) health colour.
    if (isGhost) {
      mat.color.copy(GHOST);
    } else if (monitored) {
      mat.color.set(healthColor(s.health[sub] ?? 1));
    } else {
      mat.color.copy(STRUCTURE);
    }

    // 2. opacity / emphasis
    let opacity = 1;
    if (isGhost) opacity = 0.07;
    else if (!monitored) opacity = 0.9; // structure slightly recessive
    mat.opacity = opacity;
    mat.transparent = opacity < 1;
    mat.depthWrite = opacity >= 0.5;

    // 3. glow the active subsystem
    if (isActive && monitored) {
      _e.copy(mat.color).multiplyScalar(0.32);
      setEmissive(mat, _e);
    } else {
      setEmissive(mat, BLACK);
    }
  });

  for (const e of index.edges) e.visible = s.showEdges && !active;
}
