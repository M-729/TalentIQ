import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user } = useAuth();
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  function openMobileNav() {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setMobileNavOpen(true);
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
    previouslyFocusedRef.current?.focus();
  }

  // No Radix primitive backs this off-canvas panel (unlike Dialog), so its
  // focus-on-open / Escape-to-close / focus-return-on-close behavior is
  // hand-wired here rather than inherited for free.
  useEffect(() => {
    if (!mobileNavOpen) return;

    // Query scoped to "nav a" so focus lands on the first real nav link
    // (e.g. Dashboard) rather than the invisible full-screen backdrop
    // button, which is a DOM sibling that comes first but isn't inside the
    // <nav> the Sidebar renders.
    mobileNavRef.current?.querySelector<HTMLElement>("nav a")?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileNav();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileNavOpen]);

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" role={user?.role} />

      {/* Mobile off-canvas sidebar */}
      {mobileNavOpen && (
        <div
          id="mobile-nav-panel"
          ref={mobileNavRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-40 md:hidden"
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/40"
            onClick={closeMobileNav}
          />
          <Sidebar className={cn("relative z-50 flex shadow-xl")} role={user?.role} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={openMobileNav} mobileNavOpen={mobileNavOpen} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
