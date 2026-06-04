// Small, dependency-free formatting + colour helpers shared across the platform.

export function clamp(x: number, lo = 0, hi = 1): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Compact cycle count: 12480 → "12.5k". */
export function formatCycles(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** Human horizon from days-until: "128 days" / "~4 months" / "> 1 year". */
export function formatHorizon(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return "—";
  if (days <= 0) return "overdue";
  if (days < 1) return "< 1 day";
  if (days < 60) return `${Math.round(days)} days`;
  if (days < 365) return `~${Math.round(days / 30)} months`;
  if (days < 365 * 5) return `~${(days / 365).toFixed(1)} years`;
  return "> 5 years";
}

// ── colour utilities ───────────────────────────────────────────────────────

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate a value `x` across an ascending list of [stop, hexColor] pairs. */
export function gradient(stops: [number, string][], x: number): string {
  if (x <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, c0] = stops[i];
    const [x1, c1] = stops[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
    }
  }
  return last[1];
}
