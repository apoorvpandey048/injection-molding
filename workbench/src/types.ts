import type { Mesh, Object3D } from "three";
import type { Subsystem } from "./subsystems";

/**
 * Per-mesh inspection record. One of these exists for every renderable mesh in
 * the loaded model. The `id` is a stable, deterministic identifier derived from
 * the node-name path (see lib/model.ts) so that an exported component-map.json
 * keeps referring to the same geometry across reloads and across machines.
 */
export interface MeshInfo {
  id: string;
  /** Display name (the SketchUp node/group name, e.g. "instance_42"). */
  name: string;
  /** Stable id of the parent group node. */
  parentId: string | null;
  /** Display name of the immediate parent group. */
  parentName: string | null;
  /** Material name as authored in the COLLADA file (often the best semantic hint). */
  materialName: string;
  triangles: number;
  vertices: number;
  /** Live reference to the three.js mesh — never serialised. */
  object: Mesh;
}

/** A node in the hierarchy explorer tree (Phase 3). Groups and meshes both appear. */
export interface TreeNode {
  id: string;
  name: string;
  type: "group" | "mesh";
  /** Stable ids of every mesh at or below this node (for group operations). */
  meshIds: string[];
  children: TreeNode[];
  /** Live reference to the three.js object. */
  object: Object3D;
}

/** Result of loading + indexing the COLLADA model. */
export interface ModelIndex {
  root: Object3D;
  tree: TreeNode[];
  meshes: Map<string, MeshInfo>;
  /** Lookup from a node's stable id to its tree node (groups and meshes). */
  nodesById: Map<string, TreeNode>;
  /** Map from the live object uuid back to the stable id (for pointer picking). */
  uuidToId: Map<string, string>;
  /** SketchUp edge line-segments — rendered for definition, not classifiable. */
  edges: Object3D[];
  totalTriangles: number;
}

export type ViewMode = "original" | "classification";
export type DisplayMode = "solid" | "wireframe" | "xray";

/** The exact, minimal export contract from Phase 7 — subsystem → identifier list. */
export type ComponentMap = Record<Subsystem, string[]>;
