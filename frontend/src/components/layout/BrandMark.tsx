import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  /** Where the mark links — PublicHeader always uses /careers (its own established convention); the landing page's own navbar uses "/" instead. */
  to: string;
  /** "light" (default) for a white/light background — dark navy text. "dark" for use on a navy/dark background — light text, matching Sidebar's own wordmark treatment. */
  variant?: "light" | "dark";
  className?: string;
}

// The single TalentIQ brand mark (gradient ring-and-figure icon + two-tone
// wordmark) — shared by PublicHeader (Careers/Job Detail/Apply/Offer
// Response/Accept Invitation), the landing page's own navbar/footer, and
// Sidebar (via the "dark" variant), so "consistent TalentIQ branding
// everywhere" is enforced by reusing one component, not by keeping
// multiple copies of the same markup in sync by hand. Gradient ids are
// namespaced with useId() so multiple BrandMarks can render on the same
// page (unlikely today, but SVG gradient ids are global to the document)
// without one instance's <defs> silently overriding another's.
export function BrandMark({ to, variant = "light", className }: BrandMarkProps) {
  const uid = useId();

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-ring`} x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3B2FD8" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id={`${uid}-head`} x1="38" y1="34" x2="62" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4B3EDD" />
            <stop offset="1" stopColor="#7C6FF5" />
          </linearGradient>
          <linearGradient id={`${uid}-bodyL`} x1="32" y1="60" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3B2FD8" />
            <stop offset="1" stopColor="#5B4FE0" />
          </linearGradient>
          <linearGradient id={`${uid}-bodyR`} x1="50" y1="60" x2="68" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8B7CF6" />
            <stop offset="1" stopColor="#C9A6F5" />
          </linearGradient>
          <linearGradient id={`${uid}-spark`} x1="68" y1="34" x2="92" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#B79CF7" />
            <stop offset="1" stopColor="#E7D6FC" />
          </linearGradient>
          <clipPath id={`${uid}-clipL`}>
            <rect x="0" y="0" width="50" height="100" />
          </clipPath>
          <clipPath id={`${uid}-clipR`}>
            <rect x="50" y="0" width="50" height="100" />
          </clipPath>
        </defs>
        <path
          d="M74,26 A30,30 0 1 0 74,74"
          fill="none"
          stroke={`url(#${uid}-ring)`}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <g clipPath={`url(#${uid}-clipL)`}>
          <path d="M32,88 L32,80 C32,66 40,60 50,66 L50,88 Z" fill={`url(#${uid}-bodyL)`} />
        </g>
        <g clipPath={`url(#${uid}-clipR)`}>
          <path d="M50,66 C60,60 68,66 68,80 L68,88 L50,88 Z" fill={`url(#${uid}-bodyR)`} />
        </g>
        <circle cx="50" cy="45" r="10" fill={`url(#${uid}-head)`} />
        <path
          d="M80,10 C81,17 85,21 92,22 C85,23 81,27 80,34 C79,27 75,23 68,22 C75,21 81,17 80,10 Z"
          fill={`url(#${uid}-spark)`}
        />
      </svg>
      <span className="font-heading text-lg font-extrabold tracking-tight">
        <span className={variant === "dark" ? "text-white" : "text-foreground"}>Talent</span>
        <span className={variant === "dark" ? "text-[#A78BFA]" : "text-primary"}>IQ</span>
      </span>
    </Link>
  );
}
