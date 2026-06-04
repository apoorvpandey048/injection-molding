import { Component, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Crosshair, Loader2, Maximize, RotateCcw, TriangleAlert } from "lucide-react";
import { ModelScene } from "./scene/ModelScene";
import { useStore } from "@/store/store";
import { identityOf } from "@/lib/identity";

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
    </div>
  );
}

/** Cursor-following label: subsystem (Operations) or mesh name (Inspection). */
function HoverTooltip({ container }: { container: React.RefObject<HTMLDivElement | null> }): React.JSX.Element | null {
  const mode = useStore((s) => s.mode);
  const hovered = useStore((s) => s.hovered);
  const hoveredSub = useStore((s) => s.hoveredSubsystem);
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
      if (!raf.current)
        raf.current = requestAnimationFrame(() => {
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

  let body: React.JSX.Element | null = null;
  if (mode === "operations" && hoveredSub) {
    const id = identityOf(hoveredSub);
    body = (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: id.color }} />
        {id.label}
        {hoveredSub === "Unknown" && <span className="text-zinc-500">· structure</span>}
      </span>
    );
  } else if (mode === "inspection" && hovered) {
    const info = index?.meshes.get(hovered);
    if (info) body = <span className="truncate">{info.name}<span className="ml-2 text-zinc-500">{info.materialName}</span></span>;
  }
  if (!body) return null;

  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[260px] truncate rounded-md border border-panel-border bg-panel-inset/95 px-2 py-1 font-mono text-[11px] text-zinc-200 shadow-lg"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      {body}
    </div>
  );
}

function CameraControls(): React.JSX.Element {
  const fitView = useStore((s) => s.fitView);
  const resetView = useStore((s) => s.resetView);
  const selected = useStore((s) => s.selectedSubsystem);
  const selectSubsystem = useStore((s) => s.selectSubsystem);
  const btn = "flex h-8 w-8 items-center justify-center rounded-md border border-panel-border bg-panel-raised/90 text-zinc-300 backdrop-blur transition-colors hover:bg-panel-border hover:text-zinc-100";
  return (
    <div className="absolute left-3 top-3 z-10 flex gap-1.5">
      <button className={btn} title="Fit model" onClick={fitView}><Maximize className="h-4 w-4" /></button>
      <button className={btn} title="Reset view" onClick={resetView}><RotateCcw className="h-4 w-4" /></button>
      {selected && (
        <button className={btn} title={`Re-frame ${identityOf(selected).label}`} onClick={() => selectSubsystem(selected)}>
          <Crosshair className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Persistent "you are viewing X" badge for orientation while a subsystem is focused. */
function ViewingBadge(): React.JSX.Element | null {
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selectedSubsystem);
  if (mode !== "operations" || !selected) return null;
  const id = identityOf(selected);
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-panel-border bg-panel-inset/85 px-3 py-1 backdrop-blur">
      <span className="h-2 w-2 rounded-full" style={{ background: id.color }} />
      <span className="text-[11px] font-medium text-zinc-200">Viewing · {id.label}</span>
    </div>
  );
}

function HealthLegend(): React.JSX.Element | null {
  const mode = useStore((s) => s.mode);
  if (mode !== "operations") return null;
  const chip = (c: string, label: string) => (
    <span className="flex items-center gap-1 text-[10px] text-zinc-400">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {label}
    </span>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-md border border-panel-border bg-panel-inset/80 px-2.5 py-1.5 backdrop-blur">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Health</span>
      {chip("#22c55e", "healthy")}
      {chip("#fbbf24", "watch")}
      {chip("#f4554e", "critical")}
      {chip("#47505f", "structure")}
    </div>
  );
}

export function Viewport(): React.JSX.Element {
  const setLoadError = useStore((s) => s.setLoadError);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectSubsystem = useStore((s) => s.selectSubsystem);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-panel-inset">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [400, 280, 400], fov: 45, near: 0.5, far: 200000 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => {
          const s = useStore.getState();
          if (s.mode === "operations") selectSubsystem(null);
          else clearSelection();
        }}
      >
        <Suspense fallback={null}>
          <SceneErrorBoundary onError={setLoadError}>
            <ModelScene />
          </SceneErrorBoundary>
        </Suspense>
      </Canvas>
      <CameraControls />
      <ViewingBadge />
      <HealthLegend />
      <LoadingOverlay />
      <ErrorOverlay />
      <HoverTooltip container={containerRef} />
    </div>
  );
}
