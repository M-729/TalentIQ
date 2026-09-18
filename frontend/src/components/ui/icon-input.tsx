import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Small leading-icon treatment on text inputs, matching the wireframe's
// icon-prefixed fields (Job Title, Department, Location, ...).
export function IconInput({ icon: Icon, className, ...props }: { icon: LucideIcon } & ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
