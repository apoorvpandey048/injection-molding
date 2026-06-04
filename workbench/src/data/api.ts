// Live-data layer for the Digital Twin Platform.
//
// Speaks the existing backend contract verbatim (run.py): a WebSocket cycle
// stream at /ws plus a small REST surface under /api/*. Ported from the legacy
// web/ dashboard so the platform consumes the *unchanged* snapshot schema — no
// backend change is required to stand the platform up.

export type Urgency = "critical" | "imminent" | "schedule" | "monitor";
export type MachineState = "running" | "warning" | "critical" | "failed";

export interface FailureInfo {
  component: string;
  cycle_index: number;
  health: number;
}

export interface RulData {
  p10: number;
  p50: number;
  p90: number;
  worst_component: string | null;
  replacement_date?: string;
  urgency?: Urgency;
  failure_threshold: number;
  optimal_replace_low: number;
  optimal_replace_high: number;
}

export interface RulPerComponentEntry {
  p10: number;
  p50: number;
  p90: number;
  replacement_date: string;
  days_until_replacement: number;
  urgency: Urgency;
}

export interface QualityData {
  label: "good" | "acceptable" | "waste" | "unknown";
  probability: Record<string, number>;
}

export interface Snapshot {
  cycle_index: number;
  timestamp: number;
  machine_id: string;
  scalars: Record<string, number>;
  curves: Record<string, number[]>;
  hold_profile: number[];
  barrel_temps: number[];
  health: Record<string, number>;
  active_faults: string[];
  rul: RulData;
  rul_per_component: Record<string, RulPerComponentEntry>;
  quality: QualityData;
  machine_state: MachineState;
  failed: boolean;
  failure: FailureInfo | null;
  config: { cycles_per_day: number };
}

type SnapshotHandler = (snap: Snapshot) => void;

export class IMMClient {
  private ws: WebSocket | null = null;
  private handlers: SnapshotHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    // Match the page scheme: wss:// over HTTPS (Cloudflare tunnel), ws:// over
    // plain HTTP. A hardcoded ws:// is blocked as mixed content on an https page.
    private readonly wsUrl: string = `${
      location.protocol === "https:" ? "wss:" : "ws:"
    }//${location.host}/ws`,
  ) {}

  onSnapshot(fn: SnapshotHandler): void {
    this.handlers.push(fn);
  }
  offSnapshot(fn: SnapshotHandler): void {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }

  connect(): void {
    if (this.ws) return;
    this._open();
  }

  private _open(): void {
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data) as Snapshot;
        this.handlers.forEach((h) => h(snap));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this._scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._open();
    }, 2000);
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  async injectFault(fault: string, severity = 0.6, onset_cycles = 20): Promise<void> {
    await fetch("/api/fault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fault, severity, onset_cycles }),
    });
  }

  async setSpeedup(cycles_per_second: number): Promise<void> {
    await fetch("/api/speedup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycles_per_second }),
    });
  }

  async reset(): Promise<void> {
    await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" } });
  }

  async getSettings(): Promise<{ cycles_per_day: number }> {
    const r = await fetch("/api/settings");
    return (await r.json()) as { cycles_per_day: number };
  }

  async setSettings(cycles_per_day: number): Promise<{ cycles_per_day: number }> {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycles_per_day }),
    });
    return (await r.json()) as { cycles_per_day: number };
  }

  /** Persist the active component map to the backend (Phase 4/5). Best-effort. */
  async saveComponentMap(map: unknown): Promise<boolean> {
    try {
      const r = await fetch("/api/component-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(map),
      });
      return r.ok;
    } catch {
      return false;
    }
  }
}
