import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Analytics", href: "#analytics" },
    ],
  },
  {
    title: "Recruiters",
    links: [
      { label: "Create Workspace", href: "/signup" },
      { label: "Login", href: "/login" },
    ],
  },
  {
    title: "Candidates",
    links: [{ label: "Browse Jobs", href: "/careers" }],
  },
];

function isInPageAnchor(href: string): boolean {
  return href.startsWith("#");
}

// Deliberately compact — no fabricated company address/legal links (see
// this ticket's explicit rule).
export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <BrandMark to="/" />
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold text-foreground">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) =>
                  isInPageAnchor(link.href) ? (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
