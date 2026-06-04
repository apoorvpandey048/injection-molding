// The self-explaining tooltip system. Every explainable surface wraps its trigger
// in <Explain>, which renders a structured popover answering the three questions
// the brief demands: "What am I seeing? · Is it good or bad? · What should I do?"
//
// Built on Radix Tooltip for collision-aware positioning. The `tone` (and the
// Reading/Action text) are meant to be DATA-DERIVED by the caller from the live
// value + its threshold band, so the words always match the numbers.

import {
  type ReactNode,
  forwardRef,
} from "react";
import * as RT from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

export type Tone = "normal" | "info" | "warning" | "critical" | "failed";

const TONE_DOT: Record<Tone, string> = {
  normal: "bg-emerald-400",
  info: "bg-sky-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
  failed: "bg-zinc-400",
};
const TONE_TEXT: Record<Tone, string> = {
  normal: "text-emerald-300",
  info: "text-sky-300",
  warning: "text-amber-300",
  critical: "text-red-300",
  failed: "text-zinc-300",
};

export function ExplainProvider({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <RT.Provider delayDuration={150} skipDelayDuration={400}>
      {children}
    </RT.Provider>
  );
}

export interface ExplainProps {
  /** Bold heading of the popover. */
  title?: ReactNode;
  /** Definition — what this thing is. */
  what?: ReactNode;
  /** The current reading interpreted (good/bad). Colored by `tone`. */
  reading?: ReactNode;
  /** What the user should do about it. */
  action?: ReactNode;
  tone?: Tone;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Render directly without forcing a help cursor (e.g. wrapping a button). */
  bare?: boolean;
  children: ReactNode;
}

export function Explain({
  title,
  what,
  reading,
  action,
  tone = "info",
  side = "top",
  align = "center",
  bare = false,
  children,
}: ExplainProps): React.JSX.Element {
  return (
    <RT.Root>
      <RT.Trigger asChild>
        <span className={cn("outline-none", !bare && "cursor-help")}>{children}</span>
      </RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-w-[300px] rounded-lg border border-panel-border bg-panel-raised/98 p-3 text-[12px] leading-relaxed text-zinc-300 shadow-2xl shadow-black/50 backdrop-blur data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
        >
          {title && (
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-zinc-100">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
              {title}
            </div>
          )}
          {what && <p className="text-zinc-400">{what}</p>}
          {reading && (
            <p className="mt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Reading
              </span>
              <br />
              <span className={cn("font-medium", TONE_TEXT[tone])}>{reading}</span>
            </p>
          )}
          {action && (
            <p className="mt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Action
              </span>
              <br />
              <span className="text-zinc-300">{action}</span>
            </p>
          )}
          <RT.Arrow className="fill-panel-border" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}

/** A small "i" affordance for panel/section headers. */
export const InfoDot = forwardRef<HTMLSpanElement, { className?: string }>(function InfoDot(
  { className },
  ref,
) {
  return (
    <span ref={ref} className={cn("inline-flex text-zinc-500 transition-colors hover:text-sky-300", className)}>
      <Info className="h-3.5 w-3.5" />
    </span>
  );
});
