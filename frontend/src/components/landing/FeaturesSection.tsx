import { CalendarClock, ClipboardCheck, FileSignature, LineChart, ScanSearch, Workflow } from "lucide-react";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI-Assisted CV Screening",
    description: "Surface structured, job-relevant CV insights for HR review. The decision always stays with your team.",
    className: "md:col-span-2 md:row-span-2",
    tone: "bg-[#f0efff]",
    visual: "screening",
  },
  {
    icon: Workflow,
    title: "Hiring Pipeline",
    description: "Build stages around each role and move candidates forward with clarity.",
    className: "md:col-span-2",
    tone: "bg-white",
    visual: "pipeline",
  },
  {
    icon: CalendarClock,
    title: "Interview Scheduling",
    description: "Coordinate calendars, Meet links, and structured feedback in one flow.",
    className: "",
    tone: "bg-white",
    visual: "calendar",
  },
  {
    icon: ClipboardCheck,
    title: "External Assessments",
    description: "Record assessment results while keeping your preferred tools in place.",
    className: "",
    tone: "bg-white",
    visual: "assessment",
  },
  {
    icon: FileSignature,
    title: "Offer Management",
    description: "Send offers and securely track each candidate response.",
    className: "",
    tone: "bg-white",
    visual: "offer",
  },
  {
    icon: LineChart,
    title: "Hiring Analytics",
    description: "See current application, pipeline, and offer data at a glance.",
    className: "",
    tone: "bg-white",
    visual: "analytics",
  },
];

function FeatureVisual({ type }: { type: string }) {
  if (type === "screening") {
    return (
      <div className="mt-8 max-w-sm rounded-lg border border-[#d9d5ff] bg-white p-4 shadow-[0_14px_30px_rgba(85,70,232,0.1)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">CV match review</span>
          <span className="rounded-full bg-[#e9e6ff] px-2 py-1 text-[10px] font-semibold text-primary">Ready to review</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {["Relevant experience", "Key skills", "Role alignment"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="w-24 text-[10px] text-muted-foreground">{label}</span>
              <span className="h-1.5 flex-1 rounded-full bg-[#eeeefe]"><span className="block h-full rounded-full bg-primary" style={{ width: `${88 - i * 14}%` }} /></span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "pipeline") {
    return (
      <div className="mt-5 flex items-center gap-2 overflow-hidden">
        {["Applied", "Review", "Interview", "Offer"].map((label, i) => (
          <div key={label} className="min-w-[5.8rem] flex-1 rounded-md border border-border bg-[#fafafb] px-3 py-2.5">
            <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-foreground">{label}</span><span className="text-[10px] text-muted-foreground">{[14, 8, 5, 2][i]}</span></div>
            <span className={`mt-2 block h-1.5 rounded-full ${i === 3 ? "bg-[#a99eff]" : "bg-primary/35"}`} />
          </div>
        ))}
      </div>
    );
  }

  const labels = {
    calendar: "Calendar connected",
    assessment: "Assessment recorded",
    offer: "Response pending",
    analytics: "Current view",
  } as Record<string, string>;
  return <div className="mt-5 border-t border-border pt-3 text-[10px] font-semibold text-primary">{labels[type]}</div>;
}

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="flex max-w-3xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono-accent text-xs font-semibold uppercase tracking-[0.18em] text-primary">One connected workflow</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl">Everything hiring teams need</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">A focused set of tools to bring every part of hiring into the same clear, secure workspace.</p>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-4 md:grid-rows-[auto_auto_auto]">
          {FEATURES.map(({ icon: Icon, title, description, className, tone, visual }) => (
            <article key={title} className={`group min-h-48 overflow-hidden rounded-xl border border-border p-5 transition-transform duration-200 hover:-translate-y-0.5 ${className} ${tone}`}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#e9e6ff] text-primary"><Icon className="size-[18px]" aria-hidden="true" /></span>
              <h3 className="mt-5 text-base font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
              <FeatureVisual type={visual} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
