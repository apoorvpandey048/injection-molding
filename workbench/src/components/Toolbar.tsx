import { useRef } from "react";
import {
  Boxes,
  Crosshair,
  Download,
  Eye,
  Grid3x3,
  Maximize,
  Palette,
  RotateCcw,
  ScanEye,
  Spline,
  Square,
  Upload,
  X,
} from "lucide-react";
import { useStore } from "@/store/store";
import { buildComponentMap, downloadJSON, parseImport } from "@/lib/exporter";
import { cn } from "@/lib/cn";

function Divider(): React.JSX.Element {
  return <div className="mx-1 h-6 w-px bg-panel-border" />;
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={cn("btn", active && "btn-active")}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

export function Toolbar(): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);

  const displayMode = useStore((s) => s.displayMode);
  const setDisplayMode = useStore((s) => s.setDisplayMode);
  const showEdges = useStore((s) => s.showEdges);
  const toggleEdges = useStore((s) => s.toggleEdges);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);

  const isolated = useStore((s) => s.isolated);
  const isolateSelection = useStore((s) => s.isolateSelection);
  const clearIsolation = useStore((s) => s.clearIsolation);
  const selectionSize = useStore((s) => s.selection.size);

  const fitView = useStore((s) => s.fitView);
  const focusSelection = useStore((s) => s.focusSelection);
  const resetView = useStore((s) => s.resetView);

  const setToast = useStore((s) => s.setToast);

  const handleExport = () => {
    const { index, assignments } = useStore.getState();
    if (!index) return;
    downloadJSON("component-map.json", buildComponentMap(index, assignments));
    setToast("Exported component-map.json");
  };

  const handleImportFile = async (file: File) => {
    const { index, importAssignments } = useStore.getState();
    if (!index) return;
    try {
      const json = JSON.parse(await file.text());
      const { assignments, matched, skipped } = parseImport(json, index);
      importAssignments(assignments);
      setToast(`Imported ${matched} assignments${skipped ? ` (${skipped} unmatched skipped)` : ""}`);
    } catch (err) {
      setToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <header className="flex items-center gap-1.5 border-b border-panel-border bg-panel px-3 py-2">
      <div className="mr-2 flex items-center gap-2">
        <Boxes className="h-5 w-5 text-sky-400" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-zinc-100">Component Mapping Workbench</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Injection Molding Machine
          </div>
        </div>
      </div>

      <Divider />

      {/* Camera (Phase 2 / 4) */}
      <ToolButton icon={Maximize} label="Fit" onClick={fitView} />
      <ToolButton
        icon={Crosshair}
        label="Focus"
        disabled={selectionSize === 0}
        onClick={focusSelection}
      />
      <ToolButton icon={RotateCcw} label="Reset" onClick={resetView} />

      <Divider />

      {/* Display mode (Phase 4) */}
      <ToolButton
        icon={Square}
        label="Solid"
        active={displayMode === "solid"}
        onClick={() => setDisplayMode("solid")}
      />
      <ToolButton
        icon={Grid3x3}
        label="Wireframe"
        active={displayMode === "wireframe"}
        onClick={() => setDisplayMode("wireframe")}
      />
      <ToolButton
        icon={Eye}
        label="X-ray"
        active={displayMode === "xray"}
        onClick={() => setDisplayMode("xray")}
      />
      <ToolButton icon={Spline} label="Edges" active={showEdges} onClick={toggleEdges} />

      <Divider />

      {/* Isolation (Phase 4) */}
      {isolated ? (
        <ToolButton icon={X} label="Exit isolation" active onClick={clearIsolation} />
      ) : (
        <ToolButton
          icon={ScanEye}
          label="Isolate"
          disabled={selectionSize === 0}
          onClick={isolateSelection}
        />
      )}

      <Divider />

      {/* Overlay mode (Phase 6) */}
      <ToolButton
        icon={Palette}
        label={viewMode === "classification" ? "Class colors" : "Materials"}
        active={viewMode === "classification"}
        onClick={() => setViewMode(viewMode === "classification" ? "original" : "classification")}
      />

      <div className="flex-1" />

      {/* Export / import (Phase 7) */}
      <ToolButton icon={Upload} label="Import" onClick={() => fileRef.current?.click()} />
      <ToolButton icon={Download} label="Export" onClick={handleExport} />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = "";
        }}
      />
    </header>
  );
}
