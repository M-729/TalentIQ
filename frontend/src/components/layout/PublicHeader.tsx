import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";

interface PublicHeaderProps {
  backTo?: string;
  backLabel?: string;
}

// Shared across every public, candidate-facing page (Careers list, Job
// Detail, Apply) — the brand always links back to the Careers list, and an
// optional `backTo`/`backLabel` adds a page-specific "go back" link next to
// it (e.g. Job Detail -> Careers, Apply -> that specific Job). "Recruiter
// login" always appears too — it's the one in-app exit from the public
// Careers area itself, where there is no backTo. All links use React
// Router's Link so a candidate landing here from a shared URL still gets a
// real in-app destination, not just browser history.
export function PublicHeader({ backTo, backLabel }: PublicHeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex min-h-16 max-w-3xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3 sm:px-6">
        <BrandMark to="/careers" />

        <div className="flex items-center gap-3 sm:gap-4">
          {backTo && (
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backLabel ?? "Back"}
            </Link>
          )}
          {/* For recruiters/HR only — never "candidate login", since
              candidates never have a TalentIQ account. Deliberately small
              and muted so it never competes with the page's Apply action. */}
          <Link
            to="/login"
            className="rounded-md text-xs font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
          >
            Recruiter login
          </Link>
        </div>
      </div>
    </header>
  );
}
