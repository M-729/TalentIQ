import * as React from "react";

import { cn } from "@/lib/utils";

// Purely decorative — a pulsing placeholder box carries no information of
// its own, so it's hidden from assistive tech rather than announced as an
// empty, unlabeled region.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

export { Skeleton };
