import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary (and, if needed, a restrained secondary) action — rendered
   *  right-aligned, e.g. a single <Button>. Optional: not every page needs
   *  one, and actions that belong to a table row or local section don't
   *  belong here. */
  action?: ReactNode;
}

// The one page-header shape every top-level authenticated page now shares
// (title/description/action classes were previously hand-duplicated,
// byte-for-byte identical, across 10+ page files).
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
