import { useState } from "react";
import { Activity, Boxes, Gauge, RotateCcw, Settings, Wrench } from "lucide-react";
import { useStore, type AppMode } from "@/store/store";
import { getClient } from "@/data/useSnapshot";
import type { MachineState } from "@/data/api";
import { Explain } from "@/ui/Explain";
import { Modal } from "@/ui/Modal";
import { cn } from "@/lib/cn";

const STATE: Record<MachineState, { dot: string; text: string; label: string; what: string }> = {
  running: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Running", what: "All components above the maintenance window — healthy production." },
  warning: { dot: "bg-amber-400", text: "text-amber-300", label: "Warning", what: "A component has entered the optimal replacement window — plan maintenance." },
  critical: { dot: "bg-red-400", text: "text-red-300", label: "Critical", what: "A component is below the maintenance window — act now to avoid failure." },
  failed: { dot: "bg-zinc-400", text: "text-zinc-300", label: "Failed", what: "A component crossed its failure threshold — the machine has stopped." },
};

function ModeSwitch(): React.JSX.Element {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const item = (m: AppMode, label: string, Icon: typeof Gauge) => (
    <button
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        mode === m ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-panel-border bg-panel-inset p-0.5">
      {item("operations", "Operations", Gauge)}
      {item("inspection", "Inspection", Wrench)}
    </div>
  );
}

export function AppBar(): React.JSX.Element {
  const snapshot = useStore((s) => s.snapshot);
  const connected = useStore((s) => s.connected);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [cpd, setCpd] = useState<number | null>(null);

  const machineState: MachineState = snapshot?.machine_state ?? "running";
  const st = STATE[machineState];
  const cyclesPerDay = snapshot?.config?.cycles_per_day ?? 4000;

  return (
    <header className="z-20 flex items-center gap-4 border-b border-panel-border bg-panel px-4 py-2">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-sky-500/30">
          <Boxes className="h-5 w-5 text-sky-400" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-zinc-100">IMM Digital Twin Platform</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            {snapshot?.machine_id ?? "SIM-001"} · Injection Molding
          </div>
        </div>
      </div>

      {/* Machine state */}
      <Explain
        side="bottom"
        tone={machineState === "running" ? "normal" : machineState === "warning" ? "warning" : machineState === "failed" ? "failed" : "critical"}
        title="Machine condition"
        what="Overall state, taken from the worst component's true health."
        reading={st.what}
        action={machineState === "running" ? "Continue routine monitoring." : "Open the worst subsystem and review its forecast."}
      >
        <span className={cn("flex items-center gap-1.5 rounded-full border border-panel-border bg-panel-inset px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", st.text)}>
          <span className={cn("h-2 w-2 rounded-full", st.dot, machineState === "failed" && "animate-pulse")} />
          {st.label}
        </span>
      </Explain>

      <ModeSwitch />

      <div className="ml-auto flex items-center gap-4">
        <Explain side="bottom" title="Cycle counter" what="Injection cycles (shots) produced since the last reset.">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-500">Cycle</span>
            <span className="mt-0.5 font-mono text-base font-semibold tabular-nums text-zinc-100">
              {(snapshot?.cycle_index ?? 0).toLocaleString()}
            </span>
          </div>
        </Explain>

        <div className="h-7 w-px bg-panel-border" />

        <Explain
          side="bottom"
          tone={connected ? "normal" : "critical"}
          title="Live data link"
          what="Real-time connection to the machine's cycle stream."
          reading={connected ? "Connected — cycles are streaming live." : "Disconnected — attempting to reconnect."}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
            <Activity className={cn("h-3.5 w-3.5", connected ? "text-emerald-400" : "text-red-400 animate-pulse")} />
            {connected ? "Live" : "Offline"}
          </div>
        </Explain>

        <Explain side="bottom" bare title="Reset machine" what="Restore every component to 100%, clear faults, zero the counter.">
          <button onClick={() => setResetOpen(true)} className="btn btn-icon" aria-label="Reset machine">
            <RotateCcw className="h-4 w-4" />
          </button>
        </Explain>
        <Explain side="bottom" bare title="Settings" what="Set production rate (cycles/day) used to turn predicted cycles into calendar dates.">
          <button onClick={() => { setCpd(Math.round(cyclesPerDay)); setSettingsOpen(true); }} className="btn btn-icon" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </Explain>
      </div>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        footer={
          <>
            <button className="btn" onClick={() => setSettingsOpen(false)}>Cancel</button>
            <button
              className="btn btn-active"
              onClick={() => {
                if (cpd != null) void getClient().setSettings(cpd);
                setSettingsOpen(false);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <label className="block text-xs text-zinc-400">
          Production rate
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={cpd ?? ""}
              onChange={(e) => setCpd(Number(e.target.value))}
              className="w-32 rounded-md border border-panel-border bg-panel-inset px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none focus:border-sky-500"
            />
            <span className="text-sm text-zinc-400">cycles / day</span>
          </div>
        </label>
        <p className="mt-3 text-xs text-zinc-500">
          Converts predicted remaining cycles into calendar replacement dates. It doesn't change the machine — only the clock used for scheduling.
        </p>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset machine?"
        footer={
          <>
            <button className="btn" onClick={() => setResetOpen(false)}>Cancel</button>
            <button
              className="btn btn-active"
              onClick={() => { void getClient().reset(); setResetOpen(false); }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </>
        }
      >
        Returns the simulator to a pristine state: all components to 100% health, every active fault cleared, the cycle counter reset to 0, and the rolling charts emptied. This cannot be undone.
      </Modal>
    </header>
  );
}
