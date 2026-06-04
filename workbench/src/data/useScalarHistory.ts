import { useEffect, useRef } from "react";
import { useStore } from "@/store/store";

/**
 * Maintain a rolling buffer of recent scalar readings per channel from the live
 * snapshot. Resets when the cycle counter drops (a machine reset). Returns the
 * live ref object; the consuming component already re-renders each cycle because
 * it subscribes to the snapshot, so the buffer is observed fresh on every cycle.
 */
export function useScalarHistory(channels: string[], cap = 80): Record<string, number[]> {
  const snap = useStore((s) => s.snapshot);
  const cycle = snap?.cycle_index ?? null;
  const ref = useRef<Record<string, number[]>>({});
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (!snap || cycle == null) return;
    if (prev.current != null && cycle < prev.current) ref.current = {};
    prev.current = cycle;
    for (const k of channels) {
      const v = snap.scalars?.[k];
      if (v == null || !Number.isFinite(v)) continue;
      const arr = (ref.current[k] ??= []);
      arr.push(v);
      if (arr.length > cap) arr.shift();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle]);

  return ref.current;
}
