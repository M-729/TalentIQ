import { ArrowRight, Briefcase, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ORBIT_ICONS = [
  { icon: Sparkles, className: "left-2 top-2 sm:left-4 sm:top-6" },
  { icon: Briefcase, className: "right-4 top-0 sm:right-10 sm:top-2" },
  { icon: Users, className: "left-4 bottom-0 sm:left-10 sm:bottom-4" },
  { icon: ShieldCheck, className: "right-2 bottom-2 sm:right-4 sm:bottom-8" },
];

export function FinalCtaSection() {
  return (
    <section className="overflow-hidden bg-[#121a33]">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 xl:px-16">
        <div className="max-w-2xl">
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-[#b7aeff]">Ready to get started?</p>
          <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
            Build a better hiring process with TalentIQ.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#c1c8df]">
            Join companies and candidates who are creating opportunities and building stronger teams every day.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-lg bg-[#6c5ce7] px-6 text-base hover:bg-[#7a6df0]">
              <Link to="/signup">
                Create your workspace <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-lg border-[#3a476d] bg-transparent px-6 text-base text-white hover:bg-[#202b4d] hover:text-white"
            >
              <Link to="/careers">Browse open jobs</Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto hidden size-64 items-center justify-center lg:flex" aria-hidden="true">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(108,92,231,0.28),transparent)]" />
          <div className="flex size-24 items-center justify-center rounded-full bg-white shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
            <span className="font-heading text-3xl font-extrabold text-primary">IQ</span>
          </div>
          {ORBIT_ICONS.map(({ icon: Icon, className }, index) => (
            <span
              key={index}
              className={`absolute flex size-11 items-center justify-center rounded-full border border-[#3a476d] bg-[#1a2444] text-[#a99eff] ${className}`}
            >
              <Icon className="size-4" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
