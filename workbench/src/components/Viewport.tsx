import { Component, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Loader2, TriangleAlert } from "lucide-react";
import { ModelScene } from "./scene/ModelScene";
import { useStore } from "@/store/store";

class SceneErrorBoundary extends Component<
  { onError: (m: string) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LoadingOverlay(): React.JSX.Element | null {
  const index = useStore((s) => s.index);
  const error = useStore((s) => s.loadError);
  if (index || error) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
      <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
      <div className="text-sm">Loading machine model…</div>
      <div className="text-xs text-zinc-500">Parsing COLLADA geometry &amp; textures</div>
    </div>
  );
}

function ErrorOverlay(): React.JSX.Element | null {
  const error = useStore((s) => s.loadError);
  if (!error) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
      <TriangleAlert className="h-7 w-7 text-amber-400" />
      <div className="text-sm font-medium text-zinc-200">Could not load the model</div>
      <div className="max-w-md font-mono text-xs text-zinc-500">{error}</div>
      <div className="mt-1 text-xs text-zinc-500">
        Expected <code className="text-zinc-400">/models/model.dae</code> with its{" "}
        <code className="text-zinc-400">model/</code> texture folder.
      </div>
    </div>
  );
}

/** Cursor-following label showing the hovered component's name (Phase 2 hover). */
function HoverTooltip({ container }: { container: React.RefObject<HTMLDivElement | null> }): React.JSX.Element | null {
  const hovered = useStore((s) => s.hovered);
  const index = useStore((s) => s.index);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const raf = useRef(0);
  const latest = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      latest.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!raf.current) raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setPos(latest.current);
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [container]);

  if (!hovered) return null;
  const info = index?.meshes.get(hovered);
  if (!info) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[260px] truncate rounded-md border border-panel-border bg-panel-inset/95 px-2 py-1 font-mono text-[11px] text-zinc-200 shadow-lg"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      {info.name}
      <span className="ml-2 text-zinc-500">{info.materialName}</span>
    </div>
  );
}

export function Viewport(): React.JSX.Element {
  const setLoadError = useStore((s) => s.setLoadError);
  const clearSelection = useStore((s) => s.clearSelection);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-panel-inset">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [400, 280, 400], fov: 45, near: 0.5, far: 200000 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => clearSelection()}
      >
        <Suspense fallback={null}>
          <SceneErrorBoundary onError={setLoadError}>
            <ModelScene />
          </SceneErrorBoundary>
        </Suspense>
      </Canvas>
      <LoadingOverlay />
      <ErrorOverlay />
      <HoverTooltip container={containerRef} />
    </div>
  );
}
