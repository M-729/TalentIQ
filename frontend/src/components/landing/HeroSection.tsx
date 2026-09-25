import { BrainCircuit, CalendarDays, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductPreviewSection } from "@/components/landing/ProductPreviewSection";

const VALUE_POINTS = [
  { icon: BrainCircuit, label: "AI-assisted screening" },
  { icon: ShieldCheck, label: "Secure hiring workflows" },
  { icon: CalendarDays, label: "Google Calendar + Meet" },
  { icon: LockKeyhole, label: "Role-based team access" },
];

export function HeroSection() {
  return (
    <section className="overflow-hidden border-b border-border bg-[#fbfbfd]">
      <div className="mx-auto max-w-7xl px-5 pb-14 pt-14 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12 lg:pb-20 lg:pt-24 xl:px-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.84fr)_minmax(34rem,1.16fr)] lg:gap-14">
          <div className="max-w-xl">
            <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">TalentIQ hiring workspace</p>
            <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.7rem]">
              Smarter hiring.
              <br />
              <span className="text-primary">Stronger teams.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Manage applications, AI-assisted screening, pipelines, interviews, assessments, offers, and hiring decisions in one workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-lg px-6 text-base shadow-sm">
                <Link to="/signup">Start Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-lg bg-white px-6 text-base shadow-none">
                <Link to="/careers">Browse Open Jobs</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No candidate account required.</p>
          </div>

          <div className="lg:translate-x-4 xl:translate-x-8">
            <ProductPreviewSection />
          </div>
        </div>

        <ul className="mt-14 grid border-y border-border sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {VALUE_POINTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 border-border py-4 sm:px-5 sm:py-5 lg:border-r lg:first:pl-0 lg:last:border-r-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
