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
  UserCog,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/auth";

interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string; // absent = not built yet (rendered disabled, not a dead link)
  adminOnly?: boolean;
}

// The full navigation. Only items with a `to` are actually routed — the
// rest are shown, disabled, so the sidebar's final shape is visible
// without linking to pages that don't exist. There is deliberately no
// standalone "Candidates" destination: recruitment workflow in this
// product is Application-centric (candidate identity/contact info is
// always shown inline on Applications/Offers/Interviews/Assessments
// views), and a separate Candidates page/route never existed beyond this
// now-removed disabled placeholder — see Candidate.model.ts, which is
// untouched and still the real, actively-referenced entity behind every
// Application.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Jobs", icon: Briefcase, to: "/jobs" },
  // No `end` prop, matching Jobs above — NavLink's default (non-end)
  // matching makes this active for /applications, /applications/:id, and
  // /applications/:id/screening alike, without any bespoke logic. It does
  // NOT also activate Jobs, since none of these paths start with /jobs.
  { label: "Applications", icon: FileText, to: "/applications" },
  { label: "Hiring Pipeline", icon: Workflow, to: "/hiring-pipeline" },
  { label: "Assessments", icon: ClipboardCheck, to: "/assessments" },
  // No `end` prop, matching Applications above — active for /interviews
  // and /interviews/:id alike.
  { label: "Interviews", icon: CalendarDays, to: "/interviews" },
  { label: "Emails", icon: Mail, to: "/emails" },
  { label: "Offers", icon: FileSignature, to: "/offers" },
  { label: "Analytics", icon: BarChart3, to: "/analytics" },
  { label: "Settings", icon: Settings, to: "/settings/integrations" },
  // ADMIN only — see TeamSettingsPage.tsx's own page-level redirect for HR.
  { label: "Team", icon: UserCog, to: "/settings/team", adminOnly: true },
];

// `role` is passed down from AppShell (which has access to the
// authenticated user via AuthContext) rather than read here via useAuth()
// directly — keeps Sidebar renderable in isolation without an
// AuthProvider wrapper, matching Sidebar.test.tsx's existing convention.
// Undefined (e.g. session still loading) simply hides every admin-only
// item, never shows one speculatively.
export function Sidebar({ className, role }: { className?: string; role?: UserRole }) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");

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
        {visibleItems.map(({ label, icon: Icon, to }) => (
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
