/**
 * Replacement-date display logic (V3 sanity clamps).
 *
 * The backend clamps p50 RUL to >= 0 and never emits a past date, so the raw
 * "replace on [yesterday]" never literally happens — but `days == 0` and
 * multi-year dates both read as broken. This centralizes the presentation so the
 * gauge, the detail dialog, and the worst-component footer all agree:
 *
 *   failed component, or days <= 0  -> "OVERDUE", no date
 *   days > 365                      -> "> 1 year", no literal date
 *   otherwise                       -> normal day count + date
 */
export type ReplacementKind = "overdue" | "far" | "normal";

export interface ReplacementDisplay {
  kind: ReplacementKind;
  /** Compact label for the gauge center (e.g. "OVERDUE", "> 1 yr", "12d"). */
  gauge: string;
  /** Longer label for dialogs/footers (e.g. "OVERDUE", "> 1 year", "in 12 days"). */
  long: string;
  /** ISO date to display, or null when a literal date is unhelpful/misleading. */
  date: string | null;
}

export function formatReplacement(
  days: number | undefined,
  dateISO: string | undefined,
  failed = false,
): ReplacementDisplay {
  if (failed || (days !== undefined && days <= 0)) {
    return { kind: "overdue", gauge: "OVERDUE", long: "OVERDUE", date: null };
  }
  if (days === undefined) {
    return { kind: "normal", gauge: "—", long: "—", date: dateISO ?? null };
  }
  if (days > 365) {
    return { kind: "far", gauge: "> 1 yr", long: "> 1 year", date: null };
  }
  const d = Math.round(days);
  return {
    kind: "normal",
    gauge: `${d}d`,
    long: d === 1 ? "in 1 day" : `in ${d} days`,
    date: dateISO ?? null,
  };
}
