import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// A plain native <select>, styled to match Input — no new dependency, and
// a native select is keyboard/screen-reader accessible by default without
// needing a Radix primitive for what are just simple filter dropdowns.
//
// `className` is applied to this wrapping div (the trigger's actual visual
// box), not to the <select> itself — the chevron below is positioned
// `absolute` against this same div, so whatever sizes the trigger (e.g. a
// consumer passing a width utility) must size this element too, or the
// chevron detaches from the trigger's visible right edge. The <select>
// underneath always stays w-full of this div.
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { Select };
