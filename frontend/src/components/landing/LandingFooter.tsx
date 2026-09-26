import { Link } from "react-router-dom";
import { BrandMark } from "@/components/layout/BrandMark";

const FOOTER_COLUMNS = [
  { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "How it works", href: "#how-it-works" }, { label: "Analytics", href: "#analytics" }] },
  { title: "For Employers", links: [{ label: "Create workspace", href: "/signup" }, { label: "Recruiter login", href: "/login" }] },
  { title: "For Candidates", links: [{ label: "Browse jobs", href: "/careers" }] },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#0e152b] text-[#c1c8df]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-9 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <BrandMark to="/" variant="dark" className="w-fit" />
            <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-[#9fa9c9]">
              A smarter hiring workspace for teams of any size. Find talent, build stronger teams, and grow your
              company.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => <li key={link.label}>{link.href.startsWith("#") ? <a href={link.href} className="rounded-sm text-sm text-[#aeb8d5] outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#a99eff]">{link.label}</a> : <Link to={link.href} className="rounded-sm text-sm text-[#aeb8d5] outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#a99eff]">{link.label}</Link>}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-[#232c4b] pt-6 text-xs text-[#7c85a8]">
          © {new Date().getFullYear()} TalentIQ. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
