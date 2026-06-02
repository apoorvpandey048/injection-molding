import { use, useEffect, useMemo, useRef } from "react";
import { Box3, type Object3D } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { Bounds, GizmoHelper, GizmoViewport, OrbitControls, useBounds } from "@react-three/drei";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import { loadModel, wb } from "@/lib/model";
import { applyVisuals } from "@/lib/visuals";
import { useStore } from "@/store/store";
import type { ModelIndex } from "@/types";

// Load + index the COLLADA model exactly once and suspend on the result.
let modelPromise: Promise<ModelIndex> | null = null;
function getModel(): Promise<ModelIndex> {
  return (modelPromise ??= loadModel());
}

/** Re-frame the camera in response to fit / focus / reset commands from the UI. */
function CameraCommands({ index }: { index: ModelIndex }): null {
  const bounds = useBounds();
  const cmd = useStore((s) => s.cameraCommand);
  const handled = useRef(-1);

  useEffect(() => {
    if (!cmd || cmd.nonce === handled.current) return;
    handled.current = cmd.nonce;
    if (cmd.kind === "focus") {
      const objs = cmd.ids
        .map((id) => index.meshes.get(id)?.object)
        .filter((o): o is NonNullable<typeof o> => Boolean(o));
      if (objs.length) {
        const box = new Box3();
        for (const o of objs) box.expandByObject(o);
        bounds.refresh(box).clip().fit();
      }
    } else {
      bounds.refresh().clip().fit();
    }
  }, [cmd, bounds, index]);

  return null;
}

/** Subscribes to all visual state and reconciles the three.js graph imperatively. */
function SceneController({ index }: { index: ModelIndex }): null {
  const assignments = useStore((s) => s.assignments);
  const selection = useStore((s) => s.selection);
  const hovered = useStore((s) => s.hovered);
  const isolated = useStore((s) => s.isolated);
  const viewMode = useStore((s) => s.viewMode);
  const displayMode = useStore((s) => s.displayMode);
  const showEdges = useStore((s) => s.showEdges);

  useEffect(() => {
    applyVisuals(index, { assignments, selection, hovered, isolated, viewMode, displayMode, showEdges });
  }, [index, assignments, selection, hovered, isolated, viewMode, displayMode, showEdges]);

  return null;
}

export function ModelScene(): React.JSX.Element {
  const index = use(getModel());
  const setIndex = useStore((s) => s.setIndex);
  const selectMesh = useStore((s) => s.selectMesh);
  const setHovered = useStore((s) => s.setHovered);

  useEffect(() => {
    setIndex(index);
  }, [index, setIndex]);

  const selection = useStore((s) => s.selection);
  const hovered = useStore((s) => s.hovered);

  const selectionObjs = useMemo<Object3D[]>(
    () =>
      [...selection]
        .map((id) => index.meshes.get(id)?.object)
        .filter((o): o is NonNullable<typeof o> => Boolean(o)),
    [selection, index],
  );
  const hoverObjs = useMemo<Object3D[]>(() => {
    const o = hovered ? index.meshes.get(hovered)?.object : undefined;
    return o ? [o] : [];
  }, [hovered, index]);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = wb(e.object)?.id;
    if (id) setHovered(id);
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(null);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const id = wb(e.object)?.id;
    if (!id) return;
    const additive = e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
    selectMesh(id, additive);
  };

  return (
    <>
      <color attach="background" args={["#0a0e13"]} />
      <hemisphereLight args={[0xffffff, 0x3a4150, 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 8]} intensity={1.15} />
      <directionalLight position={[-8, 5, -6]} intensity={0.55} color="#9db4ff" />

      <Bounds fit clip observe margin={1.25} maxDuration={0.6}>
        <primitive object={index.root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
        <CameraCommands index={index} />
      </Bounds>

      <SceneController index={index} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.12} panSpeed={0.9} />

      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>

      <EffectComposer multisampling={4} autoClear={false}>
        <Outline
          selection={selectionObjs}
          edgeStrength={6}
          visibleEdgeColor={0x22d3ee}
          hiddenEdgeColor={0x0e7490}
          blur
          xRay
        />
        <Outline
          selection={hoverObjs}
          edgeStrength={3}
          visibleEdgeColor={0xffffff}
          hiddenEdgeColor={0x64748b}
        />
      </EffectComposer>
    </>
  );
}
