import { BrainCircuit, CheckCircle2, LineChart, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductPreviewSection } from "@/components/landing/ProductPreviewSection";

const CHECKLIST = ["Post jobs", "Find top talent", "Streamline hiring"];

const VALUE_POINTS = [
  { icon: BrainCircuit, label: "AI-powered screening", caption: "Find the best candidates faster" },
  { icon: Workflow, label: "Streamlined workflows", caption: "Manage your hiring process efficiently" },
  { icon: LineChart, label: "Powerful analytics", caption: "Make data-driven decisions" },
  { icon: ShieldCheck, label: "Secure & reliable platform", caption: "Your data and candidates are safe" },
];

export function HeroSection() {
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f2f0fd_0%,#f8f8fc_65%)]">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(85,70,232,0.16),transparent)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24 xl:px-16">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.86fr)_minmax(34rem,1.14fr)] lg:gap-12">
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 font-mono-accent text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                AI-powered recruitment
              </span>
              <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.6rem]">
                Hire Smarter.
                <br />
                Build <span className="text-primary">Stronger Teams.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                TalentIQ helps you manage the entire hiring process in one workspace — from posting jobs to screening
                candidates and making the right decisions, faster.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-lg px-6 text-base shadow-sm">
                  <Link to="/signup">Get started</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-lg bg-white px-6 text-base shadow-none">
                  <Link to="/careers">Browse open jobs</Link>
                </Button>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:translate-x-4 xl:translate-x-8">
              <ProductPreviewSection />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_POINTS.map(({ icon: Icon, label, caption }) => (
              <li key={label} className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
