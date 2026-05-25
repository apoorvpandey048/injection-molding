import { useEffect, useState } from "react";
import { Settings, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/InfoHint";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyclesPerDay: number;
  onSave: (cyclesPerDay: number) => Promise<void> | void;
}

const PRESETS = [
  { label: "1 shift", value: 2000 },
  { label: "2 shifts", value: 4000 },
  { label: "24/7", value: 8000 },
];

export function SettingsDrawer({ open, onOpenChange, cyclesPerDay, onSave }: Props): JSX.Element {
  const [value, setValue] = useState<string>(String(cyclesPerDay));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync the editor to the live value whenever the drawer (re)opens.
  useEffect(() => {
    if (open) {
      setValue(String(cyclesPerDay));
      setSaved(false);
    }
  }, [open, cyclesPerDay]);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const handleSave = async (): Promise<void> => {
    if (!valid) return;
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
    setSaved(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--color-accent)]" />
            Settings
          </SheetTitle>
          <SheetDescription>
            Production assumptions used to turn predicted cycles into calendar dates.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <label
            htmlFor="cpd-input"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            Cycles per day
            <InfoHint title="Cycles per day">
              Your production rate. <b>Higher</b> = parts wear out in fewer calendar days, so
              replacement dates get sooner and urgency rises. <b>Lower</b> = dates push further
              out. It doesn't change the machine — only how predicted cycles convert to dates.
            </InfoHint>
          </label>
          <input
            id="cpd-input"
            type="number"
            min={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className={cn(
              "w-full rounded-lg border bg-[var(--color-bg)] px-3 py-2 font-mono text-lg tabular-nums text-[var(--color-text-primary)] outline-none transition-colors",
              valid
                ? "border-[var(--color-border)] focus:border-[var(--color-accent)]"
                : "border-[var(--color-critical)]",
            )}
          />
          {!valid && (
            <p className="text-xs text-[var(--color-critical)]">Enter a number greater than 0.</p>
          )}

          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setValue(String(p.value));
                  setSaved(false);
                }}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-2 text-center text-xs transition-colors",
                  parsed === p.value
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]",
                )}
              >
                <div className="font-semibold">{p.label}</div>
                <div className="font-mono text-[10px] text-[var(--color-text-muted)]">{p.value.toLocaleString()}</div>
              </button>
            ))}
          </div>

          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            A component with <span className="font-mono text-[var(--color-text-primary)]">50,000</span> cycles
            of predicted life lasts <span className="font-semibold text-[var(--color-text-primary)]">
            {valid ? Math.floor(50000 / parsed) : "—"}</span> days at this rate. Raising
            cycles-per-day pulls every replacement date sooner.
          </p>
        </div>

        <SheetFooter>
          <Button onClick={() => void handleSave()} disabled={!valid || saving} className="w-full gap-2">
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : saving ? "Saving…" : "Save settings"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
