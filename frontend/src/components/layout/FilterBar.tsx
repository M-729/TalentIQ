import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The layout every list-page filter bar shares (search/select combinations
// differ per page — those stay hand-written in each page's own FilterBar
// component — only this wrapping row was byte-for-byte duplicated across
// Applications/Interviews/Assessments/Offers/Email Activity).
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col gap-3 sm:flex-row sm:items-center", className)}>{children}</div>;
}
