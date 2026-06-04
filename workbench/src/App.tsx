import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { Viewport } from "./components/Viewport";
import { Toolbar } from "./components/Toolbar";
import { HierarchyPanel } from "./components/HierarchyPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { ClassificationPanel } from "./components/ClassificationPanel";
import { Toast } from "./components/Toast";
import { AppBar } from "./components/platform/AppBar";
import { SubsystemRail } from "./components/platform/SubsystemRail";
import { ContextPanel } from "./components/platform/ContextPanel";
import { PlatformStatusBar } from "./components/platform/PlatformStatusBar";
import { ExplainProvider } from "./ui/Explain";
import { useStore } from "./store/store";
import { useLiveData, getClient } from "./data/useSnapshot";
import { useUrlSession } from "./data/useUrlSession";
import { HOTKEY_TO_SUBSYSTEM } from "./subsystems";
import { MONITORED } from "./lib/identity";
import { cn } from "./lib/cn";

/** Global keyboard shortcuts — mode-aware. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const s = useStore.getState();

      if (s.mode === "operations") {
        // 1–5 select the matching subsystem; Esc clears.
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < MONITORED.length) {
          e.preventDefault();
          s.selectSubsystem(MONITORED[idx]);
          return;
        }
        if (e.key === "Escape") s.selectSubsystem(null);
        return;
      }

      // Inspection
      if (e.key in HOTKEY_TO_SUBSYSTEM && s.selection.size > 0) {
        e.preventDefault();
        s.assignSelection(HOTKEY_TO_SUBSYSTEM[e.key]);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "f": s.focusSelection(); break;
        case "i": s.isolateSelection(); break;
        case "escape": s.isolated ? s.clearIsolation() : s.clearSelection(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function FailureBanner(): React.JSX.Element | null {
  const snapshot = useStore((s) => s.snapshot);
  const readOnly = useStore((s) => s.readOnly);
  if (snapshot?.machine_state !== "failed") return null;
  const f = snapshot.failure;
  return (
    <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/60 px-4 py-2 text-sm text-red-200">
      <AlertOctagon className="h-5 w-5 shrink-0 text-red-400" />
      <span>
        <span className="font-bold uppercase tracking-wide text-red-300">Machine failed</span>
        {f ? (
          <> — <span className="font-semibold capitalize">{f.component.replace(/_/g, " ")}</span> crossed the failure threshold at cycle <span className="font-mono">#{f.cycle_index}</span>. Reset to continue.</>
        ) : (
          <> — a component crossed the failure threshold. Reset to continue.</>
        )}
      </span>
      {!readOnly && (
        <button onClick={() => void getClient().reset()} className="btn btn-active ml-auto">Reset machine</button>
      )}
    </div>
  );
}

function OfflineBanner(): React.JSX.Element | null {
  const connected = useStore((s) => s.connected);
  const snapshot = useStore((s) => s.snapshot);
  if (connected || snapshot?.machine_state === "failed") return null;
  return (
    <div className="flex items-center gap-2.5 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
      <span className="font-medium">Connection lost</span>
      <span className="text-zinc-400">— reconnecting to the live stream…</span>
    </div>
  );
}

export default function App(): React.JSX.Element {
  useLiveData();
  useHotkeys();
  useUrlSession();
  const mode = useStore((s) => s.mode);

  return (
    <ExplainProvider>
      <div className="flex h-full flex-col">
        <AppBar />
        <FailureBanner />
        <OfflineBanner />

        {mode === "inspection" && <Toolbar />}

        <div className="flex min-h-0 flex-1">
          {/* Left panel — responsive widths keep the viewer the dominant column
              (≥55% from 1280px up). Desktop-optimised industrial layout. */}
          <aside
            className={cn(
              "shrink-0 border-r border-panel-border bg-panel",
              mode === "operations"
                ? "w-[208px] xl:w-[224px] 2xl:w-[248px]"
                : "w-[272px] 2xl:w-[312px]",
            )}
          >
            {mode === "operations" ? <SubsystemRail /> : <HierarchyPanel />}
          </aside>

          {/* Center — shared viewer (kept mounted across modes) */}
          <main className="min-w-0 flex-1">
            <Viewport />
          </main>

          {/* Right panel */}
          <aside
            className={cn(
              "flex shrink-0 flex-col border-l border-panel-border bg-panel",
              mode === "operations"
                ? "w-[348px] xl:w-[372px] 2xl:w-[404px]"
                : "w-[300px] 2xl:w-[336px]",
            )}
          >
            {mode === "operations" ? (
              <ContextPanel />
            ) : (
              <>
                <InspectorPanel />
                <div className="border-t border-panel-border" />
                <ClassificationPanel />
              </>
            )}
          </aside>
        </div>

        <PlatformStatusBar />
        <Toast />
      </div>
    </ExplainProvider>
  );
}
