import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Side = "top" | "right" | "bottom" | "left";

/**
 * Small "i" icon that reveals a rich explanation on hover/focus.
 * Use next to section titles and labels (NOT inside a <button>).
 */
export function InfoHint({
  title,
  children,
  side = "top",
  className,
}: {
  title?: string;
  children: ReactNode;
  side?: Side;
  className?: string;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title ? `What is ${title}?` : "More information"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[19rem] leading-relaxed">
        {title && <div className="mb-1 font-semibold text-[var(--color-text-primary)]">{title}</div>}
        <div className="text-[var(--color-text-secondary)]">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Wraps an arbitrary element so hovering it shows a tooltip.
 * The child must forward a ref (native elements, shadcn Button, etc.).
 */
export function Hint({
  label,
  children,
  side = "top",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: Side;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[19rem] leading-relaxed text-[var(--color-text-secondary)]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
