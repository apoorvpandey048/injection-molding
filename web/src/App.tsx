import { useEffect, useRef, useState } from "react";
import { Cpu, RotateCcw, AlertTriangle, AlertOctagon, Settings, ChevronDown, FlaskConical } from "lucide-react";
import type { MachineState } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { InfoHint, Hint } from "@/components/InfoHint";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSnapshot } from "@/hooks/useSnapshot";
import { Twin2D } from "@/components/Twin2D";
import { FaultButtons } from "@/components/FaultButtons";
import { RULBand } from "@/components/RULBand";
import { QualityCard } from "@/components/QualityCard";
import { ProcessCharts } from "@/components/ProcessCharts";
import { ComponentGrid } from "@/components/ComponentGrid";
import { Twin3D } from "@/components/Twin3D";
import { cn } from "@/lib/utils";
import { formatReplacement } from "@/lib/replacement";

const ENABLE_3D = import.meta.env.VITE_ENABLE_3D === "true";

const STATE_STYLE: Record<MachineState, { dot: string; text: string; label: string }> = {
  running:  { dot: "bg-emerald-400", text: "text-emerald-300", label: "Running" },
  warning:  { dot: "bg-amber-400",   text: "text-amber-300",   label: "Warning" },
  critical: { dot: "bg-red-400",     text: "text-red-300",     label: "Critical" },
  failed:   { dot: "bg-zinc-400",    text: "text-zinc-300",    label: "Failed" },
};

export default function App(): JSX.Element {
  const { snapshot, connected, client } = useSnapshot();
  const [speedup, setSpeedup] = useState(1);
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  // Rolling-history clear: when the cycle counter drops (a reset happened), bump
  // `resetEpoch` and use it as a React key on the buffered charts so they remount
  // with fresh refs. No WS-protocol change.
  const prevCycle = useRef<number | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  useEffect(() => {
    const ci = snapshot?.cycle_index;
    if (ci == null) return;
    if (prevCycle.current != null && ci < prevCycle.current) {
      setResetEpoch((e) => e + 1);
    }
    prevCycle.current = ci;
  }, [snapshot?.cycle_index]);

  const handleInjectFault = async (fault: string): Promise<void> => {
    await client.injectFault(fault);
  };

  const handleSpeedupChange = async (v: number): Promise<void> => {
    setSpeedup(v);
    await client.setSpeedup(v);
  };

  const handleReset = async (): Promise<void> => {
    await client.reset();
    setResetOpen(false);
  };

  const machineState: MachineState = snapshot?.machine_state ?? "running";
  const stateStyle = STATE_STYLE[machineState];
  const failure = snapshot?.failure ?? null;

  const worstComp = snapshot?.rul?.worst_component ?? null;
  const worstEntry = worstComp ? snapshot?.rul_per_component?.[worstComp] : undefined;
  const worstFailed =
    worstComp != null &&
    snapshot?.rul?.failure_threshold !== undefined &&
    (snapshot?.health?.[worstComp] ?? 1) <= snapshot.rul.failure_threshold;
  const worstRepl = formatReplacement(
    worstEntry?.days_until_replacement,
    snapshot?.rul?.replacement_date,
    worstFailed,
  );

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={400}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-2.5">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/30">
                <Cpu className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                  IMM Predictive Maintenance
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  {snapshot?.machine_id ?? "SIM-001"} · Digital Twin
                </div>
              </div>
            </div>

            {/* Machine status */}
            <Hint
              side="bottom"
              label={
                <>
                  Overall machine condition, from the worst component's true health:{" "}
                  <b>Running</b> (healthy) → <b>Warning</b> → <b>Critical</b> →{" "}
                  <b>Failed</b> (stopped).
                </>
              }
            >
              <span
                className={cn(
                  "flex cursor-help items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  stateStyle.text,
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    stateStyle.dot,
                    machineState === "failed" && "animate-pulse",
                  )}
                />
                {stateStyle.label}
              </span>
            </Hint>

            {/* Right cluster */}
            <div className="ml-auto flex items-center gap-5">
              <Hint side="bottom" label="Total injection cycles (shots) produced since the last reset.">
                <div className="flex cursor-help flex-col items-end leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Cycle
                  </span>
                  <span className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {(snapshot?.cycle_index ?? 0).toLocaleString()}
                  </span>
                </div>
              </Hint>

              <div className="h-8 w-px bg-[var(--color-border)]" />

              <Hint
                side="bottom"
                label={
                  connected
                    ? "Live data link is healthy — cycles are streaming in real time."
                    : "Disconnected — trying to reconnect to the live stream."
                }
              >
                <div className="flex cursor-help items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      connected
                        ? "bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]"
                        : "animate-pulse bg-[var(--color-critical)]",
                    )}
                  />
                  {connected ? "Live" : "Offline"}
                </div>
              </Hint>

              <Hint side="bottom" label="Restore every component to 100% health, clear all faults, and zero the cycle counter.">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetOpen(true)}
                  className="gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </Hint>
              <Hint side="bottom" label="Settings — set the production rate (cycles/day) used to turn predicted cycles into calendar replacement dates.">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label="Open settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Hint>
            </div>
          </div>
        </header>

        <SettingsDrawer
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          cyclesPerDay={snapshot?.config?.cycles_per_day ?? 4000}
          onSave={async (v) => {
            await client.setSettings(v);
          }}
        />

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Reset machine?
              </DialogTitle>
              <DialogDescription>
                This returns the simulator to a pristine state: all components back to
                100% health, every active fault cleared, the cycle counter reset to 0,
                and the rolling charts emptied. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={() => void handleReset()} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset machine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {machineState === "failed" && (
          <div className="border-b border-red-900/60 bg-red-950/60 px-6 py-3">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3">
              <AlertOctagon className="h-5 w-5 shrink-0 text-red-400" />
              <div className="text-sm text-red-200">
                <span className="font-bold uppercase tracking-wide text-red-300">
                  Machine FAILED
                </span>
                {failure ? (
                  <>
                    {" — "}
                    <span className="font-semibold capitalize">
                      {failure.component.replace(/_/g, " ")}
                    </span>
                    {" crossed the failure threshold at cycle "}
                    <span className="font-mono font-semibold">#{failure.cycle_index}</span>
                    {". Reset to continue."}
                  </>
                ) : (
                  <> — a component crossed the failure threshold. Reset to continue.</>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => setResetOpen(true)}
                className="ml-auto gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset machine
              </Button>
            </div>
          </div>
        )}

        {!connected && machineState !== "failed" && (
          <div className="border-b border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-6 py-2">
            <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 text-xs text-[var(--color-warning)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-warning)]" />
              <span className="font-medium">Connection lost</span>
              <span className="text-[var(--color-text-secondary)]">
                — reconnecting to the live stream…
              </span>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1600px] animate-imm-in p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            {/* Left column */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    {ENABLE_3D ? "Digital Twin — 3D" : "Digital Twin"}
                    <InfoHint title="Digital Twin" side="right">
                      A schematic of the machine. Each block is a monitored component, shaded
                      by health (green = healthy, red = worn).
                      {ENABLE_3D ? " Drag to orbit, scroll to zoom." : ""}
                    </InfoHint>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ENABLE_3D ? (
                    <Twin3D />
                  ) : (
                    <Twin2D
                      health={snapshot?.health}
                      activeFaults={snapshot?.active_faults ?? []}
                      machineId={snapshot?.machine_id}
                    />
                  )}
                </CardContent>
              </Card>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50">
                <Hint
                  side="right"
                  label="Demonstration tools — inject simulated faults and speed up the clock. These are not real machine controls."
                >
                  <button
                    onClick={() => setDemoOpen((o) => !o)}
                    aria-expanded={demoOpen}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-elevated)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Demo controls
                    </span>
                    {snapshot?.active_faults && snapshot.active_faults.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-critical)]" />
                    )}
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 text-[var(--color-text-muted)] transition-transform",
                        demoOpen && "rotate-180",
                      )}
                    />
                  </button>
                </Hint>
                {demoOpen && (
                  <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-3">
                    <FaultButtons
                      activeFaults={snapshot?.active_faults ?? []}
                      onInject={handleInjectFault}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex min-w-[64px] items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                        Speed ×{speedup}
                        <InfoHint title="Simulation speed">
                          How fast the machine ages in real time. Higher = cycles tick by
                          faster (handy for demos); it doesn't change the machine, only the
                          clock. Drag right to degrade a fault quickly.
                        </InfoHint>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={speedup}
                        onChange={(e) => void handleSpeedupChange(Number(e.target.value))}
                        className="flex-1 accent-[var(--color-accent)]"
                      />
                    </div>
                    <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                      Simulate faults and accelerate the sim clock. For demonstration only —
                      not production controls.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    Component Health &amp; RUL
                    <InfoHint title="Component Health & RUL">
                      One gauge per machine component. The big number is current{" "}
                      <b>health %</b>; the ring color is <b>urgency</b> (green = safe,
                      cyan = schedule soon, amber = imminent, red = replace now); the small
                      text is <b>days until replacement</b>. Click any gauge for its full
                      forecast.
                    </InfoHint>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ComponentGrid
                    health={snapshot?.health}
                    rulPerComponent={snapshot?.rul_per_component}
                    globalRul={snapshot?.rul}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    RUL Forecast (worst component)
                    <InfoHint title="RUL Forecast">
                      Predicted <b>Remaining Useful Life</b> (in cycles) for the
                      worst-off component. The blue line is the most-likely estimate
                      (p50); the shaded band is the pessimistic→optimistic range
                      (p10–p90); the red dashed line is failure (RUL&nbsp;0).{" "}
                      <b>Higher and farther above the red line is safer.</b> Hover the
                      chart for exact values.
                    </InfoHint>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RULBand
                    key={`rul-${resetEpoch}`}
                    current={
                      snapshot?.rul
                        ? {
                            p10: snapshot.rul.p10,
                            p50: snapshot.rul.p50,
                            p90: snapshot.rul.p90,
                          }
                        : null
                    }
                    refs={
                      snapshot?.rul
                        ? {
                            failure_threshold: snapshot.rul.failure_threshold,
                            optimal_replace_low: snapshot.rul.optimal_replace_low,
                            optimal_replace_high: snapshot.rul.optimal_replace_high,
                          }
                        : undefined
                    }
                  />
                  {worstComp && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>
                        Worst component:{" "}
                        <span className="font-semibold capitalize text-foreground">
                          {worstComp.replace(/_/g, " ")}
                        </span>
                        {" · "}
                        {worstRepl.date ? (
                          <>
                            replace by{" "}
                            <span className="font-semibold text-foreground">{worstRepl.date}</span>
                          </>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              worstRepl.kind === "overdue" ? "text-red-300" : "text-foreground",
                            )}
                          >
                            {worstRepl.long}
                          </span>
                        )}
                      </span>
                      <InfoHint title="Worst component">
                        The component with the least remaining life — act on this one first.
                        “Replace by” is its predicted date; <b>OVERDUE</b> or <b>&gt; 1 year</b>
                        {" "}appear instead when a literal date would be misleading.
                      </InfoHint>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-1.5">
                      Quality
                      <InfoHint title="Quality">
                        The predicted quality class of the most recent molded part.{" "}
                        <b>Good</b> (green) is the safe state — you want that bar near
                        100%. Rising <b>Waste</b> (red) means the process is drifting out
                        of spec and parts may be scrap.
                      </InfoHint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QualityCard quality={snapshot?.quality ?? null} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-1.5">
                      Process Curves
                      <InfoHint title="Process Curves">
                        Live sensor traces from recent cycles. Smooth, steady lines are
                        healthy; growing noise, sag, or drift signals a developing fault.
                        Hover each chart's <span className="italic">i</span> for what it
                        measures.
                      </InfoHint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProcessCharts key={`proc-${resetEpoch}`} curves={snapshot?.curves ?? null} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
