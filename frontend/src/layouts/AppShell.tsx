import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile off-canvas sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <Sidebar className={cn("relative z-50 flex shadow-xl")} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
