import { ArrowRight, BriefcaseBusiness, CalendarCheck2, ClipboardCheck, Send } from "lucide-react";

const STAGES = [
  { icon: BriefcaseBusiness, number: "01", title: "Attract", description: "Create your workspace, publish a job, and receive applications.", steps: ["Create your workspace", "Publish a job", "Receive applications"] },
  { icon: ClipboardCheck, number: "02", title: "Evaluate", description: "Use AI-assisted screening, your pipeline, and assessments to build a considered shortlist.", steps: ["AI-assisted screening", "Move candidates through your pipeline", "Assess"] },
  { icon: CalendarCheck2, number: "03", title: "Interview", description: "Coordinate interviews, Meet links, and structured feedback with your team.", steps: ["Interview", "Collect feedback"] },
  { icon: Send, number: "04", title: "Decide", description: "Send an offer, receive the candidate response, and make the final hire.", steps: ["Send an offer", "Hire"] },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[#f4f5fa]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="max-w-2xl">
          <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">A clearer path to hiring</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">How it works</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">From first job post to final decision, every handoff stays connected.</p>
        </div>

        <ol className="mt-12 grid gap-0 border-y border-border lg:grid-cols-4">
          {STAGES.map(({ icon: Icon, number, title, description, steps }, index) => (
            <li key={title} className="relative border-border px-0 py-7 sm:px-6 lg:border-r lg:px-7 lg:last:border-r-0">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><Icon className="size-5" aria-hidden="true" /></span>
                <span className="font-mono-accent text-xs font-semibold text-[#9ca1b5]">{number}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 min-h-14 text-sm leading-relaxed text-muted-foreground">{description}</p>
              <ul className="mt-5 space-y-2 border-t border-border pt-4">
                {steps.map((step) => <li key={step} className="text-xs font-semibold text-foreground">{step}</li>)}
              </ul>
              {index < STAGES.length - 1 && <ArrowRight className="absolute -right-3 top-9 z-10 hidden size-6 rounded-full border border-border bg-[#f4f5fa] p-1 text-primary lg:block" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
