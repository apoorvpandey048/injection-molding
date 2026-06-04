import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { useStore } from "@/store/store";
import { getClient } from "@/data/useSnapshot";
import { MONITORED, identityOf } from "@/lib/identity";
import { Explain } from "@/ui/Explain";
import { cn } from "@/lib/cn";

export function DemoControls(): React.JSX.Element | null {
  const snapshot = useStore((s) => s.snapshot);
  const readOnly = useStore((s) => s.readOnly);
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const active = snapshot?.active_faults ?? [];

  // Read-only review links cannot disrupt the live machine.
  if (readOnly) return null;

  const toggleFault = (faultId: string) => {
    const isOn = active.includes(faultId);
    void getClient().injectFault(isOn ? `clear_${faultId}` : faultId);
  };

  return (
    <div className="border-t border-panel-border bg-panel-inset/40">
      <Explain side="top" title="Demonstration controls" what="Inject simulated faults and speed up the clock. These are NOT real machine controls.">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-panel-raised/60"
        >
          <FlaskConical className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Demo controls</span>
          {active.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
          <ChevronDown className={cn("ml-auto h-4 w-4 text-zinc-500 transition-transform", open && "rotate-180")} />
        </button>
      </Explain>
      {open && (
        <div className="space-y-3 px-4 pb-3 pt-1">
          <div className="grid grid-cols-2 gap-1.5">
            {MONITORED.map((s) => {
              const id = identityOf(s);
              if (!id.faultId) return null;
              const on = active.includes(id.faultId);
              return (
                <Explain key={s} side="top" bare title={`${id.label} fault`} what={id.failureSignature} action={on ? "Click to clear this simulated fault." : "Click to inject a wear fault on this subsystem."} tone={on ? "critical" : "info"}>
                  <button
                    onClick={() => toggleFault(id.faultId as string)}
                    className={cn(
                      "w-full rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors",
                      on ? "border-red-500/50 bg-red-500/15 text-red-200" : "border-panel-border bg-panel-raised text-zinc-300 hover:border-zinc-600",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: id.color }} />
                      {id.label}
                    </span>
                  </button>
                </Explain>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="min-w-[64px] text-[11px] text-zinc-400">Speed ×{speed}</label>
            <input
              type="range" min={1} max={20} step={1} value={speed}
              onChange={(e) => { const v = Number(e.target.value); setSpeed(v); void getClient().setSpeedup(v); }}
              className="flex-1 accent-sky-500"
            />
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Simulate faults and accelerate the clock. For demonstration only — not production controls.
          </p>
        </div>
      )}
    </div>
  );
}
