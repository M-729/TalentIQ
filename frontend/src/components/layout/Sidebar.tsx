import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  FileText,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string; // absent = not built yet (rendered disabled, not a dead link)
}

// The full future navigation (per the product's planned IA). Only items
// with a `to` are actually routed yet — the rest are shown, disabled, so
// the sidebar's final shape is visible now without linking to pages that
// don't exist. Later tickets just add a route and flip the item on.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Jobs", icon: Briefcase, to: "/jobs" },
  { label: "Candidates", icon: Users },
  { label: "Applications", icon: FileText },
  { label: "Hiring Pipeline", icon: Workflow },
  { label: "Assessments", icon: ClipboardCheck },
  { label: "Interviews", icon: CalendarDays },
  { label: "Emails", icon: Mail },
  { label: "Offers", icon: FileSignature },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground", className)}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 text-lg font-semibold tracking-tight text-white">
        <span className="inline-block size-5 rotate-45 rounded-[6px] bg-primary" aria-hidden="true" />
        TalentIQ
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <li key={label}>
            {to ? (
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                    isActive && "bg-sidebar-accent text-white"
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            ) : (
              <span
                aria-disabled="true"
                title="Coming soon"
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted-foreground/60"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-muted-foreground">
        v0.1 · foundation
      </div>
    </nav>
  );
}
