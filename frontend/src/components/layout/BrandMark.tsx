import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  /** Where the mark links — PublicHeader always uses /careers (its own established convention); the landing page's own navbar uses "/" instead. */
  to: string;
  /** "light" (default) for a white/light background — dark navy text. "dark" for use on a navy/dark background — light text, matching Sidebar.tsx's own wordmark treatment. */
  variant?: "light" | "dark";
  className?: string;
}

// The single TalentIQ brand mark (rotated-square dot + wordmark) — shared
// by PublicHeader (Careers/Offer Response/Accept Invitation) and the
// landing page's own navbar/footer, so "consistent TalentIQ branding
// across every public route" (this ticket's explicit goal) is enforced by
// reusing one component, not by keeping two copies of the same markup in
// sync by hand. Extracting this was the only change made to
// PublicHeader.tsx's own rendered output — same DOM, same classes, same
// behavior, verified by PublicHeader's existing test coverage.
export function BrandMark({ to, variant = "light", className }: BrandMarkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <span className="inline-block size-6 rotate-45 rounded-[7px] bg-primary" aria-hidden="true" />
      <span className={cn("text-lg font-semibold tracking-tight", variant === "dark" ? "text-white" : "text-foreground")}>
        TalentIQ
      </span>
    </Link>
  );
}
