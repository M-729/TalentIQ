import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Topbar({ onMenuClick, mobileNavOpen }: { onMenuClick: () => void; mobileNavOpen: boolean }) {
  const { user, logout } = useAuth();

  return (
    // justify-between (mobile: toggle left, identity right) collapses to
    // justify-end at md+, once the toggle button itself is hidden — no
    // empty spacer element needed to hold its place.
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-6 md:justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation menu"
        aria-expanded={mobileNavOpen}
        aria-controls="mobile-nav-panel"
        onClick={onMenuClick}
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {getInitials(user.name)}
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              <span className="font-medium text-foreground">{user.name}</span>
              {" · "}
              {user.role}
            </span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </header>
  );
}
