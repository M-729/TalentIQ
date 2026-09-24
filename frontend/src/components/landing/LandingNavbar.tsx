import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/BrandMark";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Analytics", href: "#analytics" },
  { label: "For Hiring Teams", href: "#for-teams" },
];

// Sticky, restrained marketing navbar for the public landing page only —
// PublicHeader.tsx (Careers/Offer Response/Accept Invitation) is
// deliberately untouched and unused here; see this ticket's own
// architecture note on why a dedicated navbar is safer than extending
// PublicHeader's minimal candidate-facing design with marketing nav links.
// Shares the same BrandMark component PublicHeader uses, so the brand
// mark itself never drifts between the two.
export function LandingNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark to="/" />

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Recruiter Login
          </Link>
          <Button asChild size="sm">
            <Link to="/signup">Start Free</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          aria-controls="landing-mobile-menu"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          {isMobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <nav id="landing-mobile-menu" aria-label="Main" className="border-t border-border bg-card px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Link
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Recruiter Login
            </Link>
            <Button asChild size="sm" onClick={() => setIsMobileMenuOpen(false)}>
              <Link to="/signup">Start Free</Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
