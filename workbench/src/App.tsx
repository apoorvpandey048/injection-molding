import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { Viewport } from "./components/Viewport";
import { HierarchyPanel } from "./components/HierarchyPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { ClassificationPanel } from "./components/ClassificationPanel";
import { StatusBar } from "./components/StatusBar";
import { Toast } from "./components/Toast";
import { useStore } from "./store/store";
import { HOTKEY_TO_SUBSYSTEM } from "./subsystems";

/** Global keyboard shortcuts for fast classification + inspection. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
        return;
      const s = useStore.getState();

      if (e.key in HOTKEY_TO_SUBSYSTEM && s.selection.size > 0) {
        e.preventDefault();
        s.assignSelection(HOTKEY_TO_SUBSYSTEM[e.key]);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "f":
          s.focusSelection();
          break;
        case "i":
          s.isolateSelection();
          break;
        case "escape":
          if (s.isolated) s.clearIsolation();
          else s.clearSelection();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App(): React.JSX.Element {
  useHotkeys();

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="w-[300px] shrink-0 border-r border-panel-border bg-panel">
          <HierarchyPanel />
        </aside>
        <main className="min-w-0 flex-1">
          <Viewport />
        </main>
        <aside className="flex w-[330px] shrink-0 flex-col border-l border-panel-border bg-panel">
          <InspectorPanel />
          <div className="border-t border-panel-border" />
          <ClassificationPanel />
        </aside>
      </div>
      <StatusBar />
      <Toast />
    </div>
  );
}
