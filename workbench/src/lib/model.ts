import {
  type Material,
  type Object3D,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import type { MeshInfo, ModelIndex, TreeNode } from "@/types";

/**
 * Data the workbench attaches to every renderable object so the imperative
 * scene controller (SceneController.tsx) can re-skin / hide / outline it without
 * re-walking the graph. Lives on `object.userData.wb`.
 */
export interface WBUserData {
  id: string;
  /** True for classifiable meshes; false for SketchUp edge line-segments. */
  isComponent: boolean;
  /** The authored material(s), cloned once per mesh so highlighting one mesh
   *  never bleeds into sibling meshes that shared a material in the DAE. */
  original: Material | Material[] | null;
  /** Lazily-created flat colour material used by the classification overlay. */
  klass?: MeshStandardMaterial;
}

export function wb(object: Object3D): WBUserData | undefined {
  return object.userData.wb as WBUserData | undefined;
}

const MODEL_URL = "/models/model.dae";

function isLineLike(o: Object3D): boolean {
  const t = o.type;
  return t === "LineSegments" || t === "Line" || t === "LineLoop";
}

function triangleCount(mesh: Mesh): number {
  const geo = mesh.geometry;
  if (!geo) return 0;
  if (geo.index) return Math.floor(geo.index.count / 3);
  const pos = geo.getAttribute("position");
  return pos ? Math.floor(pos.count / 3) : 0;
}

function vertexCount(mesh: Mesh): number {
  const pos = mesh.geometry?.getAttribute("position");
  return pos ? pos.count : 0;
}

function materialName(mesh: Mesh): string {
  const m = mesh.material;
  if (Array.isArray(m)) {
    const names = m.map((x) => x.name).filter(Boolean);
    return names.length ? Array.from(new Set(names)).join(", ") : "(multi)";
  }
  return m?.name || "(unnamed)";
}

/** Remember the authored opacity so x-ray / restore can return to it exactly. */
function rememberBase(m: Material): Material {
  m.userData.baseOpacity = m.opacity;
  m.userData.baseTransparent = m.transparent;
  return m;
}

/** Clone the authored material(s) so per-mesh visual state is isolated. */
function cloneMaterials(mesh: Mesh): Material | Material[] {
  const m = mesh.material;
  if (Array.isArray(m)) {
    const cloned = m.map((x) => rememberBase(x.clone()));
    mesh.material = cloned;
    return cloned;
  }
  const cloned = rememberBase(m.clone());
  mesh.material = cloned;
  return cloned;
}

/** A human-friendly display name even when the SketchUp node name is empty. */
function displayName(rawName: string, fallback: string): string {
  const n = rawName?.trim();
  return n && n.length > 0 ? n : fallback;
}

/**
 * Walk the loaded COLLADA scene, assigning every node a deterministic stable id
 * (the dot-free name path with sibling de-duplication) and building the mesh
 * index + hierarchy tree. Because the source file is static and the loader is
 * deterministic, ids are reproducible across reloads and machines, which is what
 * makes an exported component-map.json portable.
 */
function indexModel(root: Object3D): ModelIndex {
  const meshes = new Map<string, MeshInfo>();
  const nodesById = new Map<string, TreeNode>();
  const uuidToId = new Map<string, string>();
  const edges: Object3D[] = [];
  let totalTriangles = 0;

  function makeId(parentId: string | null, name: string, used: Map<string, number>): string {
    const base = (name && name.trim()) || "node";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const token = n === 0 ? base : `${base}#${n}`;
    return parentId ? `${parentId}/${token}` : token;
  }

  // Returns a TreeNode for `object`, or null if it is a non-classifiable subtree
  // (e.g. an empty group or a camera node with no descendant meshes).
  function walk(
    object: Object3D,
    parentId: string | null,
    parentName: string | null,
    usedAtParent: Map<string, number>,
  ): TreeNode | null {
    // SketchUp exports edges as line segments — keep them visible for definition
    // but make them non-pickable and exclude them from the component index.
    if (isLineLike(object)) {
      object.userData.wb = { id: "", isComponent: false, original: null } as WBUserData;
      object.raycast = () => {};
      edges.push(object);
      return null;
    }

    const id = makeId(parentId, object.name, usedAtParent);
    uuidToId.set(object.uuid, id);

    if (object instanceof Mesh) {
      const original = cloneMaterials(object);
      const tris = triangleCount(object);
      totalTriangles += tris;
      const matName = materialName(object);
      const name = displayName(object.name, matName || "mesh");
      object.userData.wb = { id, isComponent: true, original } as WBUserData;

      const info: MeshInfo = {
        id,
        name,
        parentId,
        parentName,
        materialName: matName,
        triangles: tris,
        vertices: vertexCount(object),
        object,
      };
      meshes.set(id, info);

      const node: TreeNode = {
        id,
        name,
        type: "mesh",
        meshIds: [id],
        children: [],
        object,
      };
      nodesById.set(id, node);
      return node;
    }

    // Group / transform node: recurse into children.
    const name = displayName(object.name, "group");
    object.userData.wb = { id, isComponent: false, original: null } as WBUserData;
    const childUsed = new Map<string, number>();
    const children: TreeNode[] = [];
    const meshIds: string[] = [];
    for (const child of object.children) {
      const cn = walk(child, id, name, childUsed);
      if (cn) {
        children.push(cn);
        meshIds.push(...cn.meshIds);
      }
    }
    if (meshIds.length === 0) return null; // prune empty subtrees (cameras, lights)

    const node: TreeNode = { id, name, type: "group", meshIds, children, object };
    nodesById.set(id, node);
    return node;
  }

  const rootUsed = new Map<string, number>();
  const tree: TreeNode[] = [];
  for (const child of root.children) {
    const n = walk(child, null, null, rootUsed);
    if (n) tree.push(n);
  }

  return { root, tree, meshes, nodesById, uuidToId, edges, totalTriangles };
}

export function loadModel(): Promise<ModelIndex> {
  return new Promise((resolve, reject) => {
    const loader = new ColladaLoader();
    loader.load(
      MODEL_URL,
      (collada) => {
        try {
          // The model is authored Z-up in inches; ColladaLoader already converts
          // the up-axis, and drei's <Bounds> frames the model at load regardless
          // of its absolute unit scale, so no manual normalisation is needed here.
          resolve(indexModel(collada.scene));
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (err) => reject(err),
    );
  });
}
