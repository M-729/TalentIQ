import { cn } from "@/lib/utils";

export type HiringPipelineWorkspaceTab = "board" | "setup";

const TABS: { value: HiringPipelineWorkspaceTab; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "setup", label: "Pipeline Setup" },
];

export interface HiringPipelineWorkspaceTabsProps {
  active: HiringPipelineWorkspaceTab;
  onChange: (tab: HiringPipelineWorkspaceTab) => void;
}

// Matches JobsPage.tsx's existing status-filter tab convention (role
// "group" + aria-pressed buttons + underline style) rather than
// introducing a new tab pattern — plain buttons are keyboard accessible
// by default (Tab + Enter/Space) without needing ARIA tablist/roving
// tabindex machinery this codebase doesn't otherwise use.
export function HiringPipelineWorkspaceTabs({ active, onChange }: HiringPipelineWorkspaceTabsProps) {
  return (
    <div role="group" aria-label="Hiring pipeline view" className="flex flex-wrap gap-5 border-b border-border">
      {TABS.map(({ value, label }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
