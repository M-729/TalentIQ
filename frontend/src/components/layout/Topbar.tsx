import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation menu"
        onClick={onMenuClick}
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{user.name}</span>
            {" · "}
            {user.role}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </header>
  );
}
