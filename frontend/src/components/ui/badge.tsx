import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// First generic Badge in this codebase (JobStatusBadge.tsx is a one-off,
// feature-specific version of the same idea) — soft-tinted pill with a
// leading dot, matching that existing visual style.
const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
      neutral: "bg-muted text-muted-foreground",
      destructive: "bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
