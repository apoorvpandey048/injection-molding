// Collaboration Module — shareable review sessions via URL hash (DECISIONS.md
// D-09). The current mode + selected subsystem are encoded in location.hash, so a
// link reproduces a colleague's exact view; everyone streams the same live
// snapshots from the one backend reached through the Cloudflare tunnel.
//
// Example:  https://…trycloudflare.com/#mode=operations&sub=Mold

import { useEffect, useRef } from "react";
import { useStore, type AppMode } from "@/store/store";
import { SUBSYSTEMS, type Subsystem } from "@/subsystems";

function parseHash(): { mode?: AppMode; sub?: Subsystem | null; ro?: boolean } {
  const h = location.hash.replace(/^#/, "");
  if (!h) return {};
  const params = new URLSearchParams(h);
  const out: { mode?: AppMode; sub?: Subsystem | null; ro?: boolean } = {};
  const m = params.get("mode");
  if (m === "operations" || m === "inspection") out.mode = m;
  const s = params.get("sub");
  if (s === "none") out.sub = null;
  else if (s && (SUBSYSTEMS as readonly string[]).includes(s)) out.sub = s as Subsystem;
  // Read-only reviewer mode for shared investor links: #...&ro=1
  if (params.get("ro") === "1") out.ro = true;
  return out;
}

export function useUrlSession(): void {
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selectedSubsystem);
  const readOnly = useStore((s) => s.readOnly);
  const applied = useRef(false);

  // 1. On first mount, apply the incoming hash (deep-linked review session).
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const { mode: m, sub, ro } = parseHash();
    const st = useStore.getState();
    if (ro) st.setReadOnly(true);
    if (m && m !== st.mode) st.setMode(m);
    if (sub !== undefined) st.selectSubsystem(sub);
  }, []);

  // 2. Reflect subsequent changes back into the hash (so the URL is shareable).
  //    Read-only is sticky in the URL so a forwarded link stays read-only.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("sub", selected ?? "none");
    if (readOnly) params.set("ro", "1");
    const next = `#${params.toString()}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }, [mode, selected, readOnly]);
}
