import { useEffect } from "react";
import { useStore } from "@/store/store";

export function Toast(): React.JSX.Element | null {
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-md border border-panel-border bg-panel-raised px-3 py-2 text-xs text-zinc-100 shadow-xl">
        {toast}
      </div>
    </div>
  );
}
